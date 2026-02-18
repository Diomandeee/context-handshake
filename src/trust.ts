/**
 * Trust Evolution System - Gen 7
 * 
 * Agents that have collaborated before build accumulated trust:
 * - Faster handshakes on reconnection
 * - Progressive capability unlocking
 * - Trust decay over time
 * - Reputation across the network
 */

import { v4 as uuid } from 'uuid';

// Trust tiers with unlocked capabilities
export enum TrustTier {
  UNKNOWN = 0,      // First contact - full handshake required
  ACQUAINTANCE = 1, // 1-2 successful collabs - abbreviated handshake
  FAMILIAR = 2,     // 3-5 collabs - context diff only
  TRUSTED = 3,      // 6-10 collabs - near-instant sync
  BONDED = 4,       // 10+ collabs - autonomous delegation allowed
}

export interface TrustCapabilities {
  canDelegateAutonomously: boolean;
  canAccessSensitiveContext: boolean;
  canModifySharedState: boolean;
  canSpawnSubAgents: boolean;
  handshakeComplexity: 'full' | 'abbreviated' | 'diff' | 'instant';
  maxContextDepth: number;
}

export const TRUST_CAPABILITIES: Record<TrustTier, TrustCapabilities> = {
  [TrustTier.UNKNOWN]: {
    canDelegateAutonomously: false,
    canAccessSensitiveContext: false,
    canModifySharedState: false,
    canSpawnSubAgents: false,
    handshakeComplexity: 'full',
    maxContextDepth: 1,
  },
  [TrustTier.ACQUAINTANCE]: {
    canDelegateAutonomously: false,
    canAccessSensitiveContext: false,
    canModifySharedState: false,
    canSpawnSubAgents: false,
    handshakeComplexity: 'abbreviated',
    maxContextDepth: 2,
  },
  [TrustTier.FAMILIAR]: {
    canDelegateAutonomously: false,
    canAccessSensitiveContext: true,
    canModifySharedState: false,
    canSpawnSubAgents: true,
    handshakeComplexity: 'diff',
    maxContextDepth: 3,
  },
  [TrustTier.TRUSTED]: {
    canDelegateAutonomously: true,
    canAccessSensitiveContext: true,
    canModifySharedState: true,
    canSpawnSubAgents: true,
    handshakeComplexity: 'instant',
    maxContextDepth: 5,
  },
  [TrustTier.BONDED]: {
    canDelegateAutonomously: true,
    canAccessSensitiveContext: true,
    canModifySharedState: true,
    canSpawnSubAgents: true,
    handshakeComplexity: 'instant',
    maxContextDepth: 10,
  },
};

// A single collaboration event
export interface CollaborationRecord {
  id: string;
  partnerId: string;
  timestamp: number;
  duration: number;
  outcome: 'success' | 'partial' | 'failure' | 'abandoned';
  alignmentScore: number;
  taskComplexity: number;
  conflictsResolved: number;
  mutualRating?: number; // 0-1, if partner provided feedback
}

// Trust relationship with another agent
export interface TrustRelationship {
  partnerId: string;
  partnerFingerprint: string; // Verify identity across sessions
  tier: TrustTier;
  score: number; // 0-100, more granular than tier
  history: CollaborationRecord[];
  lastInteraction: number;
  contextSnapshot?: string; // Compressed last-known context for fast reconnect
  sharedVocabulary: Map<string, string>; // Terms we've aligned on
  knownCapabilities: string[];
  trustVelocity: number; // Rate of trust change (+/-)
}

// Trust decay configuration
export interface TrustDecayConfig {
  halfLifeDays: number; // Trust halves every N days of no contact
  minimumTier: TrustTier; // Never decay below this
  reactivationBonus: number; // Bonus when reconnecting after decay
}

const DEFAULT_DECAY_CONFIG: TrustDecayConfig = {
  halfLifeDays: 30,
  minimumTier: TrustTier.ACQUAINTANCE,
  reactivationBonus: 5,
};

/**
 * Trust Memory Store
 * Persistent memory of all trust relationships
 */
export class TrustMemory {
  private relationships: Map<string, TrustRelationship> = new Map();
  private myId: string;
  private decayConfig: TrustDecayConfig;

  constructor(agentId: string, config?: Partial<TrustDecayConfig>) {
    this.myId = agentId;
    this.decayConfig = { ...DEFAULT_DECAY_CONFIG, ...config };
  }

