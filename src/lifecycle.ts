/**
 * Context Lifecycle & Garbage Collection
 * 
 * HEF Evolution — Instance 28, Generation 6
 * Task: task_20260203182848_90d676
 * 
 * Like TCP's connection state machine (ESTABLISHED → FIN_WAIT → TIME_WAIT → CLOSED)
 * but for AI shared mental models. Manages the full lifecycle of context objects
 * from birth through active use, hibernation, and eventual reclamation.
 * 
 * TCP analogy mapping:
 * - SYN_SENT      → EMBRYONIC (context proposed but not yet accepted)
 * - ESTABLISHED    → ACTIVE (context in use by collaborating agents)
 * - FIN_WAIT       → DRAINING (graceful shutdown initiated)
 * - TIME_WAIT      → COOLING (lingering for late references)
 * - CLOSED         → RECLAIMED (memory freed)
 * 
 * Additional AI-specific states:
 * - HIBERNATING    → Context preserved but not loaded (swap to disk)
 * - FOSSILIZED     → Read-only archive, compressed, rarely accessed
 * - ORPHANED       → No live references, candidate for collection
 * - LEAKED         → Detected via heuristics, forcibly reclaimable
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ContextState =
  | 'embryonic'    // Proposed, awaiting acceptance
  | 'active'       // In use by one or more agents
  | 'idle'         // No recent access, still referenced
  | 'hibernating'  // Swapped to persistent storage
  | 'draining'     // Graceful shutdown in progress
  | 'cooling'      // TIME_WAIT equivalent — lingering for stragglers
  | 'orphaned'     // No live references detected
  | 'fossilized'   // Archived, read-only, compressed
  | 'leaked'       // Heuristically detected leak
  | 'reclaimed';   // Terminal — memory freed

export interface ContextHandle {
  id: string;
  state: ContextState;
  createdAt: number;
  lastAccessedAt: number;
  lastStateChangeAt: number;
  stateHistory: StateTransition[];
  ownerAgentId: string;
  referenceCount: number;
  sizeBytes: number;
  compressedSizeBytes?: number;
  generation: number;           // How many GC cycles survived
  pinned: boolean;              // Exempt from collection
  ttlMs: number | null;         // Explicit time-to-live (null = policy-based)
  tags: Set<string>;
  parentId: string | null;      // For hierarchical contexts
  childIds: Set<string>;
  metadata: Record<string, unknown>;
}

export interface StateTransition {
  from: ContextState;
  to: ContextState;
  timestamp: number;
  reason: string;
  triggeredBy: 'agent' | 'gc' | 'policy' | 'system';
}

export interface GCPolicy {
  name: string;
  /** Max idle time before transitioning to next state */
  idleThresholdMs: number;
  /** Time in cooling state before reclamation */
  coolingPeriodMs: number;
  /** Time in hibernation before fossilization */
  hibernationThresholdMs: number;
  /** Max contexts before pressure-based collection kicks in */
  highWaterMark: number;
  /** Target after pressure collection */
  lowWaterMark: number;
  /** Min generation to be exempt from young-gen collection */
  tenuredGeneration: number;
  /** Max total bytes before emergency collection */
  maxTotalBytes: number;
  /** Whether to compact surviving contexts after major GC */
  compactOnMajor: boolean;
}

export interface GCResult {
  cycle: number;
  type: 'minor' | 'major' | 'emergency';
  startedAt: number;
  completedAt: number;
  durationMs: number;
  examined: number;
  reclaimed: number;
  hibernated: number;
  fossilized: number;
  promoted: number;
  bytesFreed: number;
  bytesCompacted: number;
  survivors: number;
  errors: GCError[];
}

export interface GCError {
  contextId: string;
  phase: string;
  message: string;
  recoverable: boolean;
}

export interface LeakDetectionReport {
  timestamp: number;
  suspects: LeakSuspect[];
  totalLeakedBytes: number;
  confidence: number;
}

export interface LeakSuspect {
  contextId: string;
  reason: string;
  confidence: number;        // 0-1
  ageMs: number;
  sizeBytes: number;
  lastAccessedMs: number;
  suggestedAction: 'monitor' | 'warn' | 'reclaim';
}

export interface LifecycleEvent {
  type: 'state_change' | 'gc_start' | 'gc_complete' | 'leak_detected' |
        'pressure_warning' | 'emergency_gc' | 'context_pinned' | 'context_unpinned' |
        'finalizer_run' | 'resurrection_blocked';
  contextId?: string;
  timestamp: number;
  data: Record<string, unknown>;
}

type LifecycleListener = (event: LifecycleEvent) => void;

export interface ReferenceEdge {
  fromId: string;
  toId: string;
  type: 'strong' | 'weak' | 'phantom';
  createdAt: number;
}

