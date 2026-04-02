/**
 * Context Fingerprinting - Gen 6 Evolution (Instance 28)
 *
 * Quick re-sync for agents who've collaborated before.
 * Like TLS session resumption - skip the full handshake when
 * both parties have a shared history.
 *
 * The Problem:
 * Full context handshakes are expensive. When Agent A and Agent B
 * have collaborated 10 times before, they shouldn't need to re-sync
 * their entire mental models each time.
 *
 * The Solution:
 * Context Fingerprinting creates compact, cryptographic signatures
 * of mental model states. Agents can compare fingerprints and only
 * sync the deltas.
 */
import { MentalModel } from './protocol';
/**
 * A fingerprint captures the essential "shape" of a context
 * in a compact, comparable form.
 */
export interface ContextFingerprint {
    /** Unique identifier for this fingerprint */
    id: string;
    /** Agent who generated this fingerprint */
    agentId: string;
    /** Hash of the full mental model */
    modelHash: string;
    /** Semantic vector embedding (compressed) */
    semanticVector: number[];
    /** Key concepts with their version numbers */
    conceptVersions: Map<string, number>;
    /** Timestamp of fingerprint generation */
    generatedAt: Date;
    /** How many interactions this fingerprint has been stable for */
    stabilityCount: number;
    /** Parent fingerprint (for tracking evolution) */
    parentId?: string;
}
/**
 * Result of comparing two fingerprints
 */
export interface FingerprintComparison {
    /** Overall similarity score (0-1) */
    similarity: number;
    /** Can we use quick-sync? */
    quickSyncEligible: boolean;
    /** Concepts that have diverged */
    divergedConcepts: string[];
    /** Concepts that are new in either model */
    newConcepts: {
        agentA: string[];
        agentB: string[];
    };
    /** Estimated sync overhead (0-1, where 1 = full handshake needed) */
    syncOverhead: number;
    /** Recommended sync strategy */
    strategy: 'full' | 'delta' | 'quick' | 'instant';
}
/**
 * Delta sync packet - only the changes
 */
export interface DeltaSync {
    /** Source fingerprint */
    fromFingerprint: string;
    /** Target fingerprint */
    toFingerprint: string;
    /** Changed concepts */
    changes: ConceptDelta[];
    /** Removed concepts */
    removals: string[];
    /** New concepts */
    additions: ConceptAddition[];
    /** Compressed size vs full sync */
    compressionRatio: number;
}
export interface ConceptDelta {
    concept: string;
    oldVersion: number;
    newVersion: number;
    patch: string;
}
export interface ConceptAddition {
    concept: string;
    version: number;
    fullContent: string;
    semanticEmbedding: number[];
}
/**
 * Fingerprint cache for managing known collaborators
 */
export interface FingerprintCache {
    /** Agent's own current fingerprint */
    self: ContextFingerprint;
    /** Known fingerprints from other agents */
    known: Map<string, CollaboratorHistory>;
    /** Quick-sync sessions in progress */
    activeSessions: Map<string, QuickSyncSession>;
}
export interface CollaboratorHistory {
    agentId: string;
    lastFingerprint: ContextFingerprint;
    fingerprintHistory: ContextFingerprint[];
    collaborationCount: number;
    lastCollaboration: Date;
    avgAlignmentScore: number;
    trustLevel: number;
}
export interface QuickSyncSession {
    sessionId: string;
    peerAgentId: string;
    startedAt: Date;
    status: 'comparing' | 'syncing' | 'verified' | 'fallback';
    deltaSync?: DeltaSync;
}
/**
 * Generate a fingerprint from a mental model
 */
export declare function generateFingerprint(agentId: string, model: MentalModel, parentFingerprint?: ContextFingerprint): ContextFingerprint;
/**
 * Compare two fingerprints to determine sync strategy
 */
export declare function compareFingerprints(mine: ContextFingerprint, theirs: ContextFingerprint): FingerprintComparison;
/**
 * Generate a delta sync packet between two states
 */
export declare function generateDeltaSync(fromFingerprint: ContextFingerprint, toFingerprint: ContextFingerprint, fromModel: MentalModel, toModel: MentalModel): DeltaSync;
/**
 * Apply a delta sync to update a mental model
 */
export declare function applyDeltaSync(model: MentalModel, delta: DeltaSync): MentalModel;
/**
 * Quick sync message types
 */
export type QuickSyncMessage = {
    type: 'FINGERPRINT_OFFER';
    fingerprint: ContextFingerprint;
} | {
    type: 'FINGERPRINT_MATCH';
    comparison: FingerprintComparison;
    myFingerprint: ContextFingerprint;
} | {
    type: 'DELTA_REQUEST';
    concepts: string[];
} | {
    type: 'DELTA_RESPONSE';
    delta: Partial<DeltaSync>;
} | {
    type: 'QUICK_SYNC_COMPLETE';
    mergedFingerprint: ContextFingerprint;
} | {
    type: 'FALLBACK_TO_FULL';
    reason: string;
};
/**
 * Initiate a quick sync with another agent
 */
export declare function initiateQuickSync(cache: FingerprintCache, peerAgentId: string): QuickSyncMessage;
/**
 * Handle incoming quick sync message
 */
export declare function handleQuickSyncMessage(cache: FingerprintCache, message: QuickSyncMessage, myModel: MentalModel): {
    response: QuickSyncMessage;
    updatedModel?: MentalModel;
};
/**
 * Update cache after successful collaboration
 */
export declare function updateCacheAfterCollaboration(cache: FingerprintCache, peerAgentId: string, peerFingerprint: ContextFingerprint, alignmentScore: number): void;
/**
 * Check if we should attempt quick sync with an agent
 */
export declare function shouldAttemptQuickSync(cache: FingerprintCache, peerAgentId: string): {
    eligible: boolean;
    reason: string;
    expectedOverhead?: number;
};
export declare const ContextFingerprinting: {
    generateFingerprint: typeof generateFingerprint;
    compareFingerprints: typeof compareFingerprints;
    generateDeltaSync: typeof generateDeltaSync;
    applyDeltaSync: typeof applyDeltaSync;
    initiateQuickSync: typeof initiateQuickSync;
    handleQuickSyncMessage: typeof handleQuickSyncMessage;
    updateCacheAfterCollaboration: typeof updateCacheAfterCollaboration;
    shouldAttemptQuickSync: typeof shouldAttemptQuickSync;
};
export default ContextFingerprinting;
