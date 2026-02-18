/**
 * Connection Pooling & Multiplexing
 *
 * Like HTTP/2 for AI context:
 * - Reuse warmed-up handshakes (avoid cold-start overhead)
 * - Multiplex multiple context streams over one session
 * - Intelligent connection lifecycle management
 * - Priority-based stream scheduling
 *
 * Gen 6 Instance 28: task_20260202140742_1914bd
 */
import { EventEmitter } from 'events';
/**
 * Unique identifier for a multiplexed stream within a session
 */
export type StreamId = `stream_${string}`;
/**
 * Connection pool key - identifies a unique agent pair
 */
export type PoolKey = `${string}<->${string}`;
/**
 * Stream state following HTTP/2 model
 */
export declare enum StreamState {
    IDLE = "idle",// Stream created but not active
    RESERVED = "reserved",// Reserved for push (server-initiated)
    OPEN = "open",// Active bidirectional communication
    HALF_CLOSED_LOCAL = "half_closed_local",// No more local sends
    HALF_CLOSED_REMOTE = "half_closed_remote",// No more remote sends
    CLOSED = "closed"
}
/**
 * Connection state in the pool
 */
export declare enum ConnectionState {
    CONNECTING = "connecting",// Handshake in progress
    READY = "ready",// Fully warmed, ready for streams
    BUSY = "busy",// At max concurrent streams
    DRAINING = "draining",// Accepting no new streams, finishing existing
    CLOSED = "closed"
}
/**
 * Stream priority (following HTTP/2 priority model)
 */
export interface StreamPriority {
    /** Weight 1-256, higher = more resources */
    weight: number;
    /** Optional dependency on another stream */
    dependsOn?: StreamId;
    /** If true, takes priority over dependsOn's children */
    exclusive?: boolean;
}
/**
 * A single multiplexed stream within a pooled connection
 */
export interface MultiplexedStream {
    id: StreamId;
    state: StreamState;
    priority: StreamPriority;
    /** Context topic/namespace for this stream */
    topic: string;
    /** Stream-specific context fragment */
    contextFragment: ContextFragment;
    /** Bytes sent on this stream */
    bytesSent: number;
    /** Bytes received on this stream */
    bytesReceived: number;
    /** Flow control window (per-stream) */
    flowWindow: number;
    /** Stream creation timestamp */
    createdAt: Date;
    /** Last activity timestamp */
    lastActivity: Date;
    /** Error if stream failed */
    error?: StreamError;
}
/**
 * Context fragment for a specific stream
 */
export interface ContextFragment {
    /** Fragment namespace */
    namespace: string;
    /** Key-value context data */
    data: Record<string, unknown>;
    /** Fragment version for delta sync */
    version: number;
    /** Parent fragment this extends */
    parent?: string;
}
/**
 * Stream error information
 */
export interface StreamError {
    code: StreamErrorCode;
    message: string;
    recoverable: boolean;
}
export declare enum StreamErrorCode {
    NO_ERROR = 0,
    PROTOCOL_ERROR = 1,
    INTERNAL_ERROR = 2,
    FLOW_CONTROL_ERROR = 3,
    STREAM_CLOSED = 5,
    FRAME_SIZE_ERROR = 6,
    REFUSED_STREAM = 7,
    CANCEL = 8,
    CONTEXT_OVERFLOW = 9,
    ALIGNMENT_FAILED = 10,
    TIMEOUT = 11
}
/**
 * A pooled connection to another agent
 */
export interface PooledConnection {
    id: string;
    poolKey: PoolKey;
    state: ConnectionState;
    /** Agent IDs */
    localAgent: string;
    remoteAgent: string;
    /** Active streams on this connection */
    streams: Map<StreamId, MultiplexedStream>;
    /** Connection-level flow window */
    connectionFlowWindow: number;
    /** Max concurrent streams (negotiated) */
    maxConcurrentStreams: number;
    /** Session-wide context (shared across streams) */
    sessionContext: SessionContext;
    /** Alignment score from initial handshake */
    alignmentScore: number;
    /** Trust tier from trust memory */
    trustTier: number;
    /** When handshake completed */
    establishedAt: Date;
    /** Last activity on any stream */
    lastActivity: Date;
    /** Number of times this connection was reused */
    reuseCount: number;
    /** Performance metrics */
    metrics: ConnectionMetrics;
}
/**
 * Session-level context shared across all streams
 */
export interface SessionContext {
    /** Merged mental model from handshake */
    mergedModel: Record<string, unknown>;
    /** Shared assumptions */
    assumptions: string[];
    /** Active goals */
    goals: string[];
    /** Negotiated capabilities */
    capabilities: string[];
}
/**
 * Connection performance metrics
 */
export interface ConnectionMetrics {
    /** Total streams created */
    totalStreams: number;
    /** Streams completed successfully */
    successfulStreams: number;
    /** Streams that errored */
    failedStreams: number;
    /** Total bytes sent */
    totalBytesSent: number;
    /** Total bytes received */
    totalBytesReceived: number;
    /** Average stream latency (ms) */
    avgStreamLatency: number;
    /** P99 stream latency (ms) */
    p99StreamLatency: number;
    /** Connection lifetime (ms) */
    uptime: number;
}
/**
 * Pool configuration
 */