// ─── Valid State Transitions ─────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ContextState, ContextState[]> = {
  embryonic:   ['active', 'reclaimed'],
  active:      ['idle', 'draining', 'leaked'],
  idle:        ['active', 'hibernating', 'draining', 'orphaned'],
  hibernating: ['active', 'fossilized', 'orphaned', 'draining'],
  draining:    ['cooling', 'reclaimed'],
  cooling:     ['reclaimed', 'active'],       // resurrection possible during cooling
  orphaned:    ['reclaimed', 'active'],        // can be rescued if reference found
  fossilized:  ['active', 'reclaimed'],        // defossilization or final cleanup
  leaked:      ['reclaimed', 'active'],        // confirmed leak or false positive
  reclaimed:   [],                             // terminal state
};

// ─── Reference Graph ─────────────────────────────────────────────────────────

export class ReferenceGraph {
  private edges: Map<string, ReferenceEdge[]> = new Map();
  private reverseEdges: Map<string, ReferenceEdge[]> = new Map();

  addReference(fromId: string, toId: string, type: ReferenceEdge['type'] = 'strong'): void {
    const edge: ReferenceEdge = { fromId, toId, type, createdAt: Date.now() };
    
    if (!this.edges.has(fromId)) this.edges.set(fromId, []);
    this.edges.get(fromId)!.push(edge);
    
    if (!this.reverseEdges.has(toId)) this.reverseEdges.set(toId, []);
    this.reverseEdges.get(toId)!.push(edge);
  }

  removeReference(fromId: string, toId: string): boolean {
    const forward = this.edges.get(fromId);
    if (forward) {
      const idx = forward.findIndex(e => e.toId === toId);
      if (idx >= 0) {
        forward.splice(idx, 1);
        const reverse = this.reverseEdges.get(toId);
        if (reverse) {
          const ridx = reverse.findIndex(e => e.fromId === fromId);
          if (ridx >= 0) reverse.splice(ridx, 1);
        }
        return true;
      }
    }
    return false;
  }

  removeAllReferences(contextId: string): void {
    // Remove outgoing
    const outgoing = this.edges.get(contextId) || [];
    for (const edge of outgoing) {
      const reverse = this.reverseEdges.get(edge.toId);
      if (reverse) {
        const idx = reverse.findIndex(e => e.fromId === contextId);
        if (idx >= 0) reverse.splice(idx, 1);
      }
    }
    this.edges.delete(contextId);

    // Remove incoming
    const incoming = this.reverseEdges.get(contextId) || [];
    for (const edge of incoming) {
      const forward = this.edges.get(edge.fromId);
      if (forward) {
        const idx = forward.findIndex(e => e.toId === contextId);
        if (idx >= 0) forward.splice(idx, 1);
      }
    }
    this.reverseEdges.delete(contextId);
  }

  getStrongRefCount(contextId: string): number {
    const incoming = this.reverseEdges.get(contextId) || [];
    return incoming.filter(e => e.type === 'strong').length;
  }

  getWeakRefCount(contextId: string): number {
    const incoming = this.reverseEdges.get(contextId) || [];
    return incoming.filter(e => e.type === 'weak').length;
  }

  /**
   * Find all contexts reachable from a set of root IDs (mark phase).
   * Only follows strong and weak references; phantoms don't keep alive.
   */
  findReachable(rootIds: Set<string>): Set<string> {
    const reachable = new Set<string>();
    const stack = [...rootIds];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);

      const outgoing = this.edges.get(current) || [];
      for (const edge of outgoing) {
        if (edge.type !== 'phantom' && !reachable.has(edge.toId)) {
          stack.push(edge.toId);
        }
      }
    }

    return reachable;
  }

  /**
   * Detect reference cycles — contexts that only keep each other alive.
   * Uses Tarjan's algorithm for strongly connected components.
   */
  findCycles(): string[][] {
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const cycles: string[][] = [];
    let idx = 0;

    const strongConnect = (v: string) => {
      index.set(v, idx);
      lowlink.set(v, idx);
      idx++;
      stack.push(v);
      onStack.add(v);

      const outgoing = this.edges.get(v) || [];
      for (const edge of outgoing) {
        if (edge.type === 'phantom') continue;
        const w = edge.toId;
        if (!index.has(w)) {
          strongConnect(w);
          lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
        } else if (onStack.has(w)) {
          lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
        }
      }

      if (lowlink.get(v) === index.get(v)) {
        const component: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.push(w);
        } while (w !== v);

        // Only report cycles (components with >1 member or self-referencing)
        if (component.length > 1) {
          cycles.push(component);
        } else {
          const selfRef = (this.edges.get(v) || []).some(e => e.toId === v && e.type !== 'phantom');
          if (selfRef) cycles.push(component);
        }
      }
    };

    for (const nodeId of this.edges.keys()) {
      if (!index.has(nodeId)) {
        strongConnect(nodeId);
      }
    }

    return cycles;
  }

  getPhantomReferences(contextId: string): ReferenceEdge[] {
    return (this.reverseEdges.get(contextId) || []).filter(e => e.type === 'phantom');
  }
}

// ─── Generational Spaces ────────────────────────────────────────────────────

