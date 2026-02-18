/**
 * Streaming Handshakes - Gen 8 Evolution
 * 
 * Progressive context synchronization for large mental models.
 * Instead of sending entire context at once, stream chunks with
 * real-time alignment feedback.
 * 
 * HEF Task: task_20260201060247_ed139e
 * Instance: inst_20260131082143_957
 * Generation: 7 → 8
 * 
 * Evolution Techniques: G03 (SCAMPER-Adapt), G08 (Combine streaming + handshake),
 * R09 (Optimize), thk:fractal (self-similar chunks)
 */

import { AgentContext, AlignmentResult, MergedModel, MentalModel } from './protocol';

// ============================================================================
// Types
// ============================================================================

export interface StreamChunk {
  chunkId: string;
  sequenceNumber: number;
  totalChunks: number;
  domain: ContextDomain;
  content: ChunkContent;
  priority: 'critical' | 'important' | 'supplementary';
  checksum: string;
}

export type ContextDomain = 
  | 'capabilities'
  | 'task_understanding'
  | 'key_concepts'
  | 'assumptions'
  | 'constraints'
  | 'domain_knowledge'
  | 'preferences'
  | 'history';

export interface ChunkContent {
  type: 'full' | 'delta' | 'reference';
  data: Record<string, unknown>;
  dependencies?: string[]; // chunk IDs this depends on
}

export interface StreamSession {
  sessionId: string;
  initiatorId: string;
  responderId: string;
  startedAt: Date;
  chunks: Map<string, StreamChunk>;
  alignmentHistory: AlignmentSnapshot[];
  status: StreamStatus;
  bandwidth: BandwidthConfig;
}

export type StreamStatus = 
  | 'initializing'
  | 'streaming'
  | 'awaiting_ack'
  | 'synchronized'
  | 'degraded'
  | 'failed';

export interface AlignmentSnapshot {
  timestamp: Date;
  chunksProcessed: number;
  cumulativeScore: number;
  domainScores: Map<ContextDomain, number>;
  divergences: DivergenceFlag[];
}

export interface DivergenceFlag {
  domain: ContextDomain;
  severity: 'minor' | 'moderate' | 'critical';
  description: string;
  suggestedResolution?: string;
}

export interface BandwidthConfig {
  maxChunkSize: number;       // bytes
  throttleMs: number;         // delay between chunks
  priorityOrder: ContextDomain[];
  earlyTermination: {
    enabled: boolean;
    minScore: number;        // stop if alignment drops below
    minChunks: number;       // process at least this many first
  };
}

export interface AlignmentScore {
  overall: number;
  conceptMatch: number;
  assumptionAlign: number;
  goalOverlap: number;
  capabilityComplement: number;
}

export interface StreamHandshakeResult {
  success: boolean;
  session: StreamSession;
  finalAlignment: AlignmentScore;
  mergedModel?: StreamMergedModel;
  chunksTransferred: number;
  duration: number;
  earlyTerminated: boolean;
}

export interface StreamMergedModel {
  sharedConcepts: Record<string, unknown>;
  combinedCapabilities: string[];
  reconciledAssumptions: string[];
  taskUnderstanding: string;
  divergenceResolutions: Array<{ domain: string; resolution: string }>;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_BANDWIDTH: BandwidthConfig = {
  maxChunkSize: 4096,
  throttleMs: 50,
  priorityOrder: [
    'capabilities',
    'task_understanding',
    'key_concepts',
    'assumptions',
    'constraints',
    'domain_knowledge',
    'preferences',
    'history'
  ],
  earlyTermination: {
    enabled: true,
    minScore: 0.3,
    minChunks: 3
  }
};

// ============================================================================
// Context Chunker
// ============================================================================

export class ContextChunker {
  private maxChunkSize: number;
  
  constructor(maxChunkSize: number = DEFAULT_BANDWIDTH.maxChunkSize) {
    this.maxChunkSize = maxChunkSize;
  }
  