export interface PoolConfig {
    /** Max connections per remote agent */
    maxConnectionsPerAgent: number;
    /** Max total connections in pool */
    maxTotalConnections: number;
    /** Max concurrent streams per connection */
    maxStreamsPerConnection: number;
    /** Connection idle timeout (ms) - close if no streams */
    idleTimeout: number;
    /** Max connection lifetime (ms) - force refresh */
    maxLifetime: number;
    /** Initial flow control window (bytes) */
    initialFlowWindow: number;
    /** Max flow control window (bytes) */
    maxFlowWindow: number;
    /** Connection warmup - pre-establish with known agents */
    warmupAgents: string[];
    /** Min warm connections to maintain */
    minWarmConnections: number;
    /** Health check interval (ms) */
    healthCheckInterval: number;
    /** Connection health threshold (0-1) */
    healthThreshold: number;
}
/**
 * Default pool configuration
 */
export declare const DEFAULT_POOL_CONFIG: PoolConfig;
/**
 * Manages a pool of multiplexed connections to AI agents
 */
export declare class ConnectionPool extends EventEmitter {
    private config;
    private connections;
    private agentConnections;
    private healthCheckTimer?;
    private nextStreamId;
    private stats;
    constructor(config?: Partial<PoolConfig>);
    /**
     * Initialize pool with warmup connections
     */
    initialize(): Promise<void>;
    /**
     * Acquire a connection to a remote agent
     * Returns existing warm connection or creates new one
     */
    acquire(localAgent: string, remoteAgent: string, options?: AcquireOptions): Promise<PooledConnection>;
    /**
     * Open a new stream on a pooled connection
     */
    openStream(connection: PooledConnection, topic: string, priority?: Partial<StreamPriority>): MultiplexedStream;
    /**
     * Close a stream
     */
    closeStream(connection: PooledConnection, streamId: StreamId, errorCode?: StreamErrorCode): void;
    /**
     * Send context data on a stream
     */
    sendContext(connection: PooledConnection, streamId: StreamId, data: Record<string, unknown>): void;
    /**
     * Receive context data on a stream
     */
    receiveContext(connection: PooledConnection, streamId: StreamId, data: Record<string, unknown>, windowUpdate?: number): void;
    /**
     * Release a connection back to the pool
     */
    release(connection: PooledConnection): void;
    /**
     * Drain a connection - no new streams, finish existing
     */
    drain(connection: PooledConnection): void;
    /**
     * Force close a connection
     */
    closeConnection(connection: PooledConnection, reason: string): void;
    /**
     * Get pool statistics
     */
    getStats(): PoolStats & {
        currentState: PoolState;
    };
    /**
     * Shutdown the pool
     */
    shutdown(graceful?: boolean): Promise<void>;
    private makePoolKey;
    private generateStreamId;
    private findReadyConnection;
    private canCreateConnection;
    private createConnection;
    private performConnectionHandshake;
    private warmConnection;
    private waitForConnection;
    private waitForEmpty;
    private runHealthChecks;
    private calculateConnectionHealth;
    private updateAcquisitionStats;
    private updateLatencyStats;
    private isRecoverableError;
}
/**
 * HTTP/2 style priority tree scheduler
 */
export declare class PriorityScheduler {
    private root;
    private nodes;
    constructor();
    /**
     * Add stream to priority tree
     */
    addStream(stream: MultiplexedStream): void;
    /**
     * Remove stream from priority tree
     */
    removeStream(streamId: StreamId): void;
    /**
     * Get next streams to process in priority order
     * Returns streams with their allocation percentages
     */
    schedule(activeStreams: Set<StreamId>): Array<{
        streamId: StreamId;
        allocation: number;
    }>;
    private scheduleNode;
    private hasActiveDescendant;
}
export interface AcquireOptions {
    /** Wait for a connection to become available */
    waitForConnection?: boolean;
    /** Timeout for waiting (ms) */
    timeout?: number;
}
export interface PoolStats {
    totalConnectionsCreated: number;
    totalConnectionsReused: number;
    totalStreamsCreated: number;
    totalStreamsFailed: number;
    avgAcquisitionTime: number;
    poolHitRate: number;
}
export interface PoolState {
    totalConnections: number;
    readyConnections: number;
    busyConnections: number;
    totalActiveStreams: number;
    uniqueAgents: number;
}
export declare class PoolError extends Error {
    constructor(message: string);
}
export declare class PoolExhaustedError extends PoolError {
    constructor(message: string);
}
export declare class PoolTimeoutError extends PoolError {
    constructor(message: string);
}
export declare class ConnectionNotReadyError extends PoolError {
    constructor(message: string);
}
export declare class StreamLimitError extends PoolError {
    constructor(message: string);
}
export declare class StreamNotFoundError extends PoolError {
    constructor(message: string);
}
export declare class StreamClosedError extends PoolError {
    constructor(message: string);
}
/**
 * Get or create the default connection pool
 */
export declare function getPool(config?: Partial<PoolConfig>): ConnectionPool;
/**
 * Quick acquire + open stream
 */
export declare function quickStream(localAgent: string, remoteAgent: string, topic: string): Promise<{
    connection: PooledConnection;
    stream: MultiplexedStream;
}>;
/**
 * Visualize pool state
 */
export declare function visualizePool(pool: ConnectionPool): string;