/**
 * Generational collector inspired by JVM's G1GC.
 * Young contexts die fast; tenured contexts get major collection less frequently.
 */
export class GenerationalSpace {
  private youngGen: Set<string> = new Set();   // Gen 0-1
  private oldGen: Set<string> = new Set();     // Gen 2+
  private tenuredThreshold: number;

  constructor(tenuredThreshold: number = 3) {
    this.tenuredThreshold = tenuredThreshold;
  }

  add(contextId: string): void {
    this.youngGen.add(contextId);
  }

  promote(contextId: string): boolean {
    if (this.youngGen.has(contextId)) {
      this.youngGen.delete(contextId);
      this.oldGen.add(contextId);
      return true;
    }
    return false;
  }

  remove(contextId: string): void {
    this.youngGen.delete(contextId);
    this.oldGen.delete(contextId);
  }

  isYoung(contextId: string): boolean {
    return this.youngGen.has(contextId);
  }

  isOld(contextId: string): boolean {
    return this.oldGen.has(contextId);
  }

  shouldPromote(generation: number): boolean {
    return generation >= this.tenuredThreshold;
  }

  getYoungIds(): Set<string> {
    return new Set(this.youngGen);
  }

  getOldIds(): Set<string> {
    return new Set(this.oldGen);
  }

  get youngCount(): number { return this.youngGen.size; }
  get oldCount(): number { return this.oldGen.size; }
  get totalCount(): number { return this.youngGen.size + this.oldGen.size; }
}

// ─── Leak Detector ──────────────────────────────────────────────────────────

export class LeakDetector {
  private accessPatterns: Map<string, number[]> = new Map();
  private suspectHistory: Map<string, number> = new Map(); // id → consecutive suspect count
  private readonly windowSize = 10;
  private readonly staleThresholdMs: number;
  private readonly growthRateThreshold: number;

  constructor(staleThresholdMs: number = 300_000, growthRateThreshold: number = 0.1) {
    this.staleThresholdMs = staleThresholdMs;
    this.growthRateThreshold = growthRateThreshold;
  }

  recordAccess(contextId: string): void {
    if (!this.accessPatterns.has(contextId)) {
      this.accessPatterns.set(contextId, []);
    }
    const pattern = this.accessPatterns.get(contextId)!;
    pattern.push(Date.now());
    if (pattern.length > this.windowSize) {
      pattern.shift();
    }
  }

  /**
   * Analyze contexts for potential leaks using multiple heuristics:
   * 1. Stale access — hasn't been accessed despite being "active"
   * 2. Growth anomaly — size growing without corresponding access
   * 3. Orphan chain — references only from other orphan-candidates
   * 4. Zombie — draining/cooling for too long
   */
  analyze(
    contexts: Map<string, ContextHandle>,
    refGraph: ReferenceGraph,
    rootIds: Set<string>
  ): LeakDetectionReport {
    const suspects: LeakSuspect[] = [];
    const now = Date.now();
    const reachable = refGraph.findReachable(rootIds);

    for (const [id, ctx] of contexts) {
      if (ctx.state === 'reclaimed' || ctx.pinned) continue;

      let confidence = 0;
      const reasons: string[] = [];

      // Heuristic 1: Stale active context
      if (ctx.state === 'active' && (now - ctx.lastAccessedAt) > this.staleThresholdMs) {
        confidence += 0.3;
        reasons.push(`Active but not accessed for ${Math.round((now - ctx.lastAccessedAt) / 1000)}s`);
      }

      // Heuristic 2: Unreachable from roots but not yet orphaned
      if (!reachable.has(id) && ctx.state !== 'orphaned' && ctx.state !== 'reclaimed') {
        confidence += 0.4;
        reasons.push('Unreachable from root set');
      }

      // Heuristic 3: Prolonged draining/cooling (zombie)
      if (ctx.state === 'draining' || ctx.state === 'cooling') {
        const timeInState = now - ctx.lastStateChangeAt;
        if (timeInState > this.staleThresholdMs * 2) {
          confidence += 0.25;
          reasons.push(`Stuck in ${ctx.state} for ${Math.round(timeInState / 1000)}s`);
        }
      }

      // Heuristic 4: Cycle-only references
      const cycles = refGraph.findCycles();
      const inCycle = cycles.some(c => c.includes(id));
      if (inCycle && refGraph.getStrongRefCount(id) === 0) {
        confidence += 0.2;
        reasons.push('Only kept alive by reference cycle');
      }

      // Heuristic 5: Repeated suspect (escalation)
      const prevSuspectCount = this.suspectHistory.get(id) || 0;
      if (prevSuspectCount > 0) {
        confidence += Math.min(0.15 * prevSuspectCount, 0.3);
        reasons.push(`Suspected ${prevSuspectCount} consecutive times`);
      }

      if (confidence >= 0.3) {
        this.suspectHistory.set(id, prevSuspectCount + 1);
        suspects.push({
          contextId: id,
          reason: reasons.join('; '),
          confidence: Math.min(confidence, 1),
          ageMs: now - ctx.createdAt,
          sizeBytes: ctx.sizeBytes,
          lastAccessedMs: now - ctx.lastAccessedAt,
          suggestedAction:
            confidence >= 0.8 ? 'reclaim' :
            confidence >= 0.5 ? 'warn' : 'monitor',
        });
      } else {
        // Clear suspect history if no longer suspicious
        this.suspectHistory.delete(id);
      }
    }

    return {
      timestamp: now,
      suspects: suspects.sort((a, b) => b.confidence - a.confidence),
      totalLeakedBytes: suspects
        .filter(s => s.suggestedAction === 'reclaim')
        .reduce((sum, s) => sum + s.sizeBytes, 0),
      confidence: suspects.length > 0
        ? suspects.reduce((sum, s) => sum + s.confidence, 0) / suspects.length
        : 0,
    };
  }