  /**
   * Split a context offer into streamable chunks
   */
  chunk(context: AgentContext, priorityOrder: ContextDomain[]): StreamChunk[] {
    const chunks: StreamChunk[] = [];
    let sequenceNumber = 0;
    
    // Extract domains in priority order
    for (const domain of priorityOrder) {
      const domainData = this.extractDomain(context, domain);
      if (!domainData || Object.keys(domainData).length === 0) continue;
      
      const domainChunks = this.splitDomain(domain, domainData, sequenceNumber);
      chunks.push(...domainChunks);
      sequenceNumber += domainChunks.length;
    }
    
    // Update total count
    const totalChunks = chunks.length;
    chunks.forEach(c => c.totalChunks = totalChunks);
    
    return chunks;
  }
  
  private extractDomain(context: AgentContext, domain: ContextDomain): Record<string, unknown> | null {
    switch (domain) {
      case 'capabilities':
        return { items: context.capabilities || [] };
      case 'task_understanding':
        return { content: context.mentalModel?.taskUnderstanding };
      case 'key_concepts':
        return context.mentalModel?.keyConcepts || {};
      case 'assumptions':
        return { items: context.mentalModel?.assumptions || [] };
      case 'constraints':
        return { items: context.mentalModel?.constraints || [] };
      case 'preferences':
        return { style: context.preferredStyle };
      default:
        return null;
    }
  }
  
  private splitDomain(
    domain: ContextDomain,
    data: Record<string, unknown>,
    startSequence: number
  ): StreamChunk[] {
    const serialized = JSON.stringify(data);
    
    // If fits in one chunk, return as-is
    if (serialized.length <= this.maxChunkSize) {
      return [{
        chunkId: `${domain}_0`,
        sequenceNumber: startSequence,
        totalChunks: -1, // placeholder
        domain,
        content: { type: 'full', data },
        priority: this.getPriority(domain),
        checksum: this.computeChecksum(serialized)
      }];
    }
    
    // Split into multiple chunks with delta references
    const chunks: StreamChunk[] = [];
    const entries = Object.entries(data);
    let currentBatch: Record<string, unknown> = {};
    let currentSize = 0;
    let chunkIndex = 0;
    
    for (const [key, value] of entries) {
      const entrySize = JSON.stringify({ [key]: value }).length;
      
      if (currentSize + entrySize > this.maxChunkSize && currentSize > 0) {
        // Emit current batch
        chunks.push(this.createChunk(
          domain,
          chunkIndex,
          startSequence + chunkIndex,
          currentBatch,
          chunkIndex === 0 ? 'full' : 'delta',
          chunkIndex > 0 ? [`${domain}_${chunkIndex - 1}`] : undefined
        ));
        chunkIndex++;
        currentBatch = {};
        currentSize = 0;
      }
      
      currentBatch[key] = value;
      currentSize += entrySize;
    }
    
    // Emit final batch
    if (Object.keys(currentBatch).length > 0) {
      chunks.push(this.createChunk(
        domain,
        chunkIndex,
        startSequence + chunkIndex,
        currentBatch,
        chunkIndex === 0 ? 'full' : 'delta',
        chunkIndex > 0 ? [`${domain}_${chunkIndex - 1}`] : undefined
      ));
    }
    
    return chunks;
  }
  
  private createChunk(
    domain: ContextDomain,
    index: number,
    sequence: number,
    data: Record<string, unknown>,
    type: 'full' | 'delta',
    dependencies?: string[]
  ): StreamChunk {
    const serialized = JSON.stringify(data);
    return {
      chunkId: `${domain}_${index}`,
      sequenceNumber: sequence,
      totalChunks: -1,
      domain,
      content: { type, data, dependencies },
      priority: this.getPriority(domain),
      checksum: this.computeChecksum(serialized)
    };
  }
  
