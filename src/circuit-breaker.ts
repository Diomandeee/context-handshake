/**
 * Circuit Breaker for Context Handshakes
 * ========================================
 * 
 * Like circuit breakers in electrical systems protect against overload,
 * and in microservices protect against cascading failures — this module
 * protects agents from wasting resources on doomed collaborations.
 * 
 * When a collaboration partner consistently fails (timeouts, alignment
 * failures, trust violations), the circuit "opens" and short-circuits
 * future attempts. After a cooling period, it "half-opens" to probe
 * whether the partner has recovered.
 * 
 * States:
 *   CLOSED  → Normal operation, handshakes proceed
 *   OPEN    → Failures exceeded threshold, handshakes rejected immediately
 *   HALF_OPEN → Cooling period elapsed, allowing a single probe handshake
 * 
 * TCP Analogy: Like TCP's exponential backoff on retransmission failures,
 * but at the collaboration level. When RST packets keep coming, stop trying.
 * 
 * Instance: 28 | Generation: 6 | Priority: 1
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export enum FailureReason {
  TIMEOUT = 'TIMEOUT',
  ALIGNMENT_FAILURE = 'ALIGNMENT_FAILURE',
  TRUST_VIOLATION = 'TRUST_VIOLATION',
  CONTEXT_MISMATCH = 'CONTEXT_MISMATCH',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  RESOURCE_EXHAUSTION = 'RESOURCE_EXHAUSTION',
  AUTHENTICATION_FAILURE = 'AUTHENTICATION_FAILURE',
  HANDSHAKE_REJECTED = 'HANDSHAKE_REJECTED',
}

export interface FailureRecord {
  readonly timestamp: number;
  readonly reason: FailureReason;
  readonly agentId: string;
  readonly severity: number; // 1-10
  readonly context?: string;
  readonly recoverable: boolean;
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  readonly failureThreshold: number;
  /** Time window (ms) in which failures are counted */
  readonly failureWindowMs: number;
  /** How long the circuit stays open before half-opening (ms) */
  readonly coolingPeriodMs: number;
  /** Max cooling period after exponential backoff (ms) */
  readonly maxCoolingPeriodMs: number;
  /** Multiplier for exponential backoff on repeated openings */
  readonly backoffMultiplier: number;
  /** Number of successful probes needed to close from half-open */
  readonly successThreshold: number;
  /** Weighted failure scoring — severity multiplier */
  readonly severityWeighted: boolean;
  /** Weighted threshold when severity scoring is enabled */
  readonly weightedThreshold: number;
  /** Auto-close after this duration even without probes (ms), 0 = disabled */
  readonly autoCloseMs: number;
  /** Per-reason failure weights (optional overrides) */
  readonly reasonWeights: Partial<Record<FailureReason, number>>;
}

export interface CircuitSnapshot {
  readonly agentId: string;
  readonly state: CircuitState;
  readonly failureCount: number;
  readonly weightedScore: number;
  readonly successCount: number;
  readonly lastFailure: FailureRecord | null;
  readonly lastSuccess: number | null;
  readonly openedAt: number | null;
  readonly currentCoolingPeriodMs: number;
  readonly consecutiveOpenings: number;
  readonly totalHandshakes: number;
  readonly totalFailures: number;
  readonly totalSuccesses: number;
  readonly uptimeRatio: number;
}

export interface CircuitEvent {
  readonly type: 'state_change' | 'failure_recorded' | 'success_recorded' | 'probe_allowed' | 'circuit_reset';
  readonly agentId: string;
  readonly timestamp: number;
  readonly previousState?: CircuitState;
  readonly newState?: CircuitState;
  readonly details?: Record<string, unknown>;
}

export type CircuitEventListener = (event: CircuitEvent) => void;

// ─── Default Config ─────────────────────────────────────────────────────────

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureWindowMs: 60_000, // 1 minute
  coolingPeriodMs: 30_000, // 30 seconds
  maxCoolingPeriodMs: 600_000, // 10 minutes
  backoffMultiplier: 2.0,
  successThreshold: 2,
  severityWeighted: true,
  weightedThreshold: 25, // sum of severity scores
  autoCloseMs: 0,
  reasonWeights: {
    [FailureReason.TRUST_VIOLATION]: 3.0,
    [FailureReason.AUTHENTICATION_FAILURE]: 2.5,
    [FailureReason.ALIGNMENT_FAILURE]: 1.5,
    [FailureReason.TIMEOUT]: 1.0,
    [FailureReason.CONTEXT_MISMATCH]: 1.2,
    [FailureReason.PROTOCOL_ERROR]: 1.0,
    [FailureReason.RESOURCE_EXHAUSTION]: 1.8,
    [FailureReason.HANDSHAKE_REJECTED]: 0.8,
  },
};