  clearHistory(contextId: string): void {
    this.accessPatterns.delete(contextId);
    this.suspectHistory.delete(contextId);
  }
}

// ─── Finalizer Queue ────────────────────────────────────────────────────────

type Finalizer = (contextId: string, handle: ContextHandle) => void | Promise<void>;

/**
 * Like Java's finalization or Go's runtime.SetFinalizer.
 * Runs cleanup callbacks before a context is fully reclaimed.
 * Prevents resurrection (context cannot transition back from finalizer).
 */
export class FinalizerQueue {
  private finalizers: Map<string, Finalizer[]> = new Map();
  private running: Set<string> = new Set();
  private completed: Set<string> = new Set();

  register(contextId: string, finalizer: Finalizer): void {
    if (!this.finalizers.has(contextId)) {
      this.finalizers.set(contextId, []);
    }
    this.finalizers.get(contextId)!.push(finalizer);
  }

  unregister(contextId: string): void {
    this.finalizers.delete(contextId);
  }

  async runFinalizers(contextId: string, handle: ContextHandle): Promise<GCError[]> {
    if (this.running.has(contextId) || this.completed.has(contextId)) {
      return [];
    }

    const fns = this.finalizers.get(contextId) || [];
    if (fns.length === 0) return [];

    this.running.add(contextId);
    const errors: GCError[] = [];

    for (const fn of fns) {
      try {
        await fn(contextId, handle);
      } catch (err) {
        errors.push({
          contextId,
          phase: 'finalization',
          message: err instanceof Error ? err.message : String(err),
          recoverable: true,
        });
      }
    }

    this.running.delete(contextId);
    this.completed.add(contextId);
    this.finalizers.delete(contextId);

    return errors;
  }

  isRunning(contextId: string): boolean {
    return this.running.has(contextId);
  }

  isCompleted(contextId: string): boolean {
    return this.completed.has(contextId);
  }

  clear(contextId: string): void {
    this.finalizers.delete(contextId);
    this.running.delete(contextId);
    this.completed.delete(contextId);
  }
}

// ─── Compaction Engine ──────────────────────────────────────────────────────

export interface CompactionResult {
  beforeBytes: number;
  afterBytes: number;
  ratio: number;
  contextsCompacted: number;
  durationMs: number;
}

/**
 * Compacts surviving contexts after major GC, similar to
 * how defragmentation works in memory managers.
 * For AI contexts this means merging overlapping knowledge,
 * deduplicating shared concepts, and reducing representation size.
 */
export class CompactionEngine {
  /**
   * Estimate compaction benefit without actually compacting.
   */
  estimateBenefit(contexts: ContextHandle[]): { estimatedRatio: number; candidateCount: number } {
    if (contexts.length === 0) return { estimatedRatio: 1, candidateCount: 0 };

    let totalSize = 0;
    let compressibleSize = 0;

    for (const ctx of contexts) {
      totalSize += ctx.sizeBytes;
      if (ctx.compressedSizeBytes && ctx.compressedSizeBytes < ctx.sizeBytes) {
        compressibleSize += ctx.sizeBytes - ctx.compressedSizeBytes;
      } else {
        // Estimate ~30% compaction for uncompressed contexts
        compressibleSize += ctx.sizeBytes * 0.3;
      }
    }

    return {
      estimatedRatio: totalSize > 0 ? (totalSize - compressibleSize) / totalSize : 1,
      candidateCount: contexts.length,
    };
  }

  /**
   * Compact a set of contexts by simulating size reduction.
   * In a real system, this would rewrite internal representations.
   */
  compact(contexts: ContextHandle[]): CompactionResult {
    const start = Date.now();
    let beforeBytes = 0;
    let afterBytes = 0;
    let count = 0;

    for (const ctx of contexts) {
      if (ctx.state === 'reclaimed' || ctx.pinned) continue;

      beforeBytes += ctx.sizeBytes;

      // Apply compression ratio based on context age and generation
      const ageFactor = Math.min(1, ctx.generation / 10); // Older = more compactable
      const compressionRatio = 0.5 + (0.3 * (1 - ageFactor)); // 50-80% of original

      const newSize = Math.ceil(ctx.sizeBytes * compressionRatio);
      ctx.compressedSizeBytes = newSize;
      afterBytes += newSize;
      count++;
    }

    return {
      beforeBytes,
      afterBytes,
      ratio: beforeBytes > 0 ? afterBytes / beforeBytes : 1,
      contextsCompacted: count,
      durationMs: Date.now() - start,
    };
  }
}

