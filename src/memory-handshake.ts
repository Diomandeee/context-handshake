/**
 * Memory-Aware Handshake - Gen 7
 * 
 * Integrates Trust Memory with the handshake protocol:
 * - Automatic handshake type selection based on relationship history
 * - Progressive capability unlocking
 * - Context caching for instant reconnection
 * - Trust-based conflict resolution
 */

import TrustMemory, {
  TrustTier,
  TrustCapabilities,
  TRUST_CAPABILITIES,
  selectHandshakeType,
  createFastReconnect,
  FastReconnect,
  FastReconnectAck,
} from './trust';

// Extended context with trust awareness
export interface TrustAwareContext {
  agentId: string;
  concepts: Map<string, string>;
  assumptions: string[];
  goals: string[];
  capabilities: string[];
  // Trust additions
  trustMemory: TrustMemory;
  sensitiveContext?: string[]; // Only shared with trusted partners
  delegationPreferences?: DelegationPrefs;
}

export interface DelegationPrefs {
  allowAutonomousDelegation: boolean;
  maxDelegationDepth: number;
  requireApprovalFor: string[]; // Task types needing explicit OK
}

// Handshake result with trust info
export interface MemoryHandshakeResult {
  success: boolean;
  handshakeType: 'full' | 'abbreviated' | 'diff' | 'instant';
  trustTier: TrustTier;
  unlockedCapabilities: TrustCapabilities;
  mergedContext: MergedContext;
  reconnectionTime: number; // How long the handshake took
  trustDelta: number; // Trust change from this interaction
}

export interface MergedContext {
  sharedConcepts: Map<string, string>;
  alignedGoals: string[];
  combinedCapabilities: string[];
  conflictingAssumptions: Array<{
    topic: string;
    agentA: string;
    agentB: string;
    resolution?: string;
  }>;
}

/**
 * Memory-Aware Handshake Orchestrator
 * 
 * Decides handshake strategy based on trust history
 */
export class MemoryHandshake {
  private myContext: TrustAwareContext;
  private handshakeLog: HandshakeLogEntry[] = [];

  constructor(context: TrustAwareContext) {
    this.myContext = context;
  }

  /**
   * Initiate handshake with partner
   * Automatically selects optimal strategy based on trust
   */
  async initiate(partnerId: string): Promise<MemoryHandshakeResult> {
    const startTime = Date.now();
    const handshakeType = selectHandshakeType(
      this.myContext.trustMemory,
      partnerId
    );

    let result: MemoryHandshakeResult;

    switch (handshakeType) {
      case 'instant':
        result = await this.instantReconnect(partnerId);
        break;
      case 'diff':
        result = await this.diffHandshake(partnerId);
        break;
      case 'abbreviated':
        result = await this.abbreviatedHandshake(partnerId);
        break;
      case 'full':
      default:
        result = await this.fullHandshake(partnerId);
    }

    result.reconnectionTime = Date.now() - startTime;
    this.logHandshake(partnerId, result);

    return result;
  }

  /**
   * Instant reconnect for bonded/trusted partners
   * Just verify identity and sync recent changes
   */
  private async instantReconnect(partnerId: string): Promise<MemoryHandshakeResult> {
    const rel = this.myContext.trustMemory.getRelationship(partnerId);
    const caps = TRUST_CAPABILITIES[rel.tier];

    // Use cached context if available
    const cachedContext = rel.contextSnapshot;
    
    const mergedContext: MergedContext = {
      sharedConcepts: rel.sharedVocabulary,
      alignedGoals: [], // Assume goals unchanged
      combinedCapabilities: rel.knownCapabilities,
      conflictingAssumptions: [],
    };

    // Quick capability sync
    if (cachedContext) {
      try {
        const parsed = JSON.parse(cachedContext);
        mergedContext.alignedGoals = parsed.goals || [];
      } catch {
        // Fallback to empty if cache corrupted
      }
    }

    return {
      success: true,
      handshakeType: 'instant',
      trustTier: rel.tier,
      unlockedCapabilities: caps,
      mergedContext,
      reconnectionTime: 0,
      trustDelta: 0.5, // Small bonus for reconnecting
    };
  }