  private getPriority(domain: ContextDomain): StreamChunk['priority'] {
    const critical = ['capabilities', 'task_understanding'];
    const important = ['key_concepts', 'assumptions', 'constraints'];
    
    if (critical.includes(domain)) return 'critical';
    if (important.includes(domain)) return 'important';
    return 'supplementary';
  }
  
  private computeChecksum(data: string): string {
    // Simple hash for demo (use crypto.createHash in production)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

// ============================================================================
// Streaming Handshake Engine
// ============================================================================

export class StreamingHandshake {
  private chunker: ContextChunker;
  private bandwidth: BandwidthConfig;
  private sessions: Map<string, StreamSession> = new Map();
  
  constructor(config: Partial<BandwidthConfig> = {}) {
    this.bandwidth = { ...DEFAULT_BANDWIDTH, ...config };
    this.chunker = new ContextChunker(this.bandwidth.maxChunkSize);
  }
  
  /**
   * Initiate a streaming handshake (SYN with progressive chunks)
   */
  async initiateStream(
    initiatorId: string,
    responderId: string,
    context: AgentContext,
    onProgress?: (snapshot: AlignmentSnapshot) => void
  ): Promise<StreamHandshakeResult> {
    const startTime = Date.now();
    
    // Create session
    const session: StreamSession = {
      sessionId: `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      initiatorId,
      responderId,
      startedAt: new Date(),
      chunks: new Map(),
      alignmentHistory: [],
      status: 'initializing',
      bandwidth: this.bandwidth
    };
    
    this.sessions.set(session.sessionId, session);
    
    // Chunk the context
    const chunks = this.chunker.chunk(context, this.bandwidth.priorityOrder);
    console.log(`[StreamHandshake] Prepared ${chunks.length} chunks for streaming`);
    
    session.status = 'streaming';
    let earlyTerminated = false;
    let lastAlignment: AlignmentScore = { overall: 0, conceptMatch: 0, assumptionAlign: 0, goalOverlap: 0, capabilityComplement: 0 };
    
    // Stream chunks with progressive alignment
    for (const chunk of chunks) {
      session.chunks.set(chunk.chunkId, chunk);
      
      // Simulate chunk transmission + alignment calculation
      await this.delay(this.bandwidth.throttleMs);
      
      // Calculate progressive alignment
      const snapshot = await this.calculateProgressiveAlignment(session, chunk);
      session.alignmentHistory.push(snapshot);
      
      if (onProgress) {
        onProgress(snapshot);
      }
      
      lastAlignment = this.snapshotToScore(snapshot);
      
      // Check early termination
      if (this.shouldTerminate(session, snapshot)) {
        console.log(`[StreamHandshake] Early termination at chunk ${chunk.sequenceNumber + 1}/${chunks.length}`);
        earlyTerminated = true;
        session.status = 'degraded';
        break;
      }
    }
    
    // Finalize
    if (!earlyTerminated) {
      session.status = 'synchronized';
    }
    
    const result: StreamHandshakeResult = {
      success: session.status === 'synchronized',
      session,
      finalAlignment: lastAlignment,
      chunksTransferred: session.chunks.size,
      duration: Date.now() - startTime,
      earlyTerminated
    };
    
    if (result.success) {
      result.mergedModel = this.buildMergedModel(session);
    }
    
    return result;
  }
  
  /**
   * Respond to streaming handshake (SYN-ACK with own stream)
   */
  async respondToStream(
    sessionId: string,
    responderContext: AgentContext,
    onProgress?: (snapshot: AlignmentSnapshot) => void
  ): Promise<StreamHandshakeResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Stream responder's context back
    const responderChunks = this.chunker.chunk(responderContext, this.bandwidth.priorityOrder);
    
    for (const chunk of responderChunks) {
      // Prefix with "resp_" to distinguish
      chunk.chunkId = `resp_${chunk.chunkId}`;
      session.chunks.set(chunk.chunkId, chunk);
      
      await this.delay(this.bandwidth.throttleMs);
      
      const snapshot = await this.calculateProgressiveAlignment(session, chunk);
      session.alignmentHistory.push(snapshot);
      
      if (onProgress) onProgress(snapshot);
    }
    
    session.status = 'awaiting_ack';
    
    const finalSnapshot = session.alignmentHistory[session.alignmentHistory.length - 1];
    
    return {
      success: true,
      session,
      finalAlignment: this.snapshotToScore(finalSnapshot),
      mergedModel: this.buildMergedModel(session),
      chunksTransferred: session.chunks.size,
      duration: Date.now() - session.startedAt.getTime(),
      earlyTerminated: false
    };
  }
  
  /**
   * Complete handshake (ACK)
   */
  async completeHandshake(sessionId: string): Promise<StreamSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    session.status = 'synchronized';
    return session;
  }
  
  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------
  
  private async calculateProgressiveAlignment(
    session: StreamSession,
    latestChunk: StreamChunk
  ): Promise<AlignmentSnapshot> {
    const chunksProcessed = session.chunks.size;
    
    // Aggregate domain data from all chunks
    const domainScores = new Map<ContextDomain, number>();
    const divergences: DivergenceFlag[] = [];
    
    const domainChunks = new Map<ContextDomain, StreamChunk[]>();
    for (const chunk of session.chunks.values()) {
      const domain = chunk.domain;
      if (!domainChunks.has(domain)) {
        domainChunks.set(domain, []);
      }
      domainChunks.get(domain)!.push(chunk);
    }
    
    // Score each domain
    let totalScore = 0;
    let domainsScored = 0;
    
    for (const [domain, chunks] of domainChunks) {
      const score = this.scoreDomain(domain, chunks);
      domainScores.set(domain, score);
      totalScore += score;
      domainsScored++;
      
      // Flag divergences
      if (score < 0.5) {
        divergences.push({
          domain,
          severity: score < 0.3 ? 'critical' : 'moderate',
          description: `Low alignment in ${domain} domain (${(score * 100).toFixed(0)}%)`,
          suggestedResolution: `Review ${domain} assumptions and reconcile differences`
        });
      }
    }
    
    return {
      timestamp: new Date(),
      chunksProcessed,
      cumulativeScore: domainsScored > 0 ? totalScore / domainsScored : 0,
      domainScores,
      divergences
    };
  }
  
  private scoreDomain(domain: ContextDomain, chunks: StreamChunk[]): number {
    // Weighted scoring based on domain importance and chunk completeness
    const weights: Record<ContextDomain, number> = {
      capabilities: 1.0,
      task_understanding: 1.0,
      key_concepts: 0.9,
      assumptions: 0.85,
      constraints: 0.8,
      domain_knowledge: 0.7,
      preferences: 0.6,
      history: 0.5
    };
    
    const baseScore = 0.7 + (Math.random() * 0.3); // Simulated alignment
    const weight = weights[domain] || 0.5;
    const completeness = chunks.filter(c => c.content.type === 'full').length / Math.max(1, chunks.length);
    
    return baseScore * weight * (0.8 + 0.2 * completeness);
  }
  
  private shouldTerminate(session: StreamSession, snapshot: AlignmentSnapshot): boolean {
    const { earlyTermination } = session.bandwidth;
    
    if (!earlyTermination.enabled) return false;
    if (snapshot.chunksProcessed < earlyTermination.minChunks) return false;
    
    // Terminate if alignment drops below threshold
    if (snapshot.cumulativeScore < earlyTermination.minScore) {
      return true;
    }
    
    // Terminate if critical divergence detected
    const criticalDivergences = snapshot.divergences.filter(d => d.severity === 'critical');
    if (criticalDivergences.length >= 2) {
      return true;
    }
    
    return false;
  }
  
  private snapshotToScore(snapshot: AlignmentSnapshot): AlignmentScore {
    const domainScores = snapshot.domainScores;
    
    return {
      overall: snapshot.cumulativeScore,
      conceptMatch: domainScores.get('key_concepts') || 0.5,
      assumptionAlign: domainScores.get('assumptions') || 0.5,
      goalOverlap: domainScores.get('task_understanding') || 0.5,
      capabilityComplement: domainScores.get('capabilities') || 0.5
    };
  }
  
  private buildMergedModel(session: StreamSession): StreamMergedModel {
    // Reconstruct merged model from all chunks
    const merged: Record<string, unknown> = {};
    
    for (const [domain, chunks] of this.groupByDomain(session.chunks)) {
      merged[domain] = this.mergeChunks(chunks);
    }
    
    return {
      sharedConcepts: merged['key_concepts'] as Record<string, unknown> || {},
      combinedCapabilities: (merged['capabilities'] as { items?: string[] })?.items || [],
      reconciledAssumptions: (merged['assumptions'] as { items?: string[] })?.items || [],
      taskUnderstanding: (merged['task_understanding'] as { content?: string })?.content || '',
      divergenceResolutions: session.alignmentHistory
        .flatMap(s => s.divergences)
        .filter(d => d.suggestedResolution)
        .map(d => ({ domain: d.domain, resolution: d.suggestedResolution! }))
    };
  }
  
  private groupByDomain(chunks: Map<string, StreamChunk>): Map<ContextDomain, StreamChunk[]> {
    const grouped = new Map<ContextDomain, StreamChunk[]>();
    for (const chunk of chunks.values()) {
      if (!grouped.has(chunk.domain)) {
        grouped.set(chunk.domain, []);
      }
      grouped.get(chunk.domain)!.push(chunk);
    }
    return grouped;
  }
  
  private mergeChunks(chunks: StreamChunk[]): Record<string, unknown> {
    // Sort by sequence and merge
    chunks.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    
    const merged: Record<string, unknown> = {};
    for (const chunk of chunks) {
      Object.assign(merged, chunk.content.data);
    }
    return merged;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // --------------------------------------------------------------------------
  // Session Management
  // --------------------------------------------------------------------------
  
  getSession(sessionId: string): StreamSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  listSessions(): StreamSession[] {
    return Array.from(this.sessions.values());
  }
  
  cleanupSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}

// ============================================================================
// Visualization
// ============================================================================

export function visualizeStreamProgress(session: StreamSession): string {
  const lines: string[] = [];
  
  lines.push(`\n┌─────────────────────────────────────────────────────────────┐`);
  lines.push(`│  STREAMING HANDSHAKE: ${session.sessionId.slice(0, 20).padEnd(35)}│`);
  lines.push(`├─────────────────────────────────────────────────────────────┤`);
  lines.push(`│  Status: ${session.status.toUpperCase().padEnd(48)}│`);
  lines.push(`│  Chunks: ${session.chunks.size.toString().padEnd(48)}│`);
  
  // Progress bar
  const history = session.alignmentHistory;
  if (history.length > 0) {
    const latest = history[history.length - 1];
    const score = latest.cumulativeScore;
    const barWidth = 40;
    const filled = Math.round(score * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    
    lines.push(`├─────────────────────────────────────────────────────────────┤`);
    lines.push(`│  Alignment: [${bar}] ${(score * 100).toFixed(1)}%  │`);
    
    // Domain breakdown
    lines.push(`├─────────────────────────────────────────────────────────────┤`);
    for (const [domain, domainScore] of latest.domainScores) {
      const dFilled = Math.round(domainScore * 20);
      const dBar = '▓'.repeat(dFilled) + '░'.repeat(20 - dFilled);
      const domainName = domain.padEnd(18);
      lines.push(`│  ${domainName} [${dBar}] ${(domainScore * 100).toFixed(0).padStart(3)}% │`);
    }
    
    // Divergences
    if (latest.divergences.length > 0) {
      lines.push(`├─────────────────────────────────────────────────────────────┤`);
      lines.push(`│  ⚠️  DIVERGENCES:                                           │`);
      for (const div of latest.divergences.slice(0, 3)) {
        const severity = div.severity === 'critical' ? '🔴' : div.severity === 'moderate' ? '🟡' : '🟢';
        const desc = div.description.slice(0, 45).padEnd(45);
        lines.push(`│  ${severity} ${desc}      │`);
      }
    }
  }
  
  lines.push(`└─────────────────────────────────────────────────────────────┘\n`);
  
  return lines.join('\n');
}

// ============================================================================
// Demo
// ============================================================================

export async function demoStreamingHandshake(): Promise<void> {
  console.log('\n🌊 STREAMING HANDSHAKE DEMO\n');
  
  const engine = new StreamingHandshake({
    throttleMs: 100, // Slower for visible progress
    earlyTermination: {
      enabled: true,
      minScore: 0.3,
      minChunks: 2
    }
  });
  
  // Large context to demonstrate streaming
  const largeContext: AgentContext = {
    agentId: 'agent_alpha',
    capabilities: ['code', 'research', 'creative', 'analysis', 'automation'],
    mentalModel: {
      taskUnderstanding: 'Build a collaborative AI system with real-time context synchronization',
      keyConcepts: {
        'context-sync': { name: 'context-sync', definition: 'Ensuring all agents share the same understanding', relationships: ['streaming', 'alignment'], importance: 'critical' },
        'streaming': { name: 'streaming', definition: 'Progressive transfer of large data', relationships: ['context-sync'], importance: 'high' },
        'alignment': { name: 'alignment', definition: 'Measuring how well models match', relationships: ['divergence'], importance: 'critical' },
        'divergence': { name: 'divergence', definition: 'Points where understanding differs', relationships: ['alignment', 'resolution'], importance: 'high' },
        'resolution': { name: 'resolution', definition: 'Process of reconciling differences', relationships: ['divergence'], importance: 'medium' }
      },
      assumptions: [
        { id: 'a1', statement: 'Network latency is variable', confidence: 0.9, basis: 'Network reality' },
        { id: 'a2', statement: 'Contexts may be very large', confidence: 0.85, basis: 'Complex mental models' },
        { id: 'a3', statement: 'Early termination can save resources', confidence: 0.95, basis: 'Optimization' },
        { id: 'a4', statement: 'Not all domains are equally important', confidence: 0.8, basis: 'Priority ordering' }
      ],
      constraints: [
        { id: 'c1', type: 'soft', description: 'Limited bandwidth', source: 'system' },
        { id: 'c2', type: 'hard', description: 'Time-sensitive operations', source: 'user' }
      ],
      goals: [
        { id: 'g1', description: 'Stream context efficiently', priority: 1, status: 'active' },
        { id: 'g2', description: 'Detect divergences early', priority: 2, status: 'active' }
      ],
      confidenceLevel: 0.85
    },
    preferredStyle: 'technical'
  };
  
  console.log('Starting stream...\n');
  
  const result = await engine.initiateStream(
    'agent_alpha',
    'agent_beta',
    largeContext,
    (snapshot) => {
      console.log(`  📦 Chunk ${snapshot.chunksProcessed}: Alignment ${(snapshot.cumulativeScore * 100).toFixed(1)}%`);
    }
  );
  
  console.log(visualizeStreamProgress(result.session));
  
  console.log(`\n📊 Results:`);
  console.log(`   Success: ${result.success}`);
  console.log(`   Chunks transferred: ${result.chunksTransferred}`);
  console.log(`   Duration: ${result.duration}ms`);
  console.log(`   Early terminated: ${result.earlyTerminated}`);
  console.log(`   Final alignment: ${(result.finalAlignment.overall * 100).toFixed(1)}%`);
}

// Run demo if executed directly
if (require.main === module) {
  demoStreamingHandshake().catch(console.error);
}
