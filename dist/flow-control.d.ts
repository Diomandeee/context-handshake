/**
 * Flow Control & Backpressure for Context Handshake
 *
 * Like TCP flow control but for mental models. Prevents context flooding,
 * manages cognitive bandwidth, and adapts to agent processing capacity.
 *
 * Gen 6 Evolution - Instance 28
 * Task: task_20260202091841_38ae9a
 *
 * TCP Analogues:
 * - Sliding window → Context window (how much to send before ACK)
 * - Receive window → Processing capacity advertisement
 * - Congestion window → Network of agents capacity
 * - Slow start → Gradual context revelation
 * - Fast retransmit → Quick re-sync on divergence
 */
import { EventEmitter } from 'events';
/** Context chunk with flow control metadata */
export interface ContextChunk {
    id: string;
    sequenceNumber: number;
    payload: ContextPayload;
    timestamp: number;
    priority: ChunkPriority;
    byteSize: number;
    tokenEstimate: number;
    requiresAck: boolean;
}
export interface ContextPayload {
    type: 'belief' | 'capability' | 'constraint' | 'goal' | 'memory' | 'preference';
    content: unknown;
    confidence: number;
    dependencies: string[];
}
export declare enum ChunkPriority {
    CRITICAL = 0,// Must be processed (identity, constraints)
    HIGH = 1,// Important for task (goals, key beliefs)
    NORMAL = 2,// Regular context
    LOW = 3,// Nice to have
    BACKGROUND = 4
}
/** Acknowledgment from receiver */
export interface ContextAck {
    lastSequence: number;
    receivedChunks: string[];
    missingChunks: string[];
    selectiveAck: SelectiveAck[];
    advertisedWindow: WindowAdvertisement;
    processingLatency: number;
    backpressureSignal?: BackpressureSignal;
}
export interface SelectiveAck {
    startSeq: number;
    endSeq: number;
}
export interface WindowAdvertisement {
    /** Chunks receiver can accept */
    receiveWindow: number;
    /** Token budget remaining */
    tokenBudget: number;
    /** Types currently accepting */
    acceptingTypes: ContextPayload['type'][];
    /** Processing rate (chunks/sec) */
    processingRate: number;
    /** Estimated latency for full processing */
    estimatedLatency: number;
}
export interface BackpressureSignal {
    type: 'slow_down' | 'pause' | 'resume' | 'drop_priority';
    severity: number;
    dropBelow?: ChunkPriority;
    pauseMs?: number;
    reason: string;
}
/** Flow control state for one direction */
export interface FlowState {
    sendWindow: number;
    congestionWindow: number;
    ssthresh: number;
    unackedChunks: Map<number, ContextChunk>;
    nextSeq: number;
    lastAckedSeq: number;
    receiveWindow: number;
    expectedSeq: number;
    receiveBuffer: Map<number, ContextChunk>;
    processedSeq: number;
    rtt: number;
    rttVariance: number;
    bytesInFlight: number;
    tokensInFlight: number;
    duplicateAcks: number;
}
export interface FlowControlConfig {
    initialWindow: number;
    maxWindow: number;
    minWindow: number;
    initialSsthresh: number;
    tokenBudget: number;
    ackTimeout: number;
    maxRetries: number;
    slowStartIncrease: number;
    congestionAvoidanceIncrease: number;
    multiplicativeDecrease: number;
}
export declare class FlowControlManager extends EventEmitter {
    private readonly config;
    private readonly sendState;
    private readonly receiveState;
    private readonly pendingChunks;
    private readonly retryTimers;
    private isPaused;
    private pauseUntil;
    constructor(config?: Partial<FlowControlConfig>);
    private createInitialFlowState;
    /** Queue context for transmission with flow control */
    send(payload: ContextPayload, priority?: ChunkPriority): Promise<string>;
    /** Send multiple chunks respecting flow control */
    sendBatch(payloads: Array<{
        payload: ContextPayload;
        priority?: ChunkPriority;
    }>): Promise<string[]>;
    private createChunk;
    private canSendNow;
    private transmitChunk;
    private queueChunk;
    private flushQueue;
    /** Process received chunk */
    receive(chunk: ContextChunk): Promise<ContextAck>;
    private processChunk;
    private processBufferedChunks;
    private generateAck;
    private findMissingChunks;
    private calculateReceiveWindow;
    private getRemainingTokenBudget;
    private getAcceptingTypes;
    private calculateProcessingRate;
    private estimateProcessingLatency;
    private calculateBackpressure;
    /** Process acknowledgment from receiver */
    handleAck(ack: ContextAck): Promise<void>;
    private updateRtt;
    private calculateTimeout;
    private handleTimeout;
    private handleFastRetransmit;
    private retransmit;
    private adjustCongestionWindow;
    private handleBackpressure;
    /** Get current flow control metrics */
    getMetrics(): FlowControlMetrics;
    /** Reset flow control state */
    reset(): void;
    /** Graceful shutdown */
    close(): Promise<void>;
}
export interface FlowControlMetrics {
    send: {
        window: number;
        congestionWindow: number;
        ssthresh: number;
        inFlight: number;
        bytesInFlight: number;
        tokensInFlight: number;
        queueLength: number;
        rtt: number;
    };
    receive: {
        window: number;
        bufferSize: number;
        expectedSeq: number;
        processedSeq: number;
        tokenBudgetRemaining: number;
    };
    isPaused: boolean;
}
/**
 * Learns optimal flow control parameters from collaboration history
 */
export declare class AdaptiveFlowController {
    private readonly history;
    private readonly agentProfiles;
    /** Record a completed exchange */
    recordExchange(agentId: string, metrics: FlowControlMetrics, outcome: ExchangeOutcome): void;
    /** Get optimized config for an agent */
    getOptimizedConfig(agentId: string): Partial<FlowControlConfig>;
    private updateAgentProfile;
}
interface ExchangeOutcome {
    success: boolean;
    timeoutCount: number;
    retransmitCount: number;
    dropCount: number;
    totalChunks: number;
    duration: number;
}
/**
 * Prevents starvation of low-priority chunks through aging
 */
export declare class AgingPriorityQueue {
    private readonly chunks;
    private readonly agingRateMs;
    constructor(agingRateMs?: number);
    enqueue(chunk: ContextChunk): void;
    dequeue(): ContextChunk | undefined;
    private effectivePriority;
    get length(): number;
    peek(): ContextChunk | undefined;
}
export default FlowControlManager;
