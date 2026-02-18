/**
 * Trust Evolution System - Gen 7
 *
 * Agents that have collaborated before build accumulated trust:
 * - Faster handshakes on reconnection
 * - Progressive capability unlocking
 * - Trust decay over time
 * - Reputation across the network
 */
export declare enum TrustTier {
    UNKNOWN = 0,// First contact - full handshake required
    ACQUAINTANCE = 1,// 1-2 successful collabs - abbreviated handshake
    FAMILIAR = 2,// 3-5 collabs - context diff only
    TRUSTED = 3,// 6-10 collabs - near-instant sync
    BONDED = 4
}
export interface TrustCapabilities {
    canDelegateAutonomously: boolean;
    canAccessSensitiveContext: boolean;
    canModifySharedState: boolean;
    canSpawnSubAgents: boolean;
    handshakeComplexity: 'full' | 'abbreviated' | 'diff' | 'instant';
    maxContextDepth: number;
}
export declare const TRUST_CAPABILITIES: Record<TrustTier, TrustCapabilities>;
export interface CollaborationRecord {
    id: string;
    partnerId: string;
    timestamp: number;
    duration: number;
    outcome: 'success' | 'partial' | 'failure' | 'abandoned';
    alignmentScore: number;
    taskComplexity: number;
    conflictsResolved: number;
    mutualRating?: number;
}
export interface TrustRelationship {
    partnerId: string;
    partnerFingerprint: string;
    tier: TrustTier;
    score: number;
    history: CollaborationRecord[];
    lastInteraction: number;
    contextSnapshot?: string;
    sharedVocabulary: Map<string, string>;
    knownCapabilities: string[];
    trustVelocity: number;
}
export interface TrustDecayConfig {
    halfLifeDays: number;
    minimumTier: TrustTier;
    reactivationBonus: number;
}
/**
 * Trust Memory Store
 * Persistent memory of all trust relationships
 */
export declare class TrustMemory {
    private relationships;
    private myId;
    private decayConfig;
    constructor(agentId: string, config?: Partial<TrustDecayConfig>);
    /**
     * Get or create trust relationship with partner
     */
    getRelationship(partnerId: string): TrustRelationship;
    /**
     * Apply time-based trust decay
     */
    private applyDecay;
    /**
     * Record a collaboration outcome
     */
    recordCollaboration(partnerId: string, outcome: CollaborationRecord['outcome'], alignmentScore: number, duration: number, taskComplexity?: number, conflictsResolved?: number, mutualRating?: number): TrustRelationship;
    /**
     * Calculate trust change from a collaboration
     */
    private calculateTrustDelta;
    /**
     * Convert score to tier
     */
    private scoreToTier;
    /**
     * Convert tier to minimum score
     */
    private tierToMinScore;
    /**
     * Store shared vocabulary term
     */
    addSharedTerm(partnerId: string, term: string, definition: string): void;
    /**
     * Store partner's context snapshot for fast reconnection
     */
    storeContextSnapshot(partnerId: string, snapshot: string): void;
    /**
     * Get capabilities unlocked with this partner
     */
    getCapabilities(partnerId: string): TrustCapabilities;
    /**
     * Check if specific capability is unlocked
     */
    hasCapability(partnerId: string, capability: keyof TrustCapabilities): boolean;
    /**
     * Get network-wide reputation (average trust across all relationships)
     */
    getNetworkReputation(): {
        score: number;
        relationships: number;
        tier: TrustTier;
    };
    /**
     * Export for persistence
     */
    export(): string;
    /**
     * Import from persistence
     */
    static import(json: string): TrustMemory;
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
export declare function selectHandshakeType(memory: TrustMemory, partnerId: string): 'full' | 'abbreviated' | 'diff' | 'instant';
/**
 * Create fast reconnect message
 */
export declare function createFastReconnect(memory: TrustMemory, myId: string, partnerId: string, currentContext: string[], lastKnownContext?: string[]): FastReconnect;
export default TrustMemory;