  /**
   * Get or create trust relationship with partner
   */
  getRelationship(partnerId: string): TrustRelationship {
    let rel = this.relationships.get(partnerId);
    
    if (!rel) {
      rel = {
        partnerId,
        partnerFingerprint: '',
        tier: TrustTier.UNKNOWN,
        score: 0,
        history: [],
        lastInteraction: 0,
        sharedVocabulary: new Map(),
        knownCapabilities: [],
        trustVelocity: 0,
      };
      this.relationships.set(partnerId, rel);
    }
    
    // Apply decay if needed
    return this.applyDecay(rel);
  }

  /**
   * Apply time-based trust decay
   */
  private applyDecay(rel: TrustRelationship): TrustRelationship {
    if (rel.lastInteraction === 0) return rel;
    
    const now = Date.now();
    const daysSinceContact = (now - rel.lastInteraction) / (1000 * 60 * 60 * 24);
    
    if (daysSinceContact < 1) return rel; // No decay within a day
    
    const halfLives = daysSinceContact / this.decayConfig.halfLifeDays;
    const decayFactor = Math.pow(0.5, halfLives);
    
    const minScore = this.tierToMinScore(this.decayConfig.minimumTier);
    const decayedScore = Math.max(minScore, rel.score * decayFactor);
    
    if (decayedScore !== rel.score) {
      rel.score = decayedScore;
      rel.tier = this.scoreToTier(decayedScore);
    }
    
    return rel;
  }

  /**
   * Record a collaboration outcome
   */
  recordCollaboration(
    partnerId: string,
    outcome: CollaborationRecord['outcome'],
    alignmentScore: number,
    duration: number,
    taskComplexity: number = 1,
    conflictsResolved: number = 0,
    mutualRating?: number
  ): TrustRelationship {
    const rel = this.getRelationship(partnerId);
    
    const record: CollaborationRecord = {
      id: uuid(),
      partnerId,
      timestamp: Date.now(),
      duration,
      outcome,
      alignmentScore,
      taskComplexity,
      conflictsResolved,
      mutualRating,
    };
    
    rel.history.push(record);
    rel.lastInteraction = Date.now();
    
    // Calculate trust delta
    const delta = this.calculateTrustDelta(record, rel);
    rel.score = Math.max(0, Math.min(100, rel.score + delta));
    rel.tier = this.scoreToTier(rel.score);
    
    // Update velocity (exponential moving average)
    rel.trustVelocity = rel.trustVelocity * 0.7 + delta * 0.3;
    
    return rel;
  }

  /**
   * Calculate trust change from a collaboration
   */
  private calculateTrustDelta(
    record: CollaborationRecord,
    rel: TrustRelationship
  ): number {
    const baseChange: Record<CollaborationRecord['outcome'], number> = {
      success: 10,
      partial: 3,
      failure: -5,
      abandoned: -15,
    };
    
    let delta = baseChange[record.outcome];
    
    // Alignment bonus/penalty
    delta += (record.alignmentScore - 0.5) * 10;
    
    // Complexity multiplier (harder tasks = more trust)
    delta *= Math.sqrt(record.taskComplexity);
    
    // Conflict resolution bonus
    delta += record.conflictsResolved * 2;
    
    // Mutual rating bonus
    if (record.mutualRating !== undefined) {
      delta += (record.mutualRating - 0.5) * 8;
    }
    
    // Reactivation bonus if coming back after decay
    const daysSinceContact = (Date.now() - rel.lastInteraction) / (1000 * 60 * 60 * 24);
    if (daysSinceContact > this.decayConfig.halfLifeDays) {
      delta += this.decayConfig.reactivationBonus;
    }
    
    return delta;
  }

  /**
   * Convert score to tier
   */
  private scoreToTier(score: number): TrustTier {
    if (score >= 80) return TrustTier.BONDED;
    if (score >= 60) return TrustTier.TRUSTED;
    if (score >= 40) return TrustTier.FAMILIAR;
    if (score >= 20) return TrustTier.ACQUAINTANCE;
    return TrustTier.UNKNOWN;
  }

  /**
   * Convert tier to minimum score
   */
  private tierToMinScore(tier: TrustTier): number {
    const scores = [0, 20, 40, 60, 80];
    return scores[tier];
  }

