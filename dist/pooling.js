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
 * Stream state following HTTP/2 model
 */
export var StreamState;
(function (StreamState) {
    StreamState["IDLE"] = "idle";
    StreamState["RESERVED"] = "reserved";
    StreamState["OPEN"] = "open";
    StreamState["HALF_CLOSED_LOCAL"] = "half_closed_local";
    StreamState["HALF_CLOSED_REMOTE"] = "half_closed_remote";
    StreamState["CLOSED"] = "closed";
})(StreamState || (StreamState = {}));
/**
 * Connection state in the pool
 */
export var ConnectionState;
(function (ConnectionState) {
    ConnectionState["CONNECTING"] = "connecting";
    ConnectionState["READY"] = "ready";
    ConnectionState["BUSY"] = "busy";
    ConnectionState["DRAINING"] = "draining";
    ConnectionState["CLOSED"] = "closed";
})(ConnectionState || (ConnectionState = {}));
export var StreamErrorCode;
(function (StreamErrorCode) {
    StreamErrorCode[StreamErrorCode["NO_ERROR"] = 0] = "NO_ERROR";
    StreamErrorCode[StreamErrorCode["PROTOCOL_ERROR"] = 1] = "PROTOCOL_ERROR";
    StreamErrorCode[StreamErrorCode["INTERNAL_ERROR"] = 2] = "INTERNAL_ERROR";
    StreamErrorCode[StreamErrorCode["FLOW_CONTROL_ERROR"] = 3] = "FLOW_CONTROL_ERROR";
    StreamErrorCode[StreamErrorCode["STREAM_CLOSED"] = 5] = "STREAM_CLOSED";
    StreamErrorCode[StreamErrorCode["FRAME_SIZE_ERROR"] = 6] = "FRAME_SIZE_ERROR";
    StreamErrorCode[StreamErrorCode["REFUSED_STREAM"] = 7] = "REFUSED_STREAM";
    StreamErrorCode[StreamErrorCode["CANCEL"] = 8] = "CANCEL";
    StreamErrorCode[StreamErrorCode["CONTEXT_OVERFLOW"] = 9] = "CONTEXT_OVERFLOW";
    StreamErrorCode[StreamErrorCode["ALIGNMENT_FAILED"] = 10] = "ALIGNMENT_FAILED";
    StreamErrorCode[StreamErrorCode["TIMEOUT"] = 11] = "TIMEOUT";
})(StreamErrorCode || (StreamErrorCode = {}));
/**
 * Default pool configuration
 */
export const DEFAULT_POOL_CONFIG = {
    maxConnectionsPerAgent: 6, // Like browser HTTP/2 limit
    maxTotalConnections: 100,
    maxStreamsPerConnection: 100, // HTTP/2 default
    idleTimeout: 60_000, // 1 minute
    maxLifetime: 300_000, // 5 minutes
    initialFlowWindow: 65535, // 64KB (TCP default)
    maxFlowWindow: 16_777_216, // 16MB
    warmupAgents: [],
    minWarmConnections: 0,
    healthCheckInterval: 15_000, // 15 seconds
    healthThreshold: 0.5,
};
// ============================================================================
// Connection Pool Manager
// ============================================================================
/**
 * Manages a pool of multiplexed connections to AI agents
 */
