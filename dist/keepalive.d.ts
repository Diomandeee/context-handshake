/**
 * Keepalive & Drift Detection
 * HEF Evolution Instance 28, Generation 6
 *
 * Like TCP keepalives, but for mental models. During long collaborations,
 * agents can drift apart in understanding. This module detects and corrects
 * divergence before it causes problems.
 *
 * Techniques: G07 (Analogy Mining - TCP keepalive), R04 (Iterate), S03 (Emergent Synthesis)
 */
import type { MentalModel } from './protocol';
export interface DriftVector {
    dimension: string;
    originalValue: number;
    currentValue: number;
    delta: number;
    severity: 'minimal' | 'notable' | 'significant' | 'critical';
    cause?: DriftCause;
}
export type DriftCause = 'context_evolution' | 'external_input' | 'interpretation_shift' | 'goal_divergence' | 'assumption_decay' | 'unknown';
export interface KeepaliveProbe {
    id: string;
    sessionId: string;
    timestamp: number;
    type: 'heartbeat' | 'concept_check' | 'alignment_verify' | 'full_resync';
    payload: {
        modelFingerprint: string;
        conceptSnapshots: Map<string, ConceptSnapshot>;
        assumptionDigest: string;
        goalVector: number[];
    };
    sequence: number;
}
export interface ConceptSnapshot {
    concept: string;
    hash: string;
    confidence: number;
    lastModified: number;
    dependencies: string[];
}
export interface KeepaliveResponse {
    probeId: string;
    responderId: string;
    timestamp: number;
    status: 'in_sync' | 'minor_drift' | 'resync_needed' | 'diverged';
    driftVectors: DriftVector[];
    proposedCorrections?: CorrectionPatch[];
    resyncRequired: boolean;
}
export interface CorrectionPatch {
    type: 'update_concept' | 'add_concept' | 'remove_concept' | 'realign_goal' | 'refresh_assumption';
    target: string;
    payload: unknown;
    priority: number;
    bilateral: boolean;
}
export interface KeepaliveConfig {
    intervalMs: number;
    probeTimeoutMs: number;
    fullResyncIntervalMs: number;
    minorDriftThreshold: number;
    resyncThreshold: number;
    divergenceThreshold: number;
    autoCorrect: boolean;
    adaptiveInterval: boolean;
    conceptSampling: number;
    maxRetries: number;
    gracePeriodMs: number;
}
export interface KeepaliveSession {
    sessionId: string;
    agentA: string;
    agentB: string;
    startTime: number;
    lastProbe: number;
    lastSuccessfulSync: number;
    probesSent: number;
    probesReceived: number;
    driftHistory: DriftEvent[];
    currentAlignment: number;
    config: KeepaliveConfig;
    state: 'active' | 'degraded' | 'reconnecting' | 'diverged' | 'terminated';
}
export interface DriftEvent {
    timestamp: number;
    alignment: number;
    driftVectors: DriftVector[];
    correctionApplied: boolean;
    resyncTriggered: boolean;
}
export declare const DEFAULT_KEEPALIVE_CONFIG: KeepaliveConfig;
export declare class KeepaliveManager {
    private config;
    private sessions;
    private timers;
    private probeSequences;
    constructor(config?: Partial<KeepaliveConfig>);
    /**
     * Start keepalive monitoring for a session
     */
    startMonitoring(sessionId: string, agentA: string, agentB: string, initialAlignment?: number, customConfig?: Partial<KeepaliveConfig>): KeepaliveSession;
    /**
     * Stop monitoring a session
     */
    stopMonitoring(sessionId: string): void;
    /**
     * Generate a keepalive probe
     */
    generateProbe(sessionId: string, model: MentalModel, type?: KeepaliveProbe['type']): KeepaliveProbe | null;
    /**
     * Process a received probe and generate response
     */
    processProbe(probe: KeepaliveProbe, localModel: MentalModel): KeepaliveResponse;
    /**
     * Apply corrections from a keepalive response
     */
    applyCorrections(corrections: CorrectionPatch[], model: MentalModel): {
        applied: number;
        failed: number;
        model: MentalModel;
    };
    /**
     * Get session status
     */
    getSessionStatus(sessionId: string): KeepaliveSession | null;
    /**
     * Force an immediate probe
     */
    forceProbe(sessionId: string, type?: KeepaliveProbe['type']): void;
    private scheduleNextProbe;
    private executeProbe;
    private calculateInterval;
    private calculateDriftRate;
    private sampleConcepts;
    private detectDrift;
    private calculateAlignment;
    private classifyAlignment;
    private classifyDriftSeverity;
    private generateCorrections;
    private applyPatch;
    private updateSessionState;
    private createErrorResponse;
    private generateFingerprint;
    private digestAssumptions;
    private extractGoalVector;
    private hashConcept;
    private simpleHash;
    private estimateSimilarity;
    private cosineSimilarity;
    private shuffleArray;
}
export declare class DriftAnalyzer {
    /**
     * Analyze drift patterns over time
     */
    analyzePatterns(history: DriftEvent[]): DriftPattern[];
    private detectCyclicDrift;
    private detectAcceleratingDrift;
    private detectSuddenDivergence;
}
export interface DriftPattern {
    type: 'cyclic' | 'accelerating' | 'sudden' | 'gradual';
    confidence: number;
    description: string;
    recommendation: string;
}
export declare function createKeepaliveManager(config?: Partial<KeepaliveConfig>): KeepaliveManager;
export declare function createDriftAnalyzer(): DriftAnalyzer;