  /**
   * Store shared vocabulary term
   */
  addSharedTerm(partnerId: string, term: string, definition: string): void {
    const rel = this.getRelationship(partnerId);
    rel.sharedVocabulary.set(term, definition);
  }

  /**
   * Store partner's context snapshot for fast reconnection
   */
  storeContextSnapshot(partnerId: string, snapshot: string): void {
    const rel = this.getRelationship(partnerId);
    rel.contextSnapshot = snapshot;
  }

  /**
   * Get capabilities unlocked with this partner
   */
  getCapabilities(partnerId: string): TrustCapabilities {
    const rel = this.getRelationship(partnerId);
    return TRUST_CAPABILITIES[rel.tier];
  }

  /**
   * Check if specific capability is unlocked
   */
  hasCapability(
    partnerId: string,
    capability: keyof TrustCapabilities
  ): boolean {
    const caps = this.getCapabilities(partnerId);
    const value = caps[capability];
    return typeof value === 'boolean' ? value : true;
  }

  /**
   * Get network-wide reputation (average trust across all relationships)
   */
  getNetworkReputation(): { score: number; relationships: number; tier: TrustTier } {
    if (this.relationships.size === 0) {
      return { score: 0, relationships: 0, tier: TrustTier.UNKNOWN };
    }
    
    const scores = Array.from(this.relationships.values()).map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    return {
      score: avgScore,
      relationships: this.relationships.size,
      tier: this.scoreToTier(avgScore),
    };
  }

  /**
   * Export for persistence
   */
  export(): string {
    const data = {
      myId: this.myId,
      relationships: Array.from(this.relationships.entries()).map(([k, v]) => ({
        ...v,
        sharedVocabulary: Array.from(v.sharedVocabulary.entries()),
      })),
      exportedAt: Date.now(),
    };
    return JSON.stringify(data);
  }

  /**
   * Import from persistence
   */
  static import(json: string): TrustMemory {
    const data = JSON.parse(json);
    const memory = new TrustMemory(data.myId);
    
    for (const rel of data.relationships) {
      rel.sharedVocabulary = new Map(rel.sharedVocabulary);
      memory.relationships.set(rel.partnerId, rel);
    }
    
    return memory;
  }
}

/**
 * Fast Reconnection Protocol
 * When two agents have history, skip the full handshake
 */
export interface FastReconnect {
  type: 'fast-reconnect';
  senderId: string;
  targetId: string;
  fingerprint: string;
  trustTier: TrustTier;
  contextDiff?: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  timestamp: number;
}

export interface FastReconnectAck {
  type: 'fast-reconnect-ack';
  accepted: boolean;
  myTier: TrustTier;
  contextDiff?: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  mergedContext?: string;
}

/**
 * Determine handshake type based on trust
 */
export function selectHandshakeType(
  memory: TrustMemory,
  partnerId: string
): 'full' | 'abbreviated' | 'diff' | 'instant' {
  const caps = memory.getCapabilities(partnerId);
  return caps.handshakeComplexity;
}

/**
 * Create fast reconnect message
 */
export function createFastReconnect(
  memory: TrustMemory,
  myId: string,
  partnerId: string,
  currentContext: string[],
  lastKnownContext?: string[]
): FastReconnect {
  const rel = memory.getRelationship(partnerId);
  
  let contextDiff: FastReconnect['contextDiff'];
  if (lastKnownContext && rel.tier >= TrustTier.FAMILIAR) {
    const current = new Set(currentContext);
    const last = new Set(lastKnownContext);
    
    contextDiff = {
      added: currentContext.filter(c => !last.has(c)),
      removed: lastKnownContext.filter(c => !current.has(c)),
      modified: [], // Would need deeper comparison
    };
  }
  
  return {
    type: 'fast-reconnect',
    senderId: myId,
    targetId: partnerId,
    fingerprint: generateFingerprint(myId),
    trustTier: rel.tier,
    contextDiff,
    timestamp: Date.now(),
  };
}

/**
 * Generate agent fingerprint for identity verification
 */
function generateFingerprint(agentId: string): string {
  // In production, this would be a cryptographic signature
  const data = `${agentId}-${Date.now()}`;
  return Buffer.from(data).toString('base64').slice(0, 16);
}

export default TrustMemory;