export class ConnectionPool extends EventEmitter {
    config;
    connections = new Map();
    agentConnections = new Map(); // agent -> connection ids
    healthCheckTimer;
    nextStreamId = 1;
    stats = {
        totalConnectionsCreated: 0,
        totalConnectionsReused: 0,
        totalStreamsCreated: 0,
        totalStreamsFailed: 0,
        avgAcquisitionTime: 0,
        poolHitRate: 0,
    };
    constructor(config = {}) {
        super();
        this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    }
    /**
     * Initialize pool with warmup connections
     */
    async initialize() {
        // Start health check loop
        this.healthCheckTimer = setInterval(() => this.runHealthChecks(), this.config.healthCheckInterval);
        // Warm up connections to known agents
        const warmupPromises = this.config.warmupAgents.map(agent => this.warmConnection(agent).catch(err => {
            this.emit('warmup_failed', { agent, error: err });
        }));
        await Promise.all(warmupPromises);
        this.emit('initialized', {
            warmConnections: this.config.warmupAgents.length
        });
    }
    /**
     * Acquire a connection to a remote agent
     * Returns existing warm connection or creates new one
     */
    async acquire(localAgent, remoteAgent, options) {
        const startTime = Date.now();
        const poolKey = this.makePoolKey(localAgent, remoteAgent);
        // Try to get existing ready connection
        const existing = this.findReadyConnection(poolKey);
        if (existing) {
            existing.reuseCount++;
            this.stats.totalConnectionsReused++;
            this.updateAcquisitionStats(Date.now() - startTime);
            this.emit('connection_reused', {
                connectionId: existing.id,
                reuseCount: existing.reuseCount
            });
            return existing;
        }
        // Check if we can create a new connection
        if (!this.canCreateConnection(remoteAgent)) {
            // Wait for a connection to become available
            if (options?.waitForConnection) {
                return this.waitForConnection(poolKey, options.timeout || 30000);
            }
            throw new PoolExhaustedError(`Cannot create connection to ${remoteAgent}: pool limits reached`);
        }
        // Create new connection
        const connection = await this.createConnection(localAgent, remoteAgent);
        this.stats.totalConnectionsCreated++;
        this.updateAcquisitionStats(Date.now() - startTime);
        return connection;
    }
    /**
     * Open a new stream on a pooled connection
     */
    openStream(connection, topic, priority = {}) {
        if (connection.state !== ConnectionState.READY) {
            throw new ConnectionNotReadyError(`Connection ${connection.id} is ${connection.state}, cannot open stream`);
        }
        if (connection.streams.size >= this.config.maxStreamsPerConnection) {
            throw new StreamLimitError(`Connection ${connection.id} at max streams (${this.config.maxStreamsPerConnection})`);
        }
        const streamId = this.generateStreamId();
        const stream = {
            id: streamId,
            state: StreamState.OPEN,
            priority: {
                weight: priority.weight ?? 16, // HTTP/2 default
                dependsOn: priority.dependsOn,
                exclusive: priority.exclusive ?? false,
            },
            topic,
            contextFragment: {
                namespace: topic,
                data: {},
                version: 0,
            },
            bytesSent: 0,
            bytesReceived: 0,
            flowWindow: this.config.initialFlowWindow,
            createdAt: new Date(),
            lastActivity: new Date(),
        };
        connection.streams.set(streamId, stream);
        connection.lastActivity = new Date();
        connection.metrics.totalStreams++;
        this.stats.totalStreamsCreated++;
        // Update connection state if now busy
        if (connection.streams.size >= this.config.maxStreamsPerConnection) {
            connection.state = ConnectionState.BUSY;
        }
        this.emit('stream_opened', {
            connectionId: connection.id,
            streamId,
            topic
        });
        return stream;
    }
    /**
     * Close a stream
     */
    closeStream(connection, streamId, errorCode = StreamErrorCode.NO_ERROR) {
        const stream = connection.streams.get(streamId);
        if (!stream) {
            throw new StreamNotFoundError(`Stream ${streamId} not found`);
        }
        stream.state = StreamState.CLOSED;
        if (errorCode !== StreamErrorCode.NO_ERROR) {
            stream.error = {
                code: errorCode,
                message: StreamErrorCode[errorCode],
                recoverable: this.isRecoverableError(errorCode),
            };
            connection.metrics.failedStreams++;
            this.stats.totalStreamsFailed++;
        }
        else {
            connection.metrics.successfulStreams++;
        }
        // Record latency
        const latency = Date.now() - stream.createdAt.getTime();
        this.updateLatencyStats(connection, latency);
        // Remove from active streams
        connection.streams.delete(streamId);
        // Update connection state
        if (connection.state === ConnectionState.BUSY &&
            connection.streams.size < this.config.maxStreamsPerConnection) {
            connection.state = ConnectionState.READY;
        }
        this.emit('stream_closed', {
            connectionId: connection.id,
            streamId,
            errorCode,
            latency,
        });
    }
    /**
     * Send context data on a stream
     */
    sendContext(connection, streamId, data) {
        const stream = connection.streams.get(streamId);
        if (!stream) {
            throw new StreamNotFoundError(`Stream ${streamId} not found`);
        }
        if (stream.state === StreamState.CLOSED ||
            stream.state === StreamState.HALF_CLOSED_LOCAL) {
            throw new StreamClosedError(`Stream ${streamId} is closed for sending`);
        }
        // Merge into context fragment
        stream.contextFragment.data = {
            ...stream.contextFragment.data,
            ...data,
        };
        stream.contextFragment.version++;
        // Update metrics
        const bytes = JSON.stringify(data).length;
        stream.bytesSent += bytes;
        stream.lastActivity = new Date();
        connection.lastActivity = new Date();
        connection.metrics.totalBytesSent += bytes;
        // Check flow control
        if (stream.flowWindow < bytes) {
            this.emit('flow_control_exceeded', {
                connectionId: connection.id,
                streamId,
                required: bytes,
                available: stream.flowWindow,
            });
        }
        stream.flowWindow -= bytes;
        this.emit('context_sent', {
            connectionId: connection.id,
            streamId,
            bytes,
            version: stream.contextFragment.version,
        });
    }
    /**
     * Receive context data on a stream
     */
    receiveContext(connection, streamId, data, windowUpdate) {
        const stream = connection.streams.get(streamId);
        if (!stream) {
            throw new StreamNotFoundError(`Stream ${streamId} not found`);
        }
        // Merge received data
        stream.contextFragment.data = {
            ...stream.contextFragment.data,
            ...data,
        };
        // Update metrics
        const bytes = JSON.stringify(data).length;
        stream.bytesReceived += bytes;
        stream.lastActivity = new Date();
        connection.lastActivity = new Date();
        connection.metrics.totalBytesReceived += bytes;
        // Process window update
        if (windowUpdate) {
            stream.flowWindow += windowUpdate;
        }
        this.emit('context_received', {
            connectionId: connection.id,
            streamId,
            bytes,
        });
    }
    /**
     * Release a connection back to the pool
     */
    release(connection) {
        if (connection.streams.size > 0) {
            // Don't release if streams are still active
            this.emit('release_blocked', {
                connectionId: connection.id,
                activeStreams: connection.streams.size,
            });
            return;
        }
        // Check if connection should be closed due to age
        const age = Date.now() - connection.establishedAt.getTime();
        if (age > this.config.maxLifetime) {
            this.closeConnection(connection, 'max_lifetime');
            return;
        }
        // Connection stays in pool, ready for reuse
        connection.state = ConnectionState.READY;
        this.emit('connection_released', { connectionId: connection.id });
    }
    /**
     * Drain a connection - no new streams, finish existing
     */
    drain(connection) {
        connection.state = ConnectionState.DRAINING;
        this.emit('connection_draining', {
            connectionId: connection.id,
            activeStreams: connection.streams.size,
        });
        // Close when all streams finish
        if (connection.streams.size === 0) {
            this.closeConnection(connection, 'drained');
        }
    }
    /**
     * Force close a connection
     */
    closeConnection(connection, reason) {
        // Close all streams with error
        for (const [streamId] of connection.streams) {
            this.closeStream(connection, streamId, StreamErrorCode.CANCEL);
        }
        connection.state = ConnectionState.CLOSED;
        // Remove from pool
        this.connections.delete(connection.id);
        const agentConns = this.agentConnections.get(connection.remoteAgent);
        agentConns?.delete(connection.id);
        this.emit('connection_closed', {
            connectionId: connection.id,
            reason,
            metrics: connection.metrics,
        });
    }
    /**
     * Get pool statistics
     */
    getStats() {
        const readyConnections = [...this.connections.values()]
            .filter(c => c.state === ConnectionState.READY).length;
        const busyConnections = [...this.connections.values()]
            .filter(c => c.state === ConnectionState.BUSY).length;
        const totalStreams = [...this.connections.values()]
            .reduce((sum, c) => sum + c.streams.size, 0);
        return {
            ...this.stats,
            currentState: {
                totalConnections: this.connections.size,
                readyConnections,
                busyConnections,
                totalActiveStreams: totalStreams,
                uniqueAgents: this.agentConnections.size,
            },
        };
    }
    /**
     * Shutdown the pool
     */
    async shutdown(graceful = true) {
        // Stop health checks
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        if (graceful) {
            // Drain all connections
            for (const connection of this.connections.values()) {
                this.drain(connection);
            }
            // Wait for connections to close
            await this.waitForEmpty(30000);
        }
        else {
            // Force close all
            for (const connection of this.connections.values()) {
                this.closeConnection(connection, 'shutdown');
            }
        }
        this.emit('shutdown', { graceful });
    }
    // ============================================================================
    // Private helpers
    // ============================================================================
    makePoolKey(local, remote) {
        return `${local}<->${remote}`;
    }
    generateStreamId() {
        return `stream_${this.nextStreamId++}`;
    }
    findReadyConnection(poolKey) {
        for (const connection of this.connections.values()) {
            if (connection.poolKey === poolKey &&
                connection.state === ConnectionState.READY &&
                connection.streams.size < this.config.maxStreamsPerConnection) {
                return connection;
            }
        }
        return undefined;
    }
    canCreateConnection(remoteAgent) {
        // Check total pool limit
        if (this.connections.size >= this.config.maxTotalConnections) {
            return false;
        }
        // Check per-agent limit
        const agentConns = this.agentConnections.get(remoteAgent);
        if (agentConns && agentConns.size >= this.config.maxConnectionsPerAgent) {
            return false;
        }
        return true;
    }
    async createConnection(localAgent, remoteAgent) {
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const poolKey = this.makePoolKey(localAgent, remoteAgent);
        const connection = {
            id: connectionId,
            poolKey,
            state: ConnectionState.CONNECTING,
            localAgent,
            remoteAgent,
            streams: new Map(),
            connectionFlowWindow: this.config.initialFlowWindow,
            maxConcurrentStreams: this.config.maxStreamsPerConnection,
            sessionContext: {
                mergedModel: {},
                assumptions: [],
                goals: [],
                capabilities: [],
            },
            alignmentScore: 0,
            trustTier: 0,
            establishedAt: new Date(),
            lastActivity: new Date(),
            reuseCount: 0,
            metrics: {
                totalStreams: 0,
                successfulStreams: 0,
                failedStreams: 0,
                totalBytesSent: 0,
                totalBytesReceived: 0,
                avgStreamLatency: 0,
                p99StreamLatency: 0,
                uptime: 0,
            },
        };
        // Store in pool
        this.connections.set(connectionId, connection);
        if (!this.agentConnections.has(remoteAgent)) {
            this.agentConnections.set(remoteAgent, new Set());
        }
        this.agentConnections.get(remoteAgent).add(connectionId);
        // Simulate handshake (would integrate with actual handshake protocol)
        await this.performConnectionHandshake(connection);
        connection.state = ConnectionState.READY;
        this.emit('connection_created', {
            connectionId,
            remoteAgent,
            alignmentScore: connection.alignmentScore,
        });
        return connection;
    }
    async performConnectionHandshake(connection) {
        // This would integrate with the actual handshake protocol
        // For now, simulate the handshake
        await new Promise(resolve => setTimeout(resolve, 50));
        connection.sessionContext = {
            mergedModel: {
                context: 'pooled_connection',
                agents: [connection.localAgent, connection.remoteAgent],
            },
            assumptions: ['Both agents are available', 'Context can be shared'],
            goals: ['Efficient collaboration'],
            capabilities: ['context_sync', 'streaming'],
        };
        connection.alignmentScore = 0.85;
        connection.trustTier = 2;
    }
    async warmConnection(remoteAgent) {
        // Pre-establish connection to known agent
        await this.acquire('__warmup__', remoteAgent);
    }
    async waitForConnection(poolKey, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new PoolTimeoutError(`Timeout waiting for connection to ${poolKey}`));
            }, timeout);
            const check = () => {
                const conn = this.findReadyConnection(poolKey);
                if (conn) {
                    clearTimeout(timer);
                    conn.reuseCount++;
                    resolve(conn);
                }
                else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    async waitForEmpty(timeout) {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, timeout);
            const check = () => {
                if (this.connections.size === 0) {
                    clearTimeout(timer);
                    resolve();
                }
                else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
    runHealthChecks() {
        const now = Date.now();
        for (const connection of this.connections.values()) {
            // Check idle timeout
            const idleTime = now - connection.lastActivity.getTime();
            if (idleTime > this.config.idleTimeout && connection.streams.size === 0) {
                this.closeConnection(connection, 'idle_timeout');
                continue;
            }
            // Check max lifetime
            const age = now - connection.establishedAt.getTime();
            if (age > this.config.maxLifetime) {
                this.drain(connection);
                continue;
            }
            // Update uptime metric
            connection.metrics.uptime = age;
            // Check health
            const health = this.calculateConnectionHealth(connection);
            if (health < this.config.healthThreshold) {
                this.emit('connection_unhealthy', {
                    connectionId: connection.id,
                    health,
                    threshold: this.config.healthThreshold,
                });
            }
        }
        this.emit('health_check_complete', {
            connections: this.connections.size,
        });
    }
    calculateConnectionHealth(connection) {
        const metrics = connection.metrics;
        if (metrics.totalStreams === 0)
            return 1.0;
        const successRate = metrics.successfulStreams / metrics.totalStreams;
        const latencyScore = Math.max(0, 1 - (metrics.avgStreamLatency / 5000)); // 5s max
        return (successRate * 0.7) + (latencyScore * 0.3);
    }
    updateAcquisitionStats(time) {
        const total = this.stats.totalConnectionsCreated + this.stats.totalConnectionsReused;
        this.stats.avgAcquisitionTime =
            (this.stats.avgAcquisitionTime * (total - 1) + time) / total;
        this.stats.poolHitRate =
            this.stats.totalConnectionsReused / total;
    }
    updateLatencyStats(connection, latency) {
        const n = connection.metrics.successfulStreams + connection.metrics.failedStreams;
        connection.metrics.avgStreamLatency =
            (connection.metrics.avgStreamLatency * (n - 1) + latency) / n;
        // Simplified P99 - would use proper percentile tracking in production
        connection.metrics.p99StreamLatency = Math.max(connection.metrics.p99StreamLatency, latency);
    }
    isRecoverableError(code) {
        return [
            StreamErrorCode.FLOW_CONTROL_ERROR,
            StreamErrorCode.REFUSED_STREAM,
            StreamErrorCode.CANCEL,
            StreamErrorCode.TIMEOUT,
        ].includes(code);
    }
}
// ============================================================================
// Stream Priority Scheduler
// ============================================================================
/**
 * HTTP/2 style priority tree scheduler
 */
export class PriorityScheduler {
    root;
    nodes = new Map();
    constructor() {
        this.root = {
            streamId: 'root',
            weight: 16,
            children: [],
            parent: null,
        };
    }
    /**
     * Add stream to priority tree
     */
    addStream(stream) {
        const node = {
            streamId: stream.id,
            weight: stream.priority.weight,
            children: [],
            parent: null,
        };
        const parentId = stream.priority.dependsOn;
        const parentNode = parentId
            ? this.nodes.get(parentId) || this.root
            : this.root;
        if (stream.priority.exclusive) {
            // Move all parent's children under this node
            node.children = [...parentNode.children];
            for (const child of node.children) {
                child.parent = node;
            }
            parentNode.children = [node];
        }
        else {
            parentNode.children.push(node);
        }
        node.parent = parentNode;
        this.nodes.set(stream.id, node);
    }
    /**
     * Remove stream from priority tree
     */
    removeStream(streamId) {
        const node = this.nodes.get(streamId);
        if (!node || !node.parent)
            return;
        // Move children to parent
        for (const child of node.children) {
            child.parent = node.parent;
            node.parent.children.push(child);
        }
        // Remove from parent
        node.parent.children = node.parent.children.filter(c => c.streamId !== streamId);
        this.nodes.delete(streamId);
    }
    /**
     * Get next streams to process in priority order
     * Returns streams with their allocation percentages
     */
    schedule(activeStreams) {
        const allocations = [];
        this.scheduleNode(this.root, 1.0, activeStreams, allocations);
        return allocations.sort((a, b) => b.allocation - a.allocation);
    }
    scheduleNode(node, parentAllocation, activeStreams, result) {
        // Filter to active children
        const activeChildren = node.children.filter(c => activeStreams.has(c.streamId) || this.hasActiveDescendant(c, activeStreams));
        if (activeChildren.length === 0)
            return;
        // Calculate weight sum
        const weightSum = activeChildren.reduce((sum, c) => sum + c.weight, 0);
        for (const child of activeChildren) {
            const allocation = parentAllocation * (child.weight / weightSum);
            if (activeStreams.has(child.streamId)) {
                result.push({ streamId: child.streamId, allocation });
            }
            // Recurse to children
            this.scheduleNode(child, allocation, activeStreams, result);
        }
    }
    hasActiveDescendant(node, activeStreams) {
        for (const child of node.children) {
            if (activeStreams.has(child.streamId))
                return true;
            if (this.hasActiveDescendant(child, activeStreams))
                return true;
        }
        return false;
    }
}
// ============================================================================
// Errors
// ============================================================================
export class PoolError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PoolError';
    }
}
export class PoolExhaustedError extends PoolError {
    constructor(message) {
        super(message);
        this.name = 'PoolExhaustedError';
    }
}
export class PoolTimeoutError extends PoolError {
    constructor(message) {
        super(message);
        this.name = 'PoolTimeoutError';
    }
}
export class ConnectionNotReadyError extends PoolError {
    constructor(message) {
        super(message);
        this.name = 'ConnectionNotReadyError';
    }
}
export class StreamLimitError extends PoolError {
    constructor(message) {
        super(message);
        this.name = 'StreamLimitError';
    }
}
export class StreamNotFoundError extends PoolError {
    constructor(message) {
        super(message);
        this.name = 'StreamNotFoundError';
    }
}
export class StreamClosedError extends PoolError {
    constructor(message) {
        super(message);
        this.name = 'StreamClosedError';
    }
}
// ============================================================================
// Quick API
// ============================================================================
/**
 * Global default pool instance
 */