// ─── Per-Agent Circuit ──────────────────────────────────────────────────────

class AgentCircuit {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: FailureRecord[] = [];
  private successCount = 0;
  private consecutiveOpenings = 0;
  private currentCoolingPeriodMs: number;
  private openedAt: number | null = null;
  private lastSuccess: number | null = null;

  // Lifetime stats
  private totalHandshakes = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private closedSince: number;

  constructor(
    readonly agentId: string,
    private readonly config: CircuitBreakerConfig,
    private readonly emitEvent: (event: CircuitEvent) => void,
    private readonly now: () => number = Date.now,
  ) {
    this.currentCoolingPeriodMs = config.coolingPeriodMs;
    this.closedSince = this.now();
  }

  // ── Public API ──

  /**
   * Check if a handshake should be allowed.
   * Returns true if allowed, false if circuit is open.
   */
  allowHandshake(): boolean {
    this.totalHandshakes++;
    this.maybeTransition();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.HALF_OPEN:
        this.emitEvent({
          type: 'probe_allowed',
          agentId: this.agentId,
          timestamp: this.now(),
          details: { consecutiveOpenings: this.consecutiveOpenings },
        });
        return true;

      case CircuitState.OPEN:
        return false;
    }
  }

  /**
   * Record a successful handshake/collaboration.
   */
  recordSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccess = this.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      this.emitEvent({
        type: 'success_recorded',
        agentId: this.agentId,
        timestamp: this.now(),
        details: {
          successCount: this.successCount,
          threshold: this.config.successThreshold,
        },
      });

      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.consecutiveOpenings = 0;
        this.currentCoolingPeriodMs = this.config.coolingPeriodMs;
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.emitEvent({
        type: 'success_recorded',
        agentId: this.agentId,
        timestamp: this.now(),
      });
    }
  }

  /**
   * Record a failure. May trigger circuit opening.
   */
  recordFailure(reason: FailureReason, severity: number = 5, context?: string): void {
    const record: FailureRecord = {
      timestamp: this.now(),
      reason,
      agentId: this.agentId,
      severity: Math.max(1, Math.min(10, severity)),
      context,
      recoverable: this.isRecoverable(reason),
    };

    this.failures.push(record);
    this.totalFailures++;

    this.emitEvent({
      type: 'failure_recorded',
      agentId: this.agentId,
      timestamp: record.timestamp,
      details: { reason, severity, recoverable: record.recoverable },
    });

    // Half-open → any failure reopens immediately
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount = 0;
      this.transitionTo(CircuitState.OPEN);
      return;
    }

    // Closed → check if threshold exceeded
    if (this.state === CircuitState.CLOSED) {
      this.pruneOldFailures();

      if (this.shouldOpen()) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Force-reset the circuit to closed state.
   */
  reset(): void {
    const prev = this.state;
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.successCount = 0;
    this.consecutiveOpenings = 0;
    this.currentCoolingPeriodMs = this.config.coolingPeriodMs;
    this.openedAt = null;
    this.closedSince = this.now();

    this.emitEvent({
      type: 'circuit_reset',
      agentId: this.agentId,
      timestamp: this.now(),
      previousState: prev,
      newState: CircuitState.CLOSED,
    });
  }

  /**
   * Get a snapshot of the circuit's current state.
   */
  snapshot(): CircuitSnapshot {
    this.maybeTransition();

    const totalTime = this.now() - this.closedSince;
    const openTime = this.openedAt
      ? (this.state === CircuitState.OPEN ? this.now() - this.openedAt : 0)
      : 0;

    return {
      agentId: this.agentId,
      state: this.state,
      failureCount: this.recentFailures().length,
      weightedScore: this.weightedFailureScore(),
      successCount: this.successCount,
      lastFailure: this.failures.length > 0 ? this.failures[this.failures.length - 1] : null,
      lastSuccess: this.lastSuccess,
      openedAt: this.openedAt,
      currentCoolingPeriodMs: this.currentCoolingPeriodMs,
      consecutiveOpenings: this.consecutiveOpenings,
      totalHandshakes: this.totalHandshakes,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      uptimeRatio: totalTime > 0 ? Math.max(0, 1 - openTime / totalTime) : 1,
    };
  }

  // ── Internal ──

  private maybeTransition(): void {
    if (this.state === CircuitState.OPEN && this.openedAt) {
      const elapsed = this.now() - this.openedAt;

      // Auto-close (if enabled) takes priority
      if (this.config.autoCloseMs > 0 && elapsed >= this.config.autoCloseMs) {
        this.transitionTo(CircuitState.CLOSED);
        this.consecutiveOpenings = 0;
        this.currentCoolingPeriodMs = this.config.coolingPeriodMs;
        return;
      }

      // Cooling period → half-open
      if (elapsed >= this.currentCoolingPeriodMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const prev = this.state;
    if (prev === newState) return;

    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.openedAt = this.now();
      this.consecutiveOpenings++;
      // Exponential backoff on cooling period
      this.currentCoolingPeriodMs = Math.min(
        this.config.coolingPeriodMs * Math.pow(this.config.backoffMultiplier, this.consecutiveOpenings - 1),
        this.config.maxCoolingPeriodMs,
      );
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    } else if (newState === CircuitState.CLOSED) {
      this.openedAt = null;
      this.failures = [];
      this.closedSince = this.now();
    }

    this.emitEvent({
      type: 'state_change',
      agentId: this.agentId,
      timestamp: this.now(),
      previousState: prev,
      newState,
      details: {
        coolingPeriodMs: this.currentCoolingPeriodMs,
        consecutiveOpenings: this.consecutiveOpenings,
      },
    });
  }

  private shouldOpen(): boolean {
    const recent = this.recentFailures();

    // Simple count threshold
    if (recent.length >= this.config.failureThreshold) return true;

    // Weighted severity threshold
    if (this.config.severityWeighted) {
      const score = this.weightedFailureScore();
      if (score >= this.config.weightedThreshold) return true;
    }

    // Immediate open on non-recoverable trust violations
    const hasUnrecoverable = recent.some(
      f => !f.recoverable && f.severity >= 8,
    );
    if (hasUnrecoverable) return true;

    return false;
  }

  private weightedFailureScore(): number {
    return this.recentFailures().reduce((sum, f) => {
      const reasonWeight = this.config.reasonWeights[f.reason] ?? 1.0;
      return sum + f.severity * reasonWeight;
    }, 0);
  }

  private recentFailures(): FailureRecord[] {
    const cutoff = this.now() - this.config.failureWindowMs;
    return this.failures.filter(f => f.timestamp >= cutoff);
  }

  private pruneOldFailures(): void {
    const cutoff = this.now() - this.config.failureWindowMs;
    this.failures = this.failures.filter(f => f.timestamp >= cutoff);
  }

  private isRecoverable(reason: FailureReason): boolean {
    switch (reason) {
      case FailureReason.TIMEOUT:
      case FailureReason.CONTEXT_MISMATCH:
      case FailureReason.RESOURCE_EXHAUSTION:
      case FailureReason.HANDSHAKE_REJECTED:
        return true;
      case FailureReason.TRUST_VIOLATION:
      case FailureReason.AUTHENTICATION_FAILURE:
        return false;
      case FailureReason.ALIGNMENT_FAILURE:
      case FailureReason.PROTOCOL_ERROR:
        return true; // usually recoverable with retry
    }
  }
}

// ─── Circuit Breaker Manager ────────────────────────────────────────────────

/**
 * Manages circuit breakers across all collaboration partners.
 * 
 * Usage:
 *   const breaker = new CircuitBreakerManager();
 *   
 *   // Before attempting handshake
 *   if (!breaker.allowHandshake('agent-xyz')) {
 *     // Circuit open — skip this agent
 *     return;
 *   }
 *   
 *   try {
 *     await performHandshake('agent-xyz');
 *     breaker.recordSuccess('agent-xyz');
 *   } catch (err) {
 *     breaker.recordFailure('agent-xyz', FailureReason.TIMEOUT, 5);
 *   }
 */
export class CircuitBreakerManager {
  private circuits: Map<string, AgentCircuit> = new Map();
  private listeners: CircuitEventListener[] = [];
  private readonly config: CircuitBreakerConfig;
  private readonly nowFn: () => number;

  constructor(config?: Partial<CircuitBreakerConfig>, now?: () => number) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.nowFn = now ?? Date.now;
  }

  // ── Core API ──

  allowHandshake(agentId: string): boolean {
    return this.getOrCreate(agentId).allowHandshake();
  }

  recordSuccess(agentId: string): void {
    this.getOrCreate(agentId).recordSuccess();
  }

  recordFailure(
    agentId: string,
    reason: FailureReason,
    severity: number = 5,
    context?: string,
  ): void {
    this.getOrCreate(agentId).recordFailure(reason, severity, context);
  }

  reset(agentId: string): void {
    this.getOrCreate(agentId).reset();
  }

  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }

  // ── Observability ──

  snapshot(agentId: string): CircuitSnapshot {
    return this.getOrCreate(agentId).snapshot();
  }

  snapshotAll(): CircuitSnapshot[] {
    return Array.from(this.circuits.values()).map(c => c.snapshot());
  }

  /**
   * Get agents grouped by circuit state.
   */
  healthReport(): Record<CircuitState, string[]> {
    const report: Record<CircuitState, string[]> = {
      [CircuitState.CLOSED]: [],
      [CircuitState.OPEN]: [],
      [CircuitState.HALF_OPEN]: [],
    };

    for (const circuit of this.circuits.values()) {
      const snap = circuit.snapshot();
      report[snap.state].push(snap.agentId);
    }

    return report;
  }

  /**
   * Get agents that are currently blocked (circuit open).
   */
  blockedAgents(): string[] {
    return this.snapshotAll()
      .filter(s => s.state === CircuitState.OPEN)
      .map(s => s.agentId);
  }

  /**
   * Get agents with degraded connections (half-open or high failure rate).
   */
  degradedAgents(): string[] {
    return this.snapshotAll()
      .filter(s => s.state === CircuitState.HALF_OPEN || s.uptimeRatio < 0.9)
      .map(s => s.agentId);
  }

  // ── Event System ──

  onEvent(listener: CircuitEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  // ── Bulk Operations ──

  /**
   * Record a failure across multiple agents (e.g., network-wide outage).
   */
  recordBulkFailure(
    agentIds: string[],
    reason: FailureReason,
    severity: number = 5,
    context?: string,
  ): void {
    for (const id of agentIds) {
      this.recordFailure(id, reason, severity, context);
    }
  }

  /**
   * Remove a circuit entirely (agent decommissioned).
   */
  remove(agentId: string): boolean {
    return this.circuits.delete(agentId);
  }

  /**
   * Export all circuit state for persistence.
   */
  exportState(): Map<string, CircuitSnapshot> {
    const state = new Map<string, CircuitSnapshot>();
    for (const [id, circuit] of this.circuits) {
      state.set(id, circuit.snapshot());
    }
    return state;
  }

  // ── Internal ──

  private getOrCreate(agentId: string): AgentCircuit {
    let circuit = this.circuits.get(agentId);
    if (!circuit) {
      circuit = new AgentCircuit(
        agentId,
        this.config,
        (event) => this.emit(event),
        this.nowFn,
      );
      this.circuits.set(agentId, circuit);
    }
    return circuit;
  }

  private emit(event: CircuitEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Don't let listener errors break the circuit breaker
      }
    }
  }
}