  /**
   * Diff handshake for familiar partners
   * Only exchange what's changed since last interaction
   */
  private async diffHandshake(partnerId: string): Promise<MemoryHandshakeResult> {
    const rel = this.myContext.trustMemory.getRelationship(partnerId);
    const caps = TRUST_CAPABILITIES[rel.tier];

    const currentContextKeys = Array.from(this.myContext.concepts.keys());
    const lastContextKeys = rel.contextSnapshot 
      ? JSON.parse(rel.contextSnapshot).conceptKeys || []
      : [];

    const fastReconnect = createFastReconnect(
      this.myContext.trustMemory,
      this.myContext.agentId,
      partnerId,
      currentContextKeys,
      lastContextKeys
    );

    // In real implementation, send fastReconnect and await response
    // Here we simulate the diff merge
    const newConcepts = currentContextKeys.filter(
      k => !lastContextKeys.includes(k)
    );

    const mergedContext: MergedContext = {
      sharedConcepts: new Map([
        ...rel.sharedVocabulary,
        ...newConcepts.map(k => [k, this.myContext.concepts.get(k)!] as [string, string]),
      ]),
      alignedGoals: this.myContext.goals,
      combinedCapabilities: [
        ...rel.knownCapabilities,
        ...this.myContext.capabilities.filter(c => !rel.knownCapabilities.includes(c)),
      ],
      conflictingAssumptions: [],
    };

    // Update cached context
    this.myContext.trustMemory.storeContextSnapshot(
      partnerId,
      JSON.stringify({
        conceptKeys: currentContextKeys,
        goals: this.myContext.goals,
        timestamp: Date.now(),
      })
    );

    return {
      success: true,
      handshakeType: 'diff',
      trustTier: rel.tier,
      unlockedCapabilities: caps,
      mergedContext,
      reconnectionTime: 0,
      trustDelta: 1,
    };
  }

  /**
   * Abbreviated handshake for acquaintances
   * Skip deep alignment, focus on essentials
   */
  private async abbreviatedHandshake(partnerId: string): Promise<MemoryHandshakeResult> {
    const rel = this.myContext.trustMemory.getRelationship(partnerId);
    const caps = TRUST_CAPABILITIES[rel.tier];

    // Only exchange top-level concepts and primary goals
    const topConcepts = new Map(
      Array.from(this.myContext.concepts.entries()).slice(0, 5)
    );
    const primaryGoals = this.myContext.goals.slice(0, 3);

    const mergedContext: MergedContext = {
      sharedConcepts: new Map([
        ...rel.sharedVocabulary,
        ...topConcepts,
      ]),
      alignedGoals: primaryGoals,
      combinedCapabilities: this.myContext.capabilities,
      conflictingAssumptions: [],
    };

    // Store for next time
    for (const [term, def] of topConcepts) {
      this.myContext.trustMemory.addSharedTerm(partnerId, term, def);
    }

    return {
      success: true,
      handshakeType: 'abbreviated',
      trustTier: rel.tier,
      unlockedCapabilities: caps,
      mergedContext,
      reconnectionTime: 0,
      trustDelta: 2,
    };
  }

  /**
   * Full handshake for unknown partners
   * Complete context exchange and alignment
   */
  private async fullHandshake(partnerId: string): Promise<MemoryHandshakeResult> {
    const rel = this.myContext.trustMemory.getRelationship(partnerId);
    const caps = TRUST_CAPABILITIES[TrustTier.UNKNOWN];

    // Full context exchange
    const mergedContext: MergedContext = {
      sharedConcepts: this.myContext.concepts,
      alignedGoals: this.myContext.goals,
      combinedCapabilities: this.myContext.capabilities,
      conflictingAssumptions: [],
    };

    // In real implementation, this would involve:
    // 1. Send SYN with full context
    // 2. Receive SYN-ACK with partner's context
    // 3. Run alignment algorithm
    // 4. Send ACK with merged model

    // Initialize relationship with this first contact
    this.myContext.trustMemory.storeContextSnapshot(
      partnerId,
      JSON.stringify({
        conceptKeys: Array.from(this.myContext.concepts.keys()),
        goals: this.myContext.goals,
        capabilities: this.myContext.capabilities,
        timestamp: Date.now(),
      })
    );

    return {
      success: true,
      handshakeType: 'full',
      trustTier: TrustTier.UNKNOWN,
      unlockedCapabilities: caps,
      mergedContext,
      reconnectionTime: 0,
      trustDelta: 5, // First contact bonus
    };
  }