let defaultPool = null;
/**
 * Get or create the default connection pool
 */
export function getPool(config) {
    if (!defaultPool) {
        defaultPool = new ConnectionPool(config);
    }
    return defaultPool;
}
/**
 * Quick acquire + open stream
 */
export async function quickStream(localAgent, remoteAgent, topic) {
    const pool = getPool();
    const connection = await pool.acquire(localAgent, remoteAgent);
    const stream = pool.openStream(connection, topic);
    return { connection, stream };
}
/**
 * Visualize pool state
 */
export function visualizePool(pool) {
    const stats = pool.getStats();
    const lines = [
        '╔════════════════════════════════════════════════════════════════╗',
        '║             Connection Pool Status                             ║',
        '╠════════════════════════════════════════════════════════════════╣',
        `║ Total Connections:    ${String(stats.currentState.totalConnections).padStart(5)} │ Ready: ${String(stats.currentState.readyConnections).padStart(3)} │ Busy: ${String(stats.currentState.busyConnections).padStart(3)}  ║`,
        `║ Active Streams:       ${String(stats.currentState.totalActiveStreams).padStart(5)} │ Unique Agents: ${String(stats.currentState.uniqueAgents).padStart(3)}            ║`,
        '╠════════════════════════════════════════════════════════════════╣',
        `║ Pool Hit Rate:        ${(stats.poolHitRate * 100).toFixed(1).padStart(5)}% (${stats.totalConnectionsReused}/${stats.totalConnectionsCreated + stats.totalConnectionsReused} reused)    ║`,
        `║ Avg Acquisition:      ${String(Math.round(stats.avgAcquisitionTime)).padStart(5)}ms                                  ║`,
        `║ Total Streams:        ${String(stats.totalStreamsCreated).padStart(5)} │ Failed: ${String(stats.totalStreamsFailed).padStart(3)}                   ║`,
        '╚════════════════════════════════════════════════════════════════╝',
    ];
    return lines.join('\n');
}