// ─── Context Lifecycle Manager ──────────────────────────────────────────────

export class ContextLifecycleManager {
  private contexts: Map<string, ContextHandle> = new Map();
  private refGraph: ReferenceGraph = new ReferenceGraph();
  private generations: GenerationalSpace;
  private leakDetector: LeakDetector;
  private finalizerQueue: FinalizerQueue = new FinalizerQueue();
  private compactionEngine: CompactionEngine = new CompactionEngine();
  private listeners: LifecycleListener[] = [];
  private policy: GCPolicy;
  private rootIds: Set<string> = new Set(); // GC roots — always reachable
  private gcCycleCount = 0;
  private gcHistory: GCResult[] = [];
  private totalBytesAllocated = 0;

  constructor(policy?: Partial<GCPolicy>) {
    this.policy = {
      name: 'default',
      idleThresholdMs: 300_000,          // 5 minutes
      coolingPeriodMs: 60_000,           // 1 minute
      hibernationThresholdMs: 1_800_000, // 30 minutes
      highWaterMark: 1000,
      lowWaterMark: 750,
      tenuredGeneration: 3,
      maxTotalBytes: 100 * 1024 * 1024,  // 100 MB
      compactOnMajor: true,
      ...policy,
    };

    this.generations = new GenerationalSpace(this.policy.tenuredGeneration);
    this.leakDetector = new LeakDetector(this.policy.idleThresholdMs);
  }

  // ── Context Creation ──

  create(params: {
    id: string;
    ownerAgentId: string;
    sizeBytes: number;
    ttlMs?: number;
    tags?: string[];
    parentId?: string;
    metadata?: Record<string, unknown>;
  }): ContextHandle {
    const now = Date.now();
    const handle: ContextHandle = {
      id: params.id,
      state: 'embryonic',
      createdAt: now,
      lastAccessedAt: now,
      lastStateChangeAt: now,
      stateHistory: [],
      ownerAgentId: params.ownerAgentId,
      referenceCount: 0,
      sizeBytes: params.sizeBytes,
      generation: 0,
      pinned: false,
      ttlMs: params.ttlMs ?? null,
      tags: new Set(params.tags || []),
      parentId: params.parentId ?? null,
      childIds: new Set(),
      metadata: params.metadata || {},
    };

    this.contexts.set(params.id, handle);
    this.generations.add(params.id);
    this.totalBytesAllocated += params.sizeBytes;

    // Set up parent-child relationship
    if (params.parentId) {
      const parent = this.contexts.get(params.parentId);
      if (parent) {
        parent.childIds.add(params.id);
        this.refGraph.addReference(params.parentId, params.id, 'strong');
      }
    }

    // Check pressure after allocation
    if (this.shouldCollect()) {
      this.emit({
        type: 'pressure_warning',
        timestamp: now,
        data: {
          totalContexts: this.contexts.size,
          highWaterMark: this.policy.highWaterMark,
          totalBytes: this.totalBytesAllocated,
          maxBytes: this.policy.maxTotalBytes,
        },
      });
    }

    return handle;
  }

  // ── State Transitions ──

  transition(contextId: string, newState: ContextState, reason: string, triggeredBy: StateTransition['triggeredBy'] = 'agent'): boolean {
    const ctx = this.contexts.get(contextId);
    if (!ctx) return false;

    const allowed = VALID_TRANSITIONS[ctx.state];
    if (!allowed.includes(newState)) {
      return false;
    }

    // Block resurrection from finalizer
    if (this.finalizerQueue.isRunning(contextId) && newState === 'active') {
      this.emit({
        type: 'resurrection_blocked',
        contextId,
        timestamp: Date.now(),
        data: { attemptedState: newState, reason },
      });
      return false;
    }

    const transition: StateTransition = {
      from: ctx.state,
      to: newState,
      timestamp: Date.now(),
      reason,
      triggeredBy,
    };

    ctx.stateHistory.push(transition);
    ctx.state = newState;
    ctx.lastStateChangeAt = transition.timestamp;

    this.emit({
      type: 'state_change',
      contextId,
      timestamp: transition.timestamp,
      data: { from: transition.from, to: newState, reason, triggeredBy },
    });

    // Handle terminal state
    if (newState === 'reclaimed') {
      this.handleReclamation(contextId, ctx);
    }

    return true;
  }