// ─── Circuit Breaker Middleware ──────────────────────────────────────────────

/**
 * Higher-order function that wraps a handshake function with circuit breaking.
 * 
 * Usage:
 *   const safeHandshake = withCircuitBreaker(
 *     breaker,
 *     async (agentId) => await handshake(agentId),
 *     (error) => classifyError(error),
 *   );
 *   
 *   const result = await safeHandshake('agent-xyz');
 *   if (result.circuitOpen) {
 *     // Partner is blocked
 *   }
 */
export interface CircuitBreakerResult<T> {
  success: boolean;
  circuitOpen: boolean;
  value?: T;
  error?: Error;
  agentId: string;
  circuitState: CircuitState;
}

export function withCircuitBreaker<T>(
  manager: CircuitBreakerManager,
  fn: (agentId: string) => Promise<T>,
  classifyError: (error: Error) => { reason: FailureReason; severity: number },
): (agentId: string) => Promise<CircuitBreakerResult<T>> {
  return async (agentId: string): Promise<CircuitBreakerResult<T>> => {
    if (!manager.allowHandshake(agentId)) {
      return {
        success: false,
        circuitOpen: true,
        agentId,
        circuitState: manager.snapshot(agentId).state,
      };
    }

    try {
      const value = await fn(agentId);
      manager.recordSuccess(agentId);
      return {
        success: true,
        circuitOpen: false,
        value,
        agentId,
        circuitState: manager.snapshot(agentId).state,
      };
    } catch (error) {
      const { reason, severity } = classifyError(error as Error);
      manager.recordFailure(agentId, reason, severity, (error as Error).message);
      return {
        success: false,
        circuitOpen: false,
        error: error as Error,
        agentId,
        circuitState: manager.snapshot(agentId).state,
      };
    }
  };
}

