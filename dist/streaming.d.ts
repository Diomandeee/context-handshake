/**
 * Streaming Handshakes - Gen 8 Evolution
 *
 * Progressive context synchronization for large mental models.
 * Instead of sending entire context at once, stream chunks with
 * real-time alignment feedback.
 *
 * HEF Task: task_20260201060247_ed139e
 * Instance: inst_20260131082143_957
 * Generation: 7 → 8
 *
 * Evolution Techniques: G03 (SCAMPER-Adapt), G08 (Combine streaming + handshake),
 * R09 (Optimize), thk:fractal (self-similar chunks)
 */
import { AgentContext } from './protocol';
export interface StreamChunk {
    chunkId: string;
    sequenceNumber: number;
    totalChunks: number;
    domain: ContextDomain;
    content: ChunkContent;
    priority: 'critical' | 'important' | 'supplementary';
    checksum: string;
}
export type ContextDomain = 'capabilities' | 'task_understanding' | 'key_concepts' | 'assumptions' | 'constraints' | 'domain_knowledge' | 'preferences' | 'history';
export interface ChunkContent {
    type: 'full' | 'delta' | 'reference';
    data: Record<string, unknown>;
    dependencies?: string[];
}
export interface StreamSession {
    sessionId: string;
    initiatorId: string;
    responderId: string;
    startedAt: Date;
    chunks: Map<string, StreamChunk>;
    alignmentHistory: AlignmentSnapshot[];
    status: StreamStatus;
    bandwidth: BandwidthConfig;
}
export type StreamStatus = 'initializing' | 'streaming' | 'awaiting_ack' | 'synchronized' | 'degraded' | 'failed';
export interface AlignmentSnapshot {
    timestamp: Date;
    chunksProcessed: number;
    cumulativeScore: number;
    domainScores: Map<ContextDomain, number>;
    divergences: DivergenceFlag[];
}
export interface DivergenceFlag {
    domain: ContextDomain;
    severity: 'minor' | 'moderate' | 'critical';
    description: string;
    suggestedResolution?: string;
}
export interface BandwidthConfig {
    maxChunkSize: number;
    throttleMs: number;
    priorityOrder: ContextDomain[];
    earlyTermination: {
        enabled: boolean;
        minScore: number;
        minChunks: number;
    };
}
export interface AlignmentScore {
    overall: number;
    conceptMatch: number;
    assumptionAlign: number;
    goalOverlap: number;
    capabilityComplement: number;
}
export interface StreamHandshakeResult {
    success: boolean;
    session: StreamSession;
    finalAlignment: AlignmentScore;
    mergedModel?: StreamMergedModel;
    chunksTransferred: number;
    duration: number;
    earlyTerminated: boolean;
}
export interface StreamMergedModel {
    sharedConcepts: Record<string, unknown>;
    combinedCapabilities: string[];
    reconciledAssumptions: string[];
    taskUnderstanding: string;
    divergenceResolutions: Array<{
        domain: string;
        resolution: string;
    }>;
}
export declare const DEFAULT_BANDWIDTH: BandwidthConfig;
export declare class ContextChunker {
    private maxChunkSize;
    constructor(maxChunkSize?: number);
    /**
     * Split a context offer into streamable chunks
     */
    chunk(context: AgentContext, priorityOrder: ContextDomain[]): StreamChunk[];
    private extractDomain;
    private splitDomain;
    private createChunk;
    private getPriority;
    private computeChecksum;
}
export declare class StreamingHandshake {
    private chunker;
    private bandwidth;
    private sessions;
    constructor(config?: Partial<BandwidthConfig>);
    /**
     * Initiate a streaming handshake (SYN with progressive chunks)
     */
    initiateStream(initiatorId: string, responderId: string, context: AgentContext, onProgress?: (snapshot: AlignmentSnapshot) => void): Promise<StreamHandshakeResult>;
    /**
     * Respond to streaming handshake (SYN-ACK with own stream)
     */
    respondToStream(sessionId: string, responderContext: AgentContext, onProgress?: (snapshot: AlignmentSnapshot) => void): Promise<StreamHandshakeResult>;
    /**
     * Complete handshake (ACK)
     */
    completeHandshake(sessionId: string): Promise<StreamSession>;
    private calculateProgressiveAlignment;
    private scoreDomain;
    private shouldTerminate;
    private snapshotToScore;
    private buildMergedModel;
    private groupByDomain;
    private mergeChunks;
    private delay;
    getSession(sessionId: string): StreamSession | undefined;
    listSessions(): StreamSession[];
    cleanupSession(sessionId: string): boolean;
}
export declare function visualizeStreamProgress(session: StreamSession): string;
export declare function demoStreamingHandshake(): Promise<void>;