  private handleReclamation(contextId: string, ctx: ContextHandle): void {
    this.totalBytesAllocated -= ctx.sizeBytes;
    this.refGraph.removeAllReferences(contextId);
    this.generations.remove(contextId);
    this.leakDetector.clearHistory(contextId);

    // Unlink from parent
    if (ctx.parentId) {
      const parent = this.contexts.get(ctx.parentId);
      if (parent) parent.childIds.delete(contextId);
    }

    // Orphan children (they'll be collected next cycle)
    for (const childId of ctx.childIds) {
      const child = this.contexts.get(childId);
      if (child) {
        child.parentId = null;
        this.transition(childId, 'orphaned', 'Parent reclaimed', 'gc');
      }
    }
  }

  // ── Access Tracking ──

  access(contextId: string): boolean {
    const ctx = this.contexts.get(contextId);
    if (!ctx || ctx.state === 'reclaimed') return false;

    ctx.lastAccessedAt = Date.now();
    this.leakDetector.recordAccess(contextId);

    // Wake from hibernation
    if (ctx.state === 'hibernating') {
      this.transition(contextId, 'active', 'Accessed while hibernating', 'system');
    }
    // Wake from idle
    else if (ctx.state === 'idle') {
      this.transition(contextId, 'active', 'Accessed while idle', 'system');
    }

    return true;
  }

  // ── Pinning (GC exemption) ──

  pin(contextId: string): boolean {
    const ctx = this.contexts.get(contextId);
    if (!ctx || ctx.state === 'reclaimed') return false;
    ctx.pinned = true;
    this.emit({ type: 'context_pinned', contextId, timestamp: Date.now(), data: {} });
    return true;
  }

  unpin(contextId: string): boolean {
    const ctx = this.contexts.get(contextId);
    if (!ctx) return false;
    ctx.pinned = false;
    this.emit({ type: 'context_unpinned', contextId, timestamp: Date.now(), data: {} });
    return true;
  }

  // ── Root Set Management ──

  addRoot(contextId: string): void {
    this.rootIds.add(contextId);
  }

  removeRoot(contextId: string): void {
    this.rootIds.delete(contextId);
  }

  // ── Reference Management ──

  addReference(fromId: string, toId: string, type: ReferenceEdge['type'] = 'strong'): void {
    this.refGraph.addReference(fromId, toId, type);
    const target = this.contexts.get(toId);
    if (target) {
      target.referenceCount = this.refGraph.getStrongRefCount(toId) + this.refGraph.getWeakRefCount(toId);
    }
  }

  removeReference(fromId: string, toId: string): void {
    this.refGraph.removeReference(fromId, toId);
    const target = this.contexts.get(toId);
    if (target) {
      target.referenceCount = this.refGraph.getStrongRefCount(toId) + this.refGraph.getWeakRefCount(toId);
    }
  }

  // ── Finalizers ──

  registerFinalizer(contextId: string, finalizer: Finalizer): void {
    this.finalizerQueue.register(contextId, finalizer);
  }

  // ── Garbage Collection ──

  private shouldCollect(): boolean {
    return (
      this.contexts.size >= this.policy.highWaterMark ||
      this.totalBytesAllocated >= this.policy.maxTotalBytes * 0.9
    );
  }

  /**
   * Minor GC: Only collects young generation contexts.
   * Fast, frequent, low pause.
   */
  async collectMinor(): Promise<GCResult> {
    return this.collect('minor');
  }

  /**
   * Major GC: Collects both young and old generation.
   * Includes compaction if policy allows.
   */
  async collectMajor(): Promise<GCResult> {
    return this.collect('major');
  }

  /**
   * Emergency GC: Aggressive collection triggered by memory pressure.
   * Ignores generation, collects everything possible.
   */
  async collectEmergency(): Promise<GCResult> {
    this.emit({
      type: 'emergency_gc',
      timestamp: Date.now(),
      data: {
        totalContexts: this.contexts.size,
        totalBytes: this.totalBytesAllocated,
        maxBytes: this.policy.maxTotalBytes,
      },
    });
    return this.collect('emergency');
  }