// ─── Adaptive Circuit Breaker ───────────────────────────────────────────────

/**
 * A circuit breaker that adapts its thresholds based on observed patterns.
 * 
 * Like TCP's adaptive retransmission timeout (RTO), this adjusts sensitivity
 * based on the agent's historical reliability.
 * 
 * Reliable agents get more lenient thresholds (they deserve benefit of doubt).
 * Unreliable agents get stricter thresholds (fool me twice...).
 */
export class AdaptiveCircuitBreakerManager extends CircuitBreakerManager {
  private reliabilityScores: Map<string, number> = new Map();
  private readonly baseConfig: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>, now?: () => number) {
    super(config, now);
    this.baseConfig = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update reliability score based on observed behavior.
   * Score: 0.0 (completely unreliable) to 1.0 (perfectly reliable)
   */
  updateReliability(agentId: string): number {
    const snap = this.snapshot(agentId);
    const total = snap.totalSuccesses + snap.totalFailures;

    if (total === 0) return 0.5; // Unknown → neutral

    // Exponentially weighted moving average favoring recent results
    const rawReliability = snap.totalSuccesses / total;
    const existing = this.reliabilityScores.get(agentId) ?? 0.5;
    const alpha = 0.3; // Learning rate
    const score = alpha * rawReliability + (1 - alpha) * existing;

    this.reliabilityScores.set(agentId, score);
    return score;
  }

  /**
   * Get adaptive thresholds for an agent based on their reliability.
   */
  getAdaptiveThresholds(agentId: string): {
    failureThreshold: number;
    coolingPeriodMs: number;
    weightedThreshold: number;
  } {
    const reliability = this.reliabilityScores.get(agentId) ?? 0.5;

    // Reliable agents: higher thresholds (more tolerant)
    // Unreliable agents: lower thresholds (less tolerant)
    const reliabilityFactor = 0.5 + reliability; // 0.5 to 1.5

    return {
      failureThreshold: Math.round(this.baseConfig.failureThreshold * reliabilityFactor),
      coolingPeriodMs: Math.round(this.baseConfig.coolingPeriodMs / reliabilityFactor),
      weightedThreshold: Math.round(this.baseConfig.weightedThreshold * reliabilityFactor),
    };
  }

  /**
   * Get reliability rankings across all known agents.
   */
  reliabilityRankings(): Array<{ agentId: string; score: number; state: CircuitState }> {
    const rankings: Array<{ agentId: string; score: number; state: CircuitState }> = [];

    for (const [agentId, score] of this.reliabilityScores) {
      rankings.push({
        agentId,
        score,
        state: this.snapshot(agentId).state,
      });
    }

    return rankings.sort((a, b) => b.score - a.score);
  }
}

