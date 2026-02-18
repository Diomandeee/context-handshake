/**
 * Resilience & Recovery for Context Handshakes
 *
 * HEF Evolution: Instance 28, Generation 6
 *
 * What happens when handshakes fail? Timeouts, disconnects, partial syncs...
 * This module provides:
 * - Checkpoint/resume for interrupted handshakes
 * - Graceful degradation with partial context
 * - Automatic retry with exponential backoff
 * - Circuit breakers for persistently failing agents
 * - Recovery strategies based on failure type
 */
import type { ContextOffer, HandshakeSession, MergedContext } from './protocol';
export type FailureType = 'timeout' | 'disconnect' | 'alignment_failed' | 'negotiation_stalled' | 'compression_error' | 'trust_violation' | 'resource_exhausted' | 'version_mismatch' | 'unknown';
export interface FailureEvent {
    type: FailureType;
    timestamp: number;
    phase: 'syn' | 'syn-ack' | 'ack' | 'streaming' | 'finalization';
    agentId: string;
    sessionId: string;
    message: string;
    recoverable: boolean;
    checkpoint?: HandshakeCheckpoint;
    metadata?: Record<string, unknown>;
}
export interface HandshakeCheckpoint {
    id: string;
    sessionId: string;
    createdAt: number;
    expiresAt: number;
    phase: 'syn' | 'syn-ack' | 'ack' | 'streaming';
    initiator: {
        agentId: string;
        contextSent: boolean;
        context?: Partial<ContextOffer>;
    };
    responder: {
        agentId: string;
        contextReceived: boolean;
        alignmentScore?: number;
        context?: Partial<ContextOffer>;
    };
    streaming?: {
        chunksTransferred: number;
        totalChunks: number;
        lastChunkId: string;
        alignmentProgression: number[];
    };
    retryCount: number;
    lastFailure?: FailureType;
    recommendedStrategy: RecoveryStrategy;
}
export type RecoveryStrategy = 'retry_immediate' | 'retry_backoff' | 'resume_checkpoint' | 'fallback_minimal' | 'fallback_fingerprint' | 'escalate_trust' | 'switch_protocol' | 'abort_circuit_open' | 'delegate_recovery' | 'proceed_partial';
export interface RecoveryPlan {
    strategy: RecoveryStrategy;
    delayMs: number;
    maxAttempts: number;
    checkpoint?: HandshakeCheckpoint;
    fallbackContext?: Partial<MergedContext>;
    notes: string;
}
/**
 * Determine best recovery strategy based on failure type
 */
export declare function determineRecoveryStrategy(failure: FailureEvent, history: FailureEvent[], config: ResilienceConfig): RecoveryPlan;
export declare class CheckpointManager {
    private config;
    private checkpoints;
    private cleanupInterval;
    constructor(config: ResilienceConfig);
    /**
     * Create checkpoint from current handshake state
     */
    createCheckpoint(session: HandshakeSession, phase: HandshakeCheckpoint['phase'], streamingState?: HandshakeCheckpoint['streaming']): HandshakeCheckpoint;
    /**
     * Update checkpoint after retry
     */
    updateAfterRetry(checkpointId: string, failure: FailureType): HandshakeCheckpoint | null;
    /**
     * Get checkpoint by session ID
     */
    getBySessionId(sessionId: string): HandshakeCheckpoint | null;
    /**
     * Remove checkpoint (successful handshake)
     */
    remove(checkpointId: string): void;
    private cleanupExpired;
    destroy(): void;
}
export interface CircuitState {
    agentId: string;
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailure: number;
    openedAt?: number;
    halfOpenAttempts: number;
}
export declare class CircuitBreaker {
    private config;
    private circuits;
    constructor(config: ResilienceConfig);
    /**
     * Check if we can attempt handshake with this agent
     */
    canAttempt(agentId: string): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Record a failure
     */
    recordFailure(agentId: string): void;
    /**
     * Record a success
     */
    recordSuccess(agentId: string): void;
    /**
     * Get current circuit state
     */
    getState(agentId: string): CircuitState | null;
    /**
     * Get all open circuits
     */
    getOpenCircuits(): CircuitState[];
}
export interface DegradationLevel {
    level: 'full' | 'streaming' | 'minimal' | 'fingerprint' | 'emergency';
    capabilities: string[];
    maxContextSize: number;
    timeoutMs: number;
    description: string;
}
declare const DEGRADATION_LEVELS: DegradationLevel[];
export declare class GracefulDegradation {
    private config;
    private currentLevel;
    private degradationHistory;
    constructor(config: ResilienceConfig);
    /**
     * Degrade to next level
     */
    degrade(reason: string): DegradationLevel;
    /**
     * Try to recover to higher level
     */
    attemptRecovery(): DegradationLevel | null;
    getCurrentLevel(): DegradationLevel;
    reset(): void;
}
export interface ResilienceConfig {
    baseBackoffMs: number;
    maxBackoffMs: number;
    maxRetries: number;
    circuitBreakerThreshold: number;
    circuitBreakerCooldownMs: number;
    halfOpenMaxAttempts: number;
    failureWindowMs: number;
    enableCheckpoints: boolean;
    checkpointTtlMs: number;
    enableAutoCleanup: boolean;
    cleanupIntervalMs: number;
    recoveryWindowMs: number;
}
export declare const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig;
export declare class ResilientHandshakeExecutor {
    private config;
    private checkpointManager;
    private circuitBreaker;
    private degradation;
    private failureHistory;
    constructor(config?: ResilienceConfig);
    /**
     * Execute handshake with full resilience
     */
    executeWithResilience<T>(targetAgentId: string, handshakeFn: (level: DegradationLevel) => Promise<T>, onCheckpoint?: (checkpoint: HandshakeCheckpoint) => void): Promise<{
        success: boolean;
        result?: T;
        error?: string;
        attempts: number;
    }>;
    private classifyError;
    private isRecoverable;
    private sleep;
    getCircuitState(agentId: string): CircuitState | null;
    getCurrentDegradationLevel(): DegradationLevel;
    getOpenCircuits(): CircuitState[];
    getFailureHistory(): FailureEvent[];
    destroy(): void;
}
export interface HealthStatus {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    degradationLevel: string;
    openCircuits: number;
    recentFailures: number;
    uptime: number;
    lastSuccessfulHandshake?: number;
}
export declare class HealthMonitor {
    private executor;
    private config;
    private startTime;
    private lastSuccess;
    constructor(executor: ResilientHandshakeExecutor, config: ResilienceConfig);
    recordSuccess(): void;
    getHealth(): HealthStatus;
}
export { DEGRADATION_LEVELS };