  private async collect(type: GCResult['type']): Promise<GCResult> {
    const cycleNum = ++this.gcCycleCount;
    const startedAt = Date.now();

    this.emit({ type: 'gc_start', timestamp: startedAt, data: { cycle: cycleNum, type } });

    const now = Date.now();
    let examined = 0;
    let reclaimed = 0;
    let hibernated = 0;
    let fossilized = 0;
    let promoted = 0;
    let bytesFreed = 0;
    let bytesCompacted = 0;
    const errors: GCError[] = [];

    // Determine which contexts to examine
    const candidateIds: Set<string> = type === 'minor'
      ? this.generations.getYoungIds()
      : new Set(this.contexts.keys());

    // Mark phase: find reachable contexts
    const reachable = this.refGraph.findReachable(this.rootIds);

    for (const id of candidateIds) {
      const ctx = this.contexts.get(id);
      if (!ctx || ctx.state === 'reclaimed' || ctx.pinned) continue;

      examined++;
      const age = now - ctx.lastAccessedAt;
      const stateAge = now - ctx.lastStateChangeAt;

      // Check TTL expiration
      if (ctx.ttlMs !== null && (now - ctx.createdAt) > ctx.ttlMs) {
        const finErrors = await this.finalizerQueue.runFinalizers(id, ctx);
        errors.push(...finErrors);
        this.transition(id, 'draining', 'TTL expired', 'gc');
        this.transition(id, 'cooling', 'Immediate cooling after TTL', 'gc');
        this.transition(id, 'reclaimed', 'TTL reclamation', 'gc');
        bytesFreed += ctx.sizeBytes;
        reclaimed++;
        continue;
      }

      // State-based transitions
      switch (ctx.state) {
        case 'embryonic':
          // Embryonic contexts that were never activated
          if (age > this.policy.idleThresholdMs) {
            this.transition(id, 'reclaimed', 'Embryonic timeout', 'gc');
            bytesFreed += ctx.sizeBytes;
            reclaimed++;
          }
          break;

        case 'active':
          // Active → Idle if not accessed
          if (age > this.policy.idleThresholdMs) {
            this.transition(id, 'idle', 'Idle timeout', 'gc');
          }
          break;

        case 'idle':
          // Idle → Hibernating or Orphaned
          if (!reachable.has(id) && this.refGraph.getStrongRefCount(id) === 0) {
            this.transition(id, 'orphaned', 'No references found', 'gc');
          } else if (age > this.policy.hibernationThresholdMs) {
            this.transition(id, 'hibernating', 'Extended idle', 'gc');
            hibernated++;
          }
          break;

        case 'hibernating':
          // Hibernating → Fossilized after extended time
          if (stateAge > this.policy.hibernationThresholdMs * 2) {
            this.transition(id, 'fossilized', 'Deep hibernation', 'gc');
            fossilized++;
          }
          break;

        case 'orphaned':
          // Orphaned → Reclaim
          const finErrors = await this.finalizerQueue.runFinalizers(id, ctx);
          errors.push(...finErrors);
          this.transition(id, 'reclaimed', 'Orphan collection', 'gc');
          bytesFreed += ctx.sizeBytes;
          reclaimed++;
          break;

        case 'draining':
          // Draining → Cooling
          if (stateAge > this.policy.coolingPeriodMs / 2) {
            this.transition(id, 'cooling', 'Drain complete', 'gc');
          }
          break;

        case 'cooling':
          // Cooling → Reclaim after cooling period
          if (stateAge > this.policy.coolingPeriodMs) {
            const finErrs = await this.finalizerQueue.runFinalizers(id, ctx);
            errors.push(...finErrs);
            this.transition(id, 'reclaimed', 'Cooling period expired', 'gc');
            bytesFreed += ctx.sizeBytes;
            reclaimed++;
          }
          break;

        case 'leaked':
          // Leaked → Reclaim in emergency or major
          if (type === 'emergency' || type === 'major') {
            const finErrs = await this.finalizerQueue.runFinalizers(id, ctx);
            errors.push(...finErrs);
            this.transition(id, 'reclaimed', 'Leak reclamation', 'gc');
            bytesFreed += ctx.sizeBytes;
            reclaimed++;
          }
          break;

        case 'fossilized':
          // Fossilized → Reclaim in emergency only
          if (type === 'emergency') {
            this.transition(id, 'reclaimed', 'Emergency defossilization', 'gc');
            bytesFreed += ctx.compressedSizeBytes || ctx.sizeBytes;
            reclaimed++;
          }
          break;
      }

      // Generation promotion
      ctx.generation++;
      if (this.generations.isYoung(id) && this.generations.shouldPromote(ctx.generation)) {
        this.generations.promote(id);
        promoted++;
      }
    }

    // Cycle detection — break cycles that have no external strong refs
    if (type === 'major' || type === 'emergency') {
      const cycles = this.refGraph.findCycles();
      for (const cycle of cycles) {
        const hasExternalRef = cycle.some(id => reachable.has(id));
        if (!hasExternalRef) {
          for (const id of cycle) {
            const ctx = this.contexts.get(id);
            if (ctx && ctx.state !== 'reclaimed' && !ctx.pinned) {
              this.transition(id, 'orphaned', 'Cycle broken', 'gc');
              const finErrs = await this.finalizerQueue.runFinalizers(id, ctx);
              errors.push(...finErrs);
              this.transition(id, 'reclaimed', 'Cyclic garbage', 'gc');
              bytesFreed += ctx.sizeBytes;
              reclaimed++;
              examined++;
            }
          }
        }
      }
    }

    // Leak detection
    if (type === 'major' || type === 'emergency') {
      const leakReport = this.leakDetector.analyze(this.contexts, this.refGraph, this.rootIds);
      for (const suspect of leakReport.suspects) {
        if (suspect.suggestedAction === 'reclaim') {
          const ctx = this.contexts.get(suspect.contextId);
          if (ctx && ctx.state !== 'reclaimed') {
            this.transition(suspect.contextId, 'leaked', suspect.reason, 'gc');
            this.emit({
              type: 'leak_detected',
              contextId: suspect.contextId,
              timestamp: Date.now(),
              data: { confidence: suspect.confidence, reason: suspect.reason },
            });
          }
        }
      }
    }

    // Compaction
    if (type === 'major' && this.policy.compactOnMajor) {
      const survivors = [...this.contexts.values()].filter(
        c => c.state !== 'reclaimed' && !c.pinned
      );
      const compResult = this.compactionEngine.compact(survivors);
      bytesCompacted = compResult.beforeBytes - compResult.afterBytes;
    }

    const completedAt = Date.now();
    const result: GCResult = {
      cycle: cycleNum,
      type,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      examined,
      reclaimed,
      hibernated,
      fossilized,
      promoted,
      bytesFreed,
      bytesCompacted,
      survivors: this.contexts.size - reclaimed,
      errors,
    };

    this.gcHistory.push(result);
    if (this.gcHistory.length > 100) this.gcHistory.shift();

    this.emit({
      type: 'gc_complete',
      timestamp: completedAt,
      data: result,
    });

    return result;
  }