  /**
   * Handle incoming handshake request
   */
  async respond(request: FastReconnect): Promise<FastReconnectAck> {
    const rel = this.myContext.trustMemory.getRelationship(request.senderId);

    // Verify trust level matches
    const accepted = Math.abs(rel.tier - request.trustTier) <= 1;

    if (!accepted) {
      return {
        type: 'fast-reconnect-ack',
        accepted: false,
        myTier: rel.tier,
      };
    }

    // Build context diff response
    const currentContext = Array.from(this.myContext.concepts.keys());
    const theirContext = request.contextDiff
      ? [...(request.contextDiff.added || [])]
      : [];

    const myDiff = {
      added: currentContext.filter(c => !theirContext.includes(c)),
      removed: [],
      modified: [],
    };

    return {
      type: 'fast-reconnect-ack',
      accepted: true,
      myTier: rel.tier,
      contextDiff: myDiff,
    };
  }

  /**
   * Record handshake outcome for trust evolution
   */
  recordOutcome(
    partnerId: string,
    success: boolean,
    alignmentScore: number,
    duration: number
  ): void {
    this.myContext.trustMemory.recordCollaboration(
      partnerId,
      success ? 'success' : 'failure',
      alignmentScore,
      duration
    );
  }

  /**
   * Log handshake for analysis
   */
  private logHandshake(partnerId: string, result: MemoryHandshakeResult): void {
    this.handshakeLog.push({
      timestamp: Date.now(),
      partnerId,
      handshakeType: result.handshakeType,
      trustTier: result.trustTier,
      reconnectionTime: result.reconnectionTime,
      success: result.success,
    });
  }

  /**
   * Get handshake statistics
   */
  getStats(): HandshakeStats {
    const byType: Record<string, number> = {};
    const byTier: Record<number, number> = {};
    let totalTime = 0;
    let successCount = 0;

    for (const entry of this.handshakeLog) {
      byType[entry.handshakeType] = (byType[entry.handshakeType] || 0) + 1;
      byTier[entry.trustTier] = (byTier[entry.trustTier] || 0) + 1;
      totalTime += entry.reconnectionTime;
      if (entry.success) successCount++;
    }

    return {
      totalHandshakes: this.handshakeLog.length,
      byType,
      byTier,
      averageTime: this.handshakeLog.length > 0 
        ? totalTime / this.handshakeLog.length 
        : 0,
      successRate: this.handshakeLog.length > 0
        ? successCount / this.handshakeLog.length
        : 0,
    };
  }
}

interface HandshakeLogEntry {
  timestamp: number;
  partnerId: string;
  handshakeType: string;
  trustTier: TrustTier;
  reconnectionTime: number;
  success: boolean;
}

interface HandshakeStats {
  totalHandshakes: number;
  byType: Record<string, number>;
  byTier: Record<number, number>;
  averageTime: number;
  successRate: number;
}

/**
 * Trust-Based Conflict Resolution
 * 
 * When merged contexts have conflicts, resolve based on trust
 */
export function resolveConflict(
  myContext: TrustAwareContext,
  partnerId: string,
  conflict: { topic: string; myView: string; theirView: string }
): { winner: 'me' | 'them' | 'merge'; resolution: string } {
  const rel = myContext.trustMemory.getRelationship(partnerId);
  const myRep = myContext.trustMemory.getNetworkReputation();

  // Higher trust = more influence in conflicts
  const theirWeight = rel.score / 100;
  const myWeight = myRep.score / 100;

  if (Math.abs(theirWeight - myWeight) < 0.1) {
    // Similar trust - merge views
    return {
      winner: 'merge',
      resolution: `[${conflict.topic}]: Synthesized from both perspectives`,
    };
  } else if (theirWeight > myWeight) {
    // They have higher trust
    return {
      winner: 'them',
      resolution: conflict.theirView,
    };
  } else {
    // I have higher trust
    return {
      winner: 'me',
      resolution: conflict.myView,
    };
  }
}

export default MemoryHandshake;
