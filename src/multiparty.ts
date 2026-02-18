/**
 * Multi-party Context Handshake Protocol
 * 
 * Extends 2-party handshakes to N-party collaboration.
 * Uses hub-and-spoke for small groups, gossip protocol for large swarms.
 * 
 * HEF Evolution: Instance 28, Generation 6
 * Techniques: G08 (Combine), R12 (Scale), S03 (Cross-Domain from distributed systems)
 */

import { 
  ContextPacket, 
  HandshakePhase, 
  AlignmentScore,
  HandshakeResult 
} from './protocol';
import { 
  HandshakeEngine, 
  HandshakeConfig 
} from './handshake';
import { MergeEngine } from './merge';
import { AlignmentEngine } from './alignment';

// ============================================
// TYPES
// ============================================

export interface PartyInfo {
  agentId: string;
  context: ContextPacket;
  joinedAt: number;
  role: PartyRole;
  status: PartyStatus;
}

export type PartyRole = 
  | 'coordinator'    // Hub in hub-and-spoke
  | 'participant'    // Regular participant
  | 'observer'       // Read-only access
  | 'relay';         // Gossip relay node

export type PartyStatus = 
  | 'pending'        // Awaiting handshake
  | 'syncing'        // Handshake in progress
  | 'synced'         // Fully synchronized
  | 'diverged'       // Needs re-sync
  | 'disconnected';  // Lost connection

export interface MultipartyConfig {
  // Strategy selection
  strategy: TopologyStrategy;
  
  // Quorum requirements
  quorumType: 'majority' | 'unanimous' | 'threshold';
  quorumThreshold?: number; // For threshold type
  
  // Timing
  syncTimeoutMs: number;
  heartbeatIntervalMs: number;
  
  // Scaling
  maxParties: number;
  gossipFanout: number; // For gossip strategy
  
  // Conflict resolution
  conflictResolution: 'coordinator-wins' | 'vote' | 'merge-all';
}

export type TopologyStrategy = 
  | 'hub-and-spoke'  // One coordinator, all sync through hub
  | 'full-mesh'      // Everyone syncs with everyone (small groups)
  | 'gossip'         // Epidemic spread (large swarms)
  | 'hierarchical';  // Tree structure with sub-coordinators

export interface MultipartySession {
  sessionId: string;
  createdAt: number;
  lastSync: number;
  
  // Participants
  parties: Map<string, PartyInfo>;
  coordinator?: string;
  
  // State
  phase: MultipartyPhase;
  globalContext: ContextPacket;
  alignmentMatrix: AlignmentMatrix;
  
  // Config
  config: MultipartyConfig;
  
  // Metrics
  metrics: MultipartyMetrics;
}

export type MultipartyPhase = 
  | 'gathering'      // Collecting participants
  | 'handshaking'    // Running handshakes
  | 'merging'        // Building consensus
  | 'active'         // Collaboration in progress
  | 'closing';       // Session ending

export interface AlignmentMatrix {
  // agentId -> agentId -> alignment score
  scores: Map<string, Map<string, AlignmentScore>>;
  globalAlignment: number;
  weakestLink: { from: string; to: string; score: number } | null;
}

export interface MultipartyMetrics {
  totalHandshakes: number;
  successfulHandshakes: number;
  failedHandshakes: number;
  averageAlignmentTime: number;
  resyncCount: number;
  messageCount: number;
}

// ============================================
// MULTIPARTY ENGINE
// ============================================

export class MultipartyEngine {
  private sessions: Map<string, MultipartySession> = new Map();
  private handshakeEngine: HandshakeEngine;
  private mergeEngine: MergeEngine;
  private alignmentEngine: AlignmentEngine;
  
  constructor(
    private defaultConfig: Partial<MultipartyConfig> = {}
  ) {
    this.handshakeEngine = new HandshakeEngine();
    this.mergeEngine = new MergeEngine();
    this.alignmentEngine = new AlignmentEngine();
  }
  