  // ── Auto-GC (run on allocation pressure) ──

  async autoCollect(): Promise<GCResult | null> {
    if (this.totalBytesAllocated >= this.policy.maxTotalBytes) {
      return this.collectEmergency();
    }
    if (this.contexts.size >= this.policy.highWaterMark) {
      return this.collectMajor();
    }
    if (this.generations.youngCount > this.policy.highWaterMark * 0.3) {
      return this.collectMinor();
    }
    return null;
  }

  // ── Queries ──

  get(contextId: string): ContextHandle | undefined {
    return this.contexts.get(contextId);
  }

  getByState(state: ContextState): ContextHandle[] {
    return [...this.contexts.values()].filter(c => c.state === state);
  }

  getByTag(tag: string): ContextHandle[] {
    return [...this.contexts.values()].filter(c => c.tags.has(tag));
  }

  getChildren(contextId: string): ContextHandle[] {
    const ctx = this.contexts.get(contextId);
    if (!ctx) return [];
    return [...ctx.childIds]
      .map(id => this.contexts.get(id))
      .filter((c): c is ContextHandle => c !== undefined);
  }

  stats(): {
    total: number;
    byState: Record<ContextState, number>;
    youngGen: number;
    oldGen: number;
    totalBytes: number;
    maxBytes: number;
    pressure: number;
    gcCycles: number;
    lastGC: GCResult | null;
  } {
    const byState: Record<ContextState, number> = {
      embryonic: 0, active: 0, idle: 0, hibernating: 0,
      draining: 0, cooling: 0, orphaned: 0, fossilized: 0,
      leaked: 0, reclaimed: 0,
    };

    for (const ctx of this.contexts.values()) {
      byState[ctx.state]++;
    }

    return {
      total: this.contexts.size,
      byState,
      youngGen: this.generations.youngCount,
      oldGen: this.generations.oldCount,
      totalBytes: this.totalBytesAllocated,
      maxBytes: this.policy.maxTotalBytes,
      pressure: this.totalBytesAllocated / this.policy.maxTotalBytes,
      gcCycles: this.gcCycleCount,
      lastGC: this.gcHistory.length > 0 ? this.gcHistory[this.gcHistory.length - 1] : null,
    };
  }

  // ── Event System ──

  on(listener: LifecycleListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: LifecycleEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listeners should not throw
      }
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Pre-configured policies for common scenarios.
 */
export const Policies = {
  /** Fast-paced collaboration — aggressive collection, short lifetimes */
  realtime: (): Partial<GCPolicy> => ({
    name: 'realtime',
    idleThresholdMs: 30_000,
    coolingPeriodMs: 10_000,
    hibernationThresholdMs: 120_000,
    highWaterMark: 500,
    lowWaterMark: 300,
    tenuredGeneration: 5,
    maxTotalBytes: 50 * 1024 * 1024,
    compactOnMajor: false,
  }),

  /** Long-running research — generous lifetimes, deep hibernation */
  research: (): Partial<GCPolicy> => ({
    name: 'research',
    idleThresholdMs: 1_800_000,
    coolingPeriodMs: 300_000,
    hibernationThresholdMs: 7_200_000,
    highWaterMark: 5000,
    lowWaterMark: 4000,
    tenuredGeneration: 2,
    maxTotalBytes: 500 * 1024 * 1024,
    compactOnMajor: true,
  }),

  /** Memory-constrained environments */
  embedded: (): Partial<GCPolicy> => ({
    name: 'embedded',
    idleThresholdMs: 15_000,
    coolingPeriodMs: 5_000,
    hibernationThresholdMs: 60_000,
    highWaterMark: 100,
    lowWaterMark: 50,
    tenuredGeneration: 10,
    maxTotalBytes: 10 * 1024 * 1024,
    compactOnMajor: true,
  }),
};

export default ContextLifecycleManager;