// ─── Agent Selection with Circuit Awareness ─────────────────────────────────

/**
 * Select the best collaboration partner from a pool, considering circuit state.
 * 
 * Like a load balancer that routes around unhealthy backends,
 * this selects the best available agent for collaboration.
 */
export function selectBestAgent(
  manager: CircuitBreakerManager,
  candidates: string[],
  preferences?: {
    preferLowLatency?: boolean;
    preferHighUptime?: boolean;
    excludeHalfOpen?: boolean;
  },
): string | null {
  const available = candidates
    .map(id => manager.snapshot(id))
    .filter(snap => {
      if (snap.state === CircuitState.OPEN) return false;
      if (preferences?.excludeHalfOpen && snap.state === CircuitState.HALF_OPEN) return false;
      return true;
    });

  if (available.length === 0) return null;

  // Score candidates
  const scored = available.map(snap => {
    let score = 0;

    // Base: prefer closed circuits
    if (snap.state === CircuitState.CLOSED) score += 100;
    if (snap.state === CircuitState.HALF_OPEN) score += 20;

    // Uptime ratio bonus
    if (preferences?.preferHighUptime) {
      score += snap.uptimeRatio * 50;
    }

    // Fewer recent failures = better
    score -= snap.failureCount * 10;

    // Fewer consecutive openings = more stable
    score -= snap.consecutiveOpenings * 15;

    return { agentId: snap.agentId, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.agentId ?? null;
}