  /**
   * Create a new multiparty session
   */
  async createSession(
    initiator: ContextPacket,
    config?: Partial<MultipartyConfig>
  ): Promise<MultipartySession> {
    const sessionId = `mp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const fullConfig: MultipartyConfig = {
      strategy: 'hub-and-spoke',
      quorumType: 'majority',
      syncTimeoutMs: 30000,
      heartbeatIntervalMs: 5000,
      maxParties: 10,
      gossipFanout: 3,
      conflictResolution: 'coordinator-wins',
      ...this.defaultConfig,
      ...config,
    };
    
    // Auto-select strategy based on expected size
    if (fullConfig.maxParties > 10 && fullConfig.strategy === 'hub-and-spoke') {
      fullConfig.strategy = 'gossip';
    }
    
    const session: MultipartySession = {
      sessionId,
      createdAt: Date.now(),
      lastSync: Date.now(),
      parties: new Map(),
      coordinator: initiator.agentId,
      phase: 'gathering',
      globalContext: initiator,
      alignmentMatrix: {
        scores: new Map(),
        globalAlignment: 1.0,
        weakestLink: null,
      },
      config: fullConfig,
      metrics: {
        totalHandshakes: 0,
        successfulHandshakes: 0,
        failedHandshakes: 0,
        averageAlignmentTime: 0,
        resyncCount: 0,
        messageCount: 0,
      },
    };
    
    // Add initiator as coordinator
    session.parties.set(initiator.agentId, {
      agentId: initiator.agentId,
      context: initiator,
      joinedAt: Date.now(),
      role: 'coordinator',
      status: 'synced',
    });
    
    this.sessions.set(sessionId, session);
    return session;
  }
  
  /**
   * Add a party to the session
   */
  async addParty(
    sessionId: string,
    newParty: ContextPacket,
    role: PartyRole = 'participant'
  ): Promise<{ 
    success: boolean; 
    alignment: number;
    session: MultipartySession;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (session.parties.size >= session.config.maxParties) {
      throw new Error(`Session at capacity: ${session.config.maxParties}`);
    }
    
    // Add party as pending
    session.parties.set(newParty.agentId, {
      agentId: newParty.agentId,
      context: newParty,
      joinedAt: Date.now(),
      role,
      status: 'pending',
    });
    
    // Run handshakes based on strategy
    const alignment = await this.runStrategyHandshake(session, newParty);
    
    // Update party status
    const party = session.parties.get(newParty.agentId)!;
    party.status = alignment >= 0.5 ? 'synced' : 'diverged';
    
    // Update global context if synced
    if (party.status === 'synced') {
      session.globalContext = await this.mergeEngine.mergeContexts(
        session.globalContext,
        newParty
      );
    }
    
    // Recalculate global alignment
    this.updateAlignmentMatrix(session);
    
    return {
      success: party.status === 'synced',
      alignment,
      session,
    };
  }
  
  /**
   * Run handshakes based on topology strategy
   */
  private async runStrategyHandshake(
    session: MultipartySession,
    newParty: ContextPacket
  ): Promise<number> {
    session.phase = 'handshaking';
    
    switch (session.config.strategy) {
      case 'hub-and-spoke':
        return this.hubAndSpokeHandshake(session, newParty);
      
      case 'full-mesh':
        return this.fullMeshHandshake(session, newParty);
      
      case 'gossip':
        return this.gossipHandshake(session, newParty);
      
      case 'hierarchical':
        return this.hierarchicalHandshake(session, newParty);
      
      default:
        return this.hubAndSpokeHandshake(session, newParty);
    }
  }
  
  /**
   * Hub-and-spoke: New party only handshakes with coordinator
   */
  private async hubAndSpokeHandshake(
    session: MultipartySession,
    newParty: ContextPacket
  ): Promise<number> {
    const coordinator = session.parties.get(session.coordinator!);
    if (!coordinator) {
      throw new Error('No coordinator found');
    }
    
    session.metrics.totalHandshakes++;
    
    const result = await this.handshakeEngine.initiateHandshake(
      newParty,
      coordinator.context
    );
    
    if (result.success) {
      session.metrics.successfulHandshakes++;
    } else {
      session.metrics.failedHandshakes++;
    }
    
    // Store alignment score
    this.setAlignmentScore(
      session, 
      newParty.agentId, 
      coordinator.agentId, 
      result.alignment
    );
    
    return result.alignment.overall;
  }
  
  /**
   * Full-mesh: New party handshakes with all existing parties
   */
  private async fullMeshHandshake(
    session: MultipartySession,
    newParty: ContextPacket
  ): Promise<number> {
    const alignments: number[] = [];
    
    for (const [agentId, party] of session.parties) {
      if (agentId === newParty.agentId) continue;
      if (party.status !== 'synced') continue;
      
      session.metrics.totalHandshakes++;
      
      const result = await this.handshakeEngine.initiateHandshake(
        newParty,
        party.context
      );
      
      if (result.success) {
        session.metrics.successfulHandshakes++;
      } else {
        session.metrics.failedHandshakes++;
      }
      
      this.setAlignmentScore(session, newParty.agentId, agentId, result.alignment);
      alignments.push(result.alignment.overall);
    }
    
    // Return average alignment
    return alignments.length > 0 
      ? alignments.reduce((a, b) => a + b, 0) / alignments.length 
      : 1.0;
  }
  
  /**
   * Gossip: Epidemic-style propagation for large swarms
   */
  private async gossipHandshake(
    session: MultipartySession,
    newParty: ContextPacket
  ): Promise<number> {
    const fanout = session.config.gossipFanout;
    const alignments: number[] = [];
    
    // Select random subset of parties to handshake with
    const syncedParties = Array.from(session.parties.values())
      .filter(p => p.agentId !== newParty.agentId && p.status === 'synced');
    
    const selected = this.randomSample(syncedParties, Math.min(fanout, syncedParties.length));
    
    for (const party of selected) {
      session.metrics.totalHandshakes++;
      
      const result = await this.handshakeEngine.initiateHandshake(
        newParty,
        party.context
      );
      
      if (result.success) {
        session.metrics.successfulHandshakes++;
      } else {
        session.metrics.failedHandshakes++;
      }
      
      this.setAlignmentScore(session, newParty.agentId, party.agentId, result.alignment);
      alignments.push(result.alignment.overall);
      
      // Gossip: selected parties propagate to their neighbors
      await this.propagateGossip(session, party.agentId, newParty);
    }
    
    return alignments.length > 0 
      ? alignments.reduce((a, b) => a + b, 0) / alignments.length 
      : 1.0;
  }
  
  /**
   * Hierarchical: Tree structure with sub-coordinators
   */
  private async hierarchicalHandshake(
    session: MultipartySession,
    newParty: ContextPacket
  ): Promise<number> {
    // Find nearest sub-coordinator or main coordinator
    // For simplicity, use coordinator for now
    // Full implementation would maintain a tree structure
    return this.hubAndSpokeHandshake(session, newParty);
  }
  
  /**
   * Propagate context update via gossip
   */
  private async propagateGossip(
    session: MultipartySession,
    fromAgent: string,
    newContext: ContextPacket
  ): Promise<void> {
    session.metrics.messageCount++;
    
    // In real implementation, this would be async message passing
    // Here we simulate by updating alignment matrix
    const party = session.parties.get(fromAgent);
    if (party) {
      party.context = await this.mergeEngine.mergeContexts(
        party.context,
        newContext
      );
    }
  }
  
  /**
   * Check if quorum is met for a decision
   */
  checkQuorum(session: MultipartySession, agreeing: string[]): boolean {
    const syncedCount = Array.from(session.parties.values())
      .filter(p => p.status === 'synced').length;
    
    switch (session.config.quorumType) {
      case 'unanimous':
        return agreeing.length === syncedCount;
      
      case 'majority':
        return agreeing.length > syncedCount / 2;
      
      case 'threshold':
        const threshold = session.config.quorumThreshold ?? 0.5;
        return agreeing.length / syncedCount >= threshold;
      
      default:
        return agreeing.length > syncedCount / 2;
    }
  }
  
  /**
   * Broadcast context update to all parties
   */
  async broadcastUpdate(
    sessionId: string,
    update: Partial<ContextPacket>,
    fromAgent: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Validate sender is synced
    const sender = session.parties.get(fromAgent);
    if (!sender || sender.status !== 'synced') return;
    
    // Based on strategy, propagate differently
    switch (session.config.strategy) {
      case 'hub-and-spoke':
        // Send to coordinator, coordinator relays
        await this.coordinatorRelay(session, update, fromAgent);
        break;
      
      case 'full-mesh':
        // Direct broadcast to all
        await this.directBroadcast(session, update, fromAgent);
        break;
      
      case 'gossip':
        // Epidemic spread
        await this.gossipBroadcast(session, update, fromAgent);
        break;
      
      case 'hierarchical':
        // Up to parent, down to children
        await this.hierarchicalBroadcast(session, update, fromAgent);
        break;
    }
    
    session.lastSync = Date.now();
  }
  
  private async coordinatorRelay(
    session: MultipartySession,
    update: Partial<ContextPacket>,
    fromAgent: string
  ): Promise<void> {
    // Merge into global context
    session.globalContext = {
      ...session.globalContext,
      ...update,
    };
    
    // Notify all parties
    for (const [agentId, party] of session.parties) {
      if (agentId !== fromAgent && party.status === 'synced') {
        session.metrics.messageCount++;
        // Would send message in real implementation
      }
    }
  }
  
  private async directBroadcast(
    session: MultipartySession,
    update: Partial<ContextPacket>,
    fromAgent: string
  ): Promise<void> {
    for (const [agentId, party] of session.parties) {
      if (agentId !== fromAgent && party.status === 'synced') {
        session.metrics.messageCount++;
      }
    }
  }
  
  private async gossipBroadcast(
    session: MultipartySession,
    update: Partial<ContextPacket>,
    fromAgent: string
  ): Promise<void> {
    // Select random fanout parties
    const syncedParties = Array.from(session.parties.values())
      .filter(p => p.agentId !== fromAgent && p.status === 'synced');
    
    const selected = this.randomSample(
      syncedParties, 
      Math.min(session.config.gossipFanout, syncedParties.length)
    );
    
    for (const party of selected) {
      session.metrics.messageCount++;
      // Each selected party would recursively gossip
    }
  }
  
  private async hierarchicalBroadcast(
    session: MultipartySession,
    update: Partial<ContextPacket>,
    fromAgent: string
  ): Promise<void> {
    // Similar to coordinator relay for now
    await this.coordinatorRelay(session, update, fromAgent);
  }
  
  /**
   * Handle party disconnection
   */
  async removeParty(sessionId: string, agentId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    const party = session.parties.get(agentId);
    if (!party) return;
    
    // If coordinator leaves, elect new one
    if (party.role === 'coordinator') {
      await this.electCoordinator(session);
    }
    
    session.parties.delete(agentId);
    
    // Clean up alignment matrix
    session.alignmentMatrix.scores.delete(agentId);
    for (const [, scores] of session.alignmentMatrix.scores) {
      scores.delete(agentId);
    }
    
    this.updateAlignmentMatrix(session);
  }
  
  /**
   * Elect new coordinator
   */
  private async electCoordinator(session: MultipartySession): Promise<void> {
    // Simple: pick party with highest average alignment
    let bestAgent: string | null = null;
    let bestScore = -1;
    
    for (const [agentId, party] of session.parties) {
      if (party.status !== 'synced') continue;
      
      const avgAlignment = this.getAverageAlignment(session, agentId);
      if (avgAlignment > bestScore) {
        bestScore = avgAlignment;
        bestAgent = agentId;
      }
    }
    
    if (bestAgent) {
      const oldCoord = session.parties.get(session.coordinator!);
      if (oldCoord) oldCoord.role = 'participant';
      
      session.coordinator = bestAgent;
      const newCoord = session.parties.get(bestAgent)!;
      newCoord.role = 'coordinator';
    }
  }
  
  /**
   * Sync all parties (periodic reconciliation)
   */
  async syncAll(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.phase = 'merging';
    session.metrics.resyncCount++;
    
    // Collect all contexts
    const contexts = Array.from(session.parties.values())
      .filter(p => p.status === 'synced')
      .map(p => p.context);
    
    // Merge all
    let merged = contexts[0];
    for (let i = 1; i < contexts.length; i++) {
      merged = await this.mergeEngine.mergeContexts(merged, contexts[i]);
    }
    
    session.globalContext = merged;
    
    // Recalculate all alignments
    this.updateAlignmentMatrix(session);
    
    session.phase = 'active';
    session.lastSync = Date.now();
  }
  
  /**
   * Get session status
   */
  getSession(sessionId: string): MultipartySession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Close session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.phase = 'closing';
    
    // Notify all parties
    for (const party of session.parties.values()) {
      party.status = 'disconnected';
      session.metrics.messageCount++;
    }
    
    this.sessions.delete(sessionId);
  }
  
  // ============================================
  // HELPERS
  // ============================================
  
  private setAlignmentScore(
    session: MultipartySession,
    agent1: string,
    agent2: string,
    score: AlignmentScore
  ): void {
    if (!session.alignmentMatrix.scores.has(agent1)) {
      session.alignmentMatrix.scores.set(agent1, new Map());
    }
    if (!session.alignmentMatrix.scores.has(agent2)) {
      session.alignmentMatrix.scores.set(agent2, new Map());
    }
    
    session.alignmentMatrix.scores.get(agent1)!.set(agent2, score);
    session.alignmentMatrix.scores.get(agent2)!.set(agent1, score);
  }
  
  private updateAlignmentMatrix(session: MultipartySession): void {
    const scores = session.alignmentMatrix.scores;
    let total = 0;
    let count = 0;
    let weakest = { from: '', to: '', score: 1.0 };
    
    for (const [from, toScores] of scores) {
      for (const [to, score] of toScores) {
        if (from < to) { // Avoid counting twice
          total += score.overall;
          count++;
          
          if (score.overall < weakest.score) {
            weakest = { from, to, score: score.overall };
          }
        }
      }
    }
    
    session.alignmentMatrix.globalAlignment = count > 0 ? total / count : 1.0;
    session.alignmentMatrix.weakestLink = weakest.score < 1.0 ? weakest : null;
  }
  
  private getAverageAlignment(session: MultipartySession, agentId: string): number {
    const scores = session.alignmentMatrix.scores.get(agentId);
    if (!scores || scores.size === 0) return 0;
    
    let total = 0;
    for (const score of scores.values()) {
      total += score.overall;
    }
    return total / scores.size;
  }
  
  private randomSample<T>(arr: T[], n: number): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result.slice(0, n);
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick multiparty session for a list of agents
 */
export async function quickMultipartySync(
  agents: ContextPacket[],
  config?: Partial<MultipartyConfig>
): Promise<MultipartySession> {
  const engine = new MultipartyEngine(config);
  
  // First agent becomes coordinator
  const session = await engine.createSession(agents[0]);
  
  // Add remaining agents
  for (let i = 1; i < agents.length; i++) {
    await engine.addParty(session.sessionId, agents[i]);
  }
  
  // Final sync
  await engine.syncAll(session.sessionId);
  
  return session;
}

/**
 * Check if all agents are sufficiently aligned
 */
export function isGroupAligned(
  session: MultipartySession,
  minAlignment: number = 0.6
): boolean {
  return session.alignmentMatrix.globalAlignment >= minAlignment;
}

/**
 * Get the least aligned pair for targeted reconciliation
 */
export function getLeastAlignedPair(
  session: MultipartySession
): { from: string; to: string; score: number } | null {
  return session.alignmentMatrix.weakestLink;
}

/**
 * Swarm handshake: specialized for large groups
 */
export async function swarmHandshake(
  agents: ContextPacket[],
  options?: {
    fanout?: number;
    quorum?: number;
  }
): Promise<MultipartySession> {
  return quickMultipartySync(agents, {
    strategy: 'gossip',
    gossipFanout: options?.fanout ?? 3,
    quorumType: 'threshold',
    quorumThreshold: options?.quorum ?? 0.5,
    maxParties: 100,
  });
}
