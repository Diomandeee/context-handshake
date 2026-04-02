/**
 * Memory-Aware Handshake - Gen 7
 *
 * Integrates Trust Memory with the handshake protocol:
 * - Automatic handshake type selection based on relationship history
 * - Progressive capability unlocking
 * - Context caching for instant reconnection
 * - Trust-based conflict resolution
 */
import TrustMemory, { TrustTier, TrustCapabilities, FastReconnect, FastReconnectAck } from './trust';
export interface TrustAwareContext {
    agentId: string;
    concepts: Map<string, string>;
    assumptions: string[];
    goals: string[];
    capabilities: string[];
    trustMemory: TrustMemory;
    sensitiveContext?: string[];
    delegationPreferences?: DelegationPrefs;
}
export interface DelegationPrefs {
    allowAutonomousDelegation: boolean;
    maxDelegationDepth: number;
    requireApprovalFor: string[];
}
export interface MemoryHandshakeResult {
    success: boolean;
    handshakeType: 'full' | 'abbreviated' | 'diff' | 'instant';
    trustTier: TrustTier;
    unlockedCapabilities: TrustCapabilities;
    mergedContext: MergedContext;
    reconnectionTime: number;
    trustDelta: number;
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
export declare class MemoryHandshake {
    private myContext;
    private handshakeLog;
    constructor(context: TrustAwareContext);
    /**
     * Initiate handshake with partner
     * Automatically selects optimal strategy based on trust
     */
    initiate(partnerId: string): Promise<MemoryHandshakeResult>;
    /**
     * Instant reconnect for bonded/trusted partners
     * Just verify identity and sync recent changes
     */
    private instantReconnect;
    /**
     * Diff handshake for familiar partners
     * Only exchange what's changed since last interaction
     */
    private diffHandshake;
    /**
     * Abbreviated handshake for acquaintances
     * Skip deep alignment, focus on essentials
     */
    private abbreviatedHandshake;
    /**
     * Full handshake for unknown partners
     * Complete context exchange and alignment
     */
    private fullHandshake;
    /**
     * Handle incoming handshake request
     */
    respond(request: FastReconnect): Promise<FastReconnectAck>;
    /**
     * Record handshake outcome for trust evolution
     */
    recordOutcome(partnerId: string, success: boolean, alignmentScore: number, duration: number): void;
    /**
     * Log handshake for analysis
     */
    private logHandshake;
    /**
     * Get handshake statistics
     */
    getStats(): HandshakeStats;
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
export declare function resolveConflict(myContext: TrustAwareContext, partnerId: string, conflict: {
    topic: string;
    myView: string;
    theirView: string;
}): {
    winner: 'me' | 'them' | 'merge';
    resolution: string;
};
export default MemoryHandshake;
