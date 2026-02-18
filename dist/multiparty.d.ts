/**
 * Multi-party Context Handshake Protocol
 *
 * Extends 2-party handshakes to N-party collaboration.
 * Uses hub-and-spoke for small groups, gossip protocol for large swarms.
 *
 * HEF Evolution: Instance 28, Generation 6
 * Techniques: G08 (Combine), R12 (Scale), S03 (Cross-Domain from distributed systems)
 */
import { ContextPacket, AlignmentScore } from './protocol';
export interface PartyInfo {
    agentId: string;
    context: ContextPacket;
    joinedAt: number;
    role: PartyRole;
    status: PartyStatus;
}
export type PartyRole = 'coordinator' | 'participant' | 'observer' | 'relay';
export type PartyStatus = 'pending' | 'syncing' | 'synced' | 'diverged' | 'disconnected';
export interface MultipartyConfig {
    strategy: TopologyStrategy;
    quorumType: 'majority' | 'unanimous' | 'threshold';
    quorumThreshold?: number;
    syncTimeoutMs: number;
    heartbeatIntervalMs: number;
    maxParties: number;
    gossipFanout: number;
    conflictResolution: 'coordinator-wins' | 'vote' | 'merge-all';
}
export type TopologyStrategy = 'hub-and-spoke' | 'full-mesh' | 'gossip' | 'hierarchical';
export interface MultipartySession {
    sessionId: string;
    createdAt: number;
    lastSync: number;
    parties: Map<string, PartyInfo>;
    coordinator?: string;
    phase: MultipartyPhase;
    globalContext: ContextPacket;
    alignmentMatrix: AlignmentMatrix;
    config: MultipartyConfig;
    metrics: MultipartyMetrics;
}
export type MultipartyPhase = 'gathering' | 'handshaking' | 'merging' | 'active' | 'closing';
export interface AlignmentMatrix {
    scores: Map<string, Map<string, AlignmentScore>>;
    globalAlignment: number;
    weakestLink: {
        from: string;
        to: string;
        score: number;
    } | null;
}
export interface MultipartyMetrics {
    totalHandshakes: number;
    successfulHandshakes: number;
    failedHandshakes: number;
    averageAlignmentTime: number;
    resyncCount: number;
    messageCount: number;
}
export declare class MultipartyEngine {
    private defaultConfig;
    private sessions;
    private handshakeEngine;
    private mergeEngine;
    private alignmentEngine;
    constructor(defaultConfig?: Partial<MultipartyConfig>);
    /**
     * Create a new multiparty session
     */
    createSession(initiator: ContextPacket, config?: Partial<MultipartyConfig>): Promise<MultipartySession>;
    /**
     * Add a party to the session
     */
    addParty(sessionId: string, newParty: ContextPacket, role?: PartyRole): Promise<{
        success: boolean;
        alignment: number;
        session: MultipartySession;
    }>;
    /**
     * Run handshakes based on topology strategy
     */
    private runStrategyHandshake;
    /**
     * Hub-and-spoke: New party only handshakes with coordinator
     */
    private hubAndSpokeHandshake;
    /**
     * Full-mesh: New party handshakes with all existing parties
     */
    private fullMeshHandshake;
    /**
     * Gossip: Epidemic-style propagation for large swarms
     */
    private gossipHandshake;
    /**
     * Hierarchical: Tree structure with sub-coordinators
     */
    private hierarchicalHandshake;
    /**
     * Propagate context update via gossip
     */
    private propagateGossip;
    /**
     * Check if quorum is met for a decision
     */
    checkQuorum(session: MultipartySession, agreeing: string[]): boolean;
    /**
     * Broadcast context update to all parties
     */
    broadcastUpdate(sessionId: string, update: Partial<ContextPacket>, fromAgent: string): Promise<void>;
    private coordinatorRelay;
    private directBroadcast;
    private gossipBroadcast;
    private hierarchicalBroadcast;
    /**
     * Handle party disconnection
     */
    removeParty(sessionId: string, agentId: string): Promise<void>;
    /**
     * Elect new coordinator
     */
    private electCoordinator;
    /**
     * Sync all parties (periodic reconciliation)
     */
    syncAll(sessionId: string): Promise<void>;
    /**
     * Get session status
     */
    getSession(sessionId: string): MultipartySession | undefined;
    /**
     * Close session
     */
    closeSession(sessionId: string): Promise<void>;
    private setAlignmentScore;
    private updateAlignmentMatrix;
    private getAverageAlignment;
    private randomSample;
}
/**
 * Quick multiparty session for a list of agents
 */
export declare function quickMultipartySync(agents: ContextPacket[], config?: Partial<MultipartyConfig>): Promise<MultipartySession>;
/**
 * Check if all agents are sufficiently aligned
 */
export declare function isGroupAligned(session: MultipartySession, minAlignment?: number): boolean;
/**
 * Get the least aligned pair for targeted reconciliation
 */
export declare function getLeastAlignedPair(session: MultipartySession): {
    from: string;
    to: string;
    score: number;
} | null;
/**
 * Swarm handshake: specialized for large groups
 */
export declare function swarmHandshake(agents: ContextPacket[], options?: {
    fanout?: number;
    quorum?: number;
}): Promise<MultipartySession>;
