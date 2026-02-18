/**
 * Context Handshake: Delta Synchronization
 * =========================================
 *
 * Like TCP SACK (Selective Acknowledgment) but for mental models.
 * Instead of transferring full context each time, only sync deltas.
 *
 * Key innovations:
 * - Merkle trees for efficient context diffing
 * - Operation-based CRDTs for conflict-free merging
 * - Bloom filters for fast difference detection
 * - Vector clocks for causal ordering
 *
 * HEF Evolution: Generation 6, Instance 28
 * Task ID: task_20260202221914_abe189
 */
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
// ============================================================================
// Vector Clock Operations
// ============================================================================
export class VectorClockManager {
    /**
     * Create empty vector clock
     */
    static create() {
        return {};
    }
    /**
     * Increment clock for an agent
     */
    static increment(clock, agentId) {
        return {
            ...clock,
            [agentId]: (clock[agentId] || 0) + 1
        };
    }
    /**
     * Merge two clocks (take max of each component)
     */
    static merge(a, b) {
        const result = { ...a };
        for (const [agent, time] of Object.entries(b)) {
            result[agent] = Math.max(result[agent] || 0, time);
        }
        return result;
    }
    /**
     * Compare two clocks
     * Returns: -1 (a < b), 0 (concurrent), 1 (a > b)
     */
    static compare(a, b) {
        let aGreater = false;
        let bGreater = false;
        const allAgents = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const agent of allAgents) {
            const aTime = a[agent] || 0;
            const bTime = b[agent] || 0;
            if (aTime > bTime)
                aGreater = true;
            if (bTime > aTime)
                bGreater = true;
        }
        if (aGreater && !bGreater)
            return 1;
        if (bGreater && !aGreater)
            return -1;
        return 0; // Concurrent
    }
    /**
     * Check if a happened-before b
     */
    static happenedBefore(a, b) {
        return this.compare(a, b) === -1;
    }
    /**
     * Check if clocks are concurrent (neither happened-before the other)
     */
    static areConcurrent(a, b) {
        return this.compare(a, b) === 0;
    }
    /**
     * Get the dominance score (how many components are greater)
     */
    static dominance(a, b) {
        let score = 0;
        const allAgents = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const agent of allAgents) {
            const aTime = a[agent] || 0;
            const bTime = b[agent] || 0;
            if (aTime > bTime)
                score++;
            if (bTime > aTime)
                score--;
        }
        return score;
    }
}
// ============================================================================
// Bloom Filter for Fast Difference Detection
// ============================================================================
export class BloomFilterManager {
    /**
     * Create a new bloom filter
     */
    static create(size, numHashes) {
        return {
            bits: new Uint8Array(Math.ceil(size / 8)),
            numHashes,
            size,
            count: 0
        };
    }
    /**
     * Generate hash indices for an item
     */
    static hashIndices(item, filter) {
        const indices = [];
        for (let i = 0; i < filter.numHashes; i++) {
            const hash = crypto.createHash('sha256')
                .update(`${item}:${i}`)
                .digest();
            // Use 4 bytes of hash to get index
            const index = hash.readUInt32BE(0) % filter.size;
            indices.push(index);
        }
        return indices;
    }
    /**
     * Add an item to the filter
     */
    static add(filter, item) {
        const indices = this.hashIndices(item, filter);
        for (const index of indices) {
            const byteIndex = Math.floor(index / 8);
            const bitIndex = index % 8;
            filter.bits[byteIndex] |= (1 << bitIndex);
        }
        filter.count++;
    }
    /**
     * Check if item might be in filter
     */
    static mightContain(filter, item) {
        const indices = this.hashIndices(item, filter);
        for (const index of indices) {
            const byteIndex = Math.floor(index / 8);
            const bitIndex = index % 8;
            if ((filter.bits[byteIndex] & (1 << bitIndex)) === 0) {
                return false; // Definitely not in set
            }
        }
        return true; // Might be in set
    }
    /**
     * Estimate false positive rate
     */
    static falsePositiveRate(filter) {
        const m = filter.size;
        const k = filter.numHashes;
        const n = filter.count;
        return Math.pow(1 - Math.exp(-k * n / m), k);
    }
    /**
     * Get difference hint between two filters
     * Returns items that are definitely NOT in the other filter
     */
    static differenceHint(local, remote) {
        let diffBits = 0;
        for (let i = 0; i < local.bits.length; i++) {
            // Bits set in local but not in remote
            diffBits += this.popcount(local.bits[i] & ~remote.bits[i]);
        }
        return diffBits;
    }
    static popcount(n) {
        n = n - ((n >> 1) & 0x55555555);
        n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
        return ((n + (n >> 4) & 0x0f0f0f0f) * 0x01010101) >> 24;
    }
}
// ============================================================================
// Merkle Tree for Efficient Context Diffing
// ============================================================================
export class MerkleTreeManager {
    hashCache = new Map();
    /**
     * Build a merkle tree from a context object
     */
    buildTree(context, path = []) {
        if (context === null || typeof context !== 'object') {
            // Leaf node
            const valueHash = this.hashValue(context);
            return {
                hash: valueHash,
                path,
                isLeaf: true,
                value: context,
                clock: {}
            };
        }
        const children = new Map();
        const childHashes = [];
        // Sort keys for deterministic hashing
        const keys = Object.keys(context).sort();
        for (const key of keys) {
            const childPath = [...path, key];
            const childNode = this.buildTree(context[key], childPath);
            children.set(key, childNode);
            childHashes.push(`${key}:${childNode.hash}`);
        }
        // Hash of all children
        const hash = this.hashValue(childHashes.join('|'));
        return {
            hash,
            path,
            isLeaf: false,
            children,
            clock: {}
        };
    }
    /**
     * Update a merkle tree with a delta operation
     */
    applyDelta(root, op) {
        return this.applyDeltaRecursive(root, op, 0);
    }
    applyDeltaRecursive(node, op, depth) {
        if (depth >= op.path.length) {
            // Apply operation at this node
            switch (op.type) {
                case 'set':
                    return this.buildTree(op.value ?? {}, op.path);
                case 'delete':
                    // For delete, return a tombstone node
                    return {
                        hash: this.hashValue(null),
                        path: op.path,
                        isLeaf: true,
                        value: null,
                        clock: op.clock
                    };
                case 'increment':
                    const newValue = (node.value || 0) + (op.value || 1);
                    return { ...node, value: newValue, hash: this.hashValue(newValue) };
                case 'append':
                    const arr = Array.isArray(node.value) ? [...node.value, op.value] : [op.value];
                    return this.buildTree(arr, op.path);
                default:
                    return node;
            }
        }
        // Navigate to child
        const key = op.path[depth];
        const children = new Map(node.children);
        if (children.has(key)) {
            children.set(key, this.applyDeltaRecursive(children.get(key), op, depth + 1));
        }
        else if (op.type !== 'delete') {
            // Create new path
            let newNode = this.buildTree(op.value, op.path);
            for (let i = op.path.length - 1; i > depth; i--) {
                const wrapper = new Map();
                wrapper.set(op.path[i], newNode);
                newNode = {
                    hash: this.hashValue(`${op.path[i]}:${newNode.hash}`),
                    path: op.path.slice(0, i),
                    isLeaf: false,
                    children: wrapper,
                    clock: {}
                };
            }
            children.set(key, newNode);
        }
        // Recalculate hash
        const childHashes = [...children.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v.hash}`)
            .join('|');
        return {
            ...node,
            children,
            hash: this.hashValue(childHashes)
        };
    }
    /**
     * Find differences between two merkle trees
     */
    diff(local, remote) {
        const different = [];
        const localOnly = [];
        const remoteOnly = [];
        this.diffRecursive(local, remote, different, localOnly, remoteOnly);
        return { different, localOnly, remoteOnly };
    }
    diffRecursive(local, remote, different, localOnly, remoteOnly) {
        if (!local && !remote)
            return;
        if (!local) {
            remoteOnly.push(remote.path);
            return;
        }
        if (!remote) {
            localOnly.push(local.path);
            return;
        }
        // Same hash = no differences in this subtree
        if (local.hash === remote.hash)
            return;
        // Both are leaves with different values
        if (local.isLeaf && remote.isLeaf) {
            different.push(local.path);
            return;
        }
        // One is leaf, one is not = structural difference
        if (local.isLeaf !== remote.isLeaf) {
            different.push(local.path);
            return;
        }
        // Both have children, recurse
        const allKeys = new Set([
            ...(local.children?.keys() || []),
            ...(remote.children?.keys() || [])
        ]);
        for (const key of allKeys) {
            const localChild = local.children?.get(key);
            const remoteChild = remote.children?.get(key);
            this.diffRecursive(localChild, remoteChild, different, localOnly, remoteOnly);
        }
    }
    /**
     * Serialize tree for transmission (compact format)
     */
    serialize(node, depth = 0, maxDepth = 3) {
        if (depth >= maxDepth || node.isLeaf) {
            return { h: node.hash, l: node.isLeaf };
        }
        const children = {};
        for (const [key, child] of node.children || []) {
            children[key] = this.serialize(child, depth + 1, maxDepth);
        }
        return { h: node.hash, c: children };
    }
    hashValue(value) {
        const str = JSON.stringify(value);
        if (this.hashCache.has(str)) {
            return this.hashCache.get(str);
        }
        const hash = crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
        this.hashCache.set(str, hash);
        return hash;
    }
}
// ============================================================================
// Delta Operation Log (Append-Only CRDT)
// ============================================================================
export class DeltaOperationLog {
    agentId;
    operations = [];
    operationIndex = new Map();
    pathIndex = new Map();
    clock = {};
    constructor(agentId) {
        this.agentId = agentId;
    }
    /**
     * Append a new operation
     */
    append(op) {
        this.clock = VectorClockManager.increment(this.clock, this.agentId);
        const fullOp = {
            ...op,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            clock: { ...this.clock },
            agentId: this.agentId
        };
        this.operations.push(fullOp);
        this.operationIndex.set(fullOp.id, this.operations.length - 1);
        const pathKey = fullOp.path.join('/');
        if (!this.pathIndex.has(pathKey)) {
            this.pathIndex.set(pathKey, []);
        }
        this.pathIndex.get(pathKey).push(fullOp);
        return fullOp;
    }
    /**
     * Merge operations from another agent
     */
    merge(remoteOps) {
        const applied = [];
        const conflicts = [];
        for (const op of remoteOps) {
            // Skip if we already have this operation
            if (this.operationIndex.has(op.id))
                continue;
            // Check for conflicts
            const pathKey = op.path.join('/');
            const localOps = this.pathIndex.get(pathKey) || [];
            const concurrentOps = localOps.filter(localOp => VectorClockManager.areConcurrent(localOp.clock, op.clock));
            if (concurrentOps.length > 0) {
                // Conflict detected
                for (const localOp of concurrentOps) {
                    conflicts.push({
                        path: op.path,
                        localOp,
                        remoteOp: op
                    });
                }
            }
            // Apply operation (conflict resolution happens separately)
            this.operations.push(op);
            this.operationIndex.set(op.id, this.operations.length - 1);
            if (!this.pathIndex.has(pathKey)) {
                this.pathIndex.set(pathKey, []);
            }
            this.pathIndex.get(pathKey).push(op);
            // Update our clock
            this.clock = VectorClockManager.merge(this.clock, op.clock);
            applied.push(op);
        }
        return { applied, conflicts };
    }
    /**
     * Get operations since a vector clock
     */
    getOperationsSince(clock) {
        return this.operations.filter(op => !VectorClockManager.happenedBefore(op.clock, clock) &&
            !this.clockEquals(op.clock, clock));
    }
    /**
     * Get latest operation for each path
     */
    getLatestByPath() {
        const latest = new Map();
        for (const [pathKey, ops] of this.pathIndex) {
            let latestOp = ops[0];
            for (const op of ops.slice(1)) {
                if (op.timestamp > latestOp.timestamp) {
                    latestOp = op;
                }
            }
            latest.set(pathKey, latestOp);
        }
        return latest;
    }
    /**
     * Compact the log by removing superseded operations
     */
    compact() {
        const latest = this.getLatestByPath();
        const keepIds = new Set(latest.values());
        const keepOps = new Set([...keepIds].map(op => op.id));
        const beforeCount = this.operations.length;
        this.operations = this.operations.filter(op => keepOps.has(op.id));
        // Rebuild indices
        this.operationIndex.clear();
        this.pathIndex.clear();
        for (let i = 0; i < this.operations.length; i++) {
            const op = this.operations[i];
            this.operationIndex.set(op.id, i);
            const pathKey = op.path.join('/');
            if (!this.pathIndex.has(pathKey)) {
                this.pathIndex.set(pathKey, []);
            }
            this.pathIndex.get(pathKey).push(op);
        }
        return beforeCount - this.operations.length;
    }
    getClock() {
        return { ...this.clock };
    }
    getOperations() {
        return [...this.operations];
    }
    clockEquals(a, b) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of keys) {
            if ((a[k] || 0) !== (b[k] || 0))
                return false;
        }
        return true;
    }
}
// ============================================================================
// Conflict Resolution Strategies
// ============================================================================
export class ConflictResolver {
    strategy;
    constructor(strategy) {
        this.strategy = strategy;
    }
    /**
     * Resolve a conflict between two operations
     */
    resolve(conflict) {
        switch (this.strategy) {
            case 'last-write-wins':
                return this.resolveLastWriteWins(conflict);
            case 'first-write-wins':
                return this.resolveFirstWriteWins(conflict);
            case 'merge':
                return this.resolveMerge(conflict);
            case 'manual':
                return { ...conflict, resolution: 'manual' };
        }
    }
    resolveLastWriteWins(conflict) {
        const winner = conflict.localOp.timestamp >= conflict.remoteOp.timestamp
            ? 'local' : 'remote';
        return { ...conflict, resolution: winner };
    }
    resolveFirstWriteWins(conflict) {
        const winner = conflict.localOp.timestamp <= conflict.remoteOp.timestamp
            ? 'local' : 'remote';
        return { ...conflict, resolution: winner };
    }
    resolveMerge(conflict) {
        const localVal = conflict.localOp.value;
        const remoteVal = conflict.remoteOp.value;
        // Attempt automatic merge based on types
        let mergedValue;
        if (Array.isArray(localVal) && Array.isArray(remoteVal)) {
            // Merge arrays (union with dedup)
            mergedValue = [...new Set([...localVal, ...remoteVal])];
        }
        else if (typeof localVal === 'object' && typeof remoteVal === 'object') {
            // Deep merge objects
            mergedValue = this.deepMerge(localVal, remoteVal);
        }
        else if (typeof localVal === 'number' && typeof remoteVal === 'number') {
            // For numbers, take the max (or sum for counters)
            mergedValue = Math.max(localVal, remoteVal);
        }
        else if (typeof localVal === 'string' && typeof remoteVal === 'string') {
            // For strings, concatenate with separator if different
            mergedValue = localVal === remoteVal ? localVal : `${localVal} | ${remoteVal}`;
        }
        else {
            // Can't auto-merge, fall back to last-write-wins
            return this.resolveLastWriteWins(conflict);
        }
        return { ...conflict, resolution: 'merge', mergedValue };
    }
    deepMerge(a, b) {
        const result = { ...a };
        for (const [key, value] of Object.entries(b)) {
            if (key in result) {
                if (typeof result[key] === 'object' && typeof value === 'object') {
                    result[key] = this.deepMerge(result[key], value);
                }
                else {
                    // Last write wins for primitives
                    result[key] = value;
                }
            }
            else {
                result[key] = value;
            }
        }
        return result;
    }
}
// ============================================================================
// Delta Sync Manager (Main Orchestrator)
// ============================================================================
export class DeltaSyncManager extends EventEmitter {
    agentId;
    config;
    operationLog;
    merkleTree;
    conflictResolver;
    syncStates = new Map();
    currentTree = null;
    pendingBatches = new Map();
    syncTimer = null;
    constructor(agentId, config = {}) {
        super();
        this.agentId = agentId;
        this.config = {
            maxBatchSize: 100,
            maxPendingOps: 1000,
            bloomFilterSize: 10000,
            bloomHashCount: 7,
            merkleTreeDepth: 10,
            conflictStrategy: 'last-write-wins',
            compressionThreshold: 1024,
            syncIntervalMs: 5000,
            enableCausalOrdering: true,
            ...config
        };
        this.operationLog = new DeltaOperationLog(agentId);
        this.merkleTree = new MerkleTreeManager();
        this.conflictResolver = new ConflictResolver(this.config.conflictStrategy);
    }
    /**
     * Initialize with a context object
     */
    initialize(context) {
        this.currentTree = this.merkleTree.buildTree(context);
        // Create initial operations for all paths
        this.createOperationsFromContext(context, []);
        this.emit('initialized', {
            merkleRoot: this.currentTree.hash,
            operationCount: this.operationLog.getOperations().length
        });
    }
    createOperationsFromContext(context, path) {
        if (context === null || typeof context !== 'object') {
            this.operationLog.append({
                type: 'set',
                path,
                value: context
            });
            return;
        }
        for (const [key, value] of Object.entries(context)) {
            this.createOperationsFromContext(value, [...path, key]);
        }
    }
    /**
     * Apply a local change
     */
    applyLocal(type, path, value) {
        const op = this.operationLog.append({ type, path, value });
        if (this.currentTree) {
            this.currentTree = this.merkleTree.applyDelta(this.currentTree, op);
        }
        this.emit('localChange', { operation: op, merkleRoot: this.currentTree?.hash });
        // Queue for sync
        for (const [agentId, state] of this.syncStates) {
            state.pendingOperations.push(op);
        }
        return op;
    }
    /**
     * Set a value at a path
     */
    set(path, value) {
        return this.applyLocal('set', path, value);
    }
    /**
     * Delete a value at a path
     */
    delete(path) {
        return this.applyLocal('delete', path);
    }
    /**
     * Increment a numeric value
     */
    increment(path, amount = 1) {
        return this.applyLocal('increment', path, amount);
    }
    /**
     * Append to an array
     */
    append(path, value) {
        return this.applyLocal('append', path, value);
    }
    /**
     * Register a remote agent for sync
     */
    registerRemote(remoteAgentId) {
        if (this.syncStates.has(remoteAgentId))
            return;
        this.syncStates.set(remoteAgentId, {
            localClock: this.operationLog.getClock(),
            remoteClock: {},
            lastSyncTime: 0,
            pendingOperations: [...this.operationLog.getOperations()],
            acknowledgedOperations: new Set(),
            merkleRoot: this.currentTree?.hash || '',
            conflictCount: 0
        });
        this.emit('remoteRegistered', { agentId: remoteAgentId });
    }
    /**
     * Create a delta batch to send to a remote agent
     */
    createBatch(remoteAgentId) {
        const state = this.syncStates.get(remoteAgentId);
        if (!state)
            return null;
        // Get operations not yet acknowledged
        const operations = state.pendingOperations.slice(0, this.config.maxBatchSize);
        if (operations.length === 0)
            return null;
        // Create bloom filter for fast difference detection
        const bloomFilter = BloomFilterManager.create(this.config.bloomFilterSize, this.config.bloomHashCount);
        for (const op of operations) {
            BloomFilterManager.add(bloomFilter, op.id);
            BloomFilterManager.add(bloomFilter, op.path.join('/'));
        }
        const batch = {
            id: crypto.randomUUID(),
            sourceAgent: this.agentId,
            targetAgent: remoteAgentId,
            operations,
            baseMerkleRoot: state.merkleRoot,
            targetMerkleRoot: this.currentTree?.hash || '',
            bloomFilter,
            compressed: false,
            timestamp: Date.now()
        };
        // Compress if large
        if (JSON.stringify(batch).length > this.config.compressionThreshold) {
            batch.compressed = true;
            // In real impl, would use zlib/brotli compression
        }
        this.pendingBatches.set(batch.id, batch);
        return batch;
    }
    /**
     * Receive and apply a delta batch from a remote agent
     */
    receiveBatch(batch) {
        const state = this.syncStates.get(batch.sourceAgent);
        if (!state) {
            this.registerRemote(batch.sourceAgent);
        }
        // Check if we're too far behind (merkle roots diverged significantly)
        const needsFullSync = state &&
            state.merkleRoot !== batch.baseMerkleRoot &&
            this.estimateDivergence(state.merkleRoot, batch.baseMerkleRoot) > 100;
        if (needsFullSync) {
            return { applied: [], conflicts: [], needsFullSync: true };
        }
        // Apply operations
        const { applied, conflicts: rawConflicts } = this.operationLog.merge(batch.operations);
        // Resolve conflicts
        const conflicts = [];
        for (const conflict of rawConflicts) {
            const resolved = this.conflictResolver.resolve(conflict);
            conflicts.push(resolved);
            // Apply resolution
            if (resolved.resolution === 'remote') {
                if (this.currentTree) {
                    this.currentTree = this.merkleTree.applyDelta(this.currentTree, resolved.remoteOp);
                }
            }
            else if (resolved.resolution === 'merge' && resolved.mergedValue !== undefined) {
                const mergeOp = this.operationLog.append({
                    type: 'set',
                    path: resolved.path,
                    value: resolved.mergedValue
                });
                if (this.currentTree) {
                    this.currentTree = this.merkleTree.applyDelta(this.currentTree, mergeOp);
                }
            }
        }
        // Update merkle tree with applied operations
        for (const op of applied) {
            if (this.currentTree) {
                this.currentTree = this.merkleTree.applyDelta(this.currentTree, op);
            }
        }
        // Update sync state
        const syncState = this.syncStates.get(batch.sourceAgent);
        syncState.remoteClock = VectorClockManager.merge(syncState.remoteClock, batch.operations[batch.operations.length - 1]?.clock || {});
        syncState.lastSyncTime = Date.now();
        syncState.merkleRoot = this.currentTree?.hash || '';
        syncState.conflictCount += conflicts.length;
        this.emit('batchReceived', {
            batchId: batch.id,
            applied: applied.length,
            conflicts: conflicts.length
        });
        return { applied, conflicts, needsFullSync: false };
    }
    /**
     * Acknowledge a batch was received
     */
    acknowledgeBatch(batchId, remoteAgentId) {
        const batch = this.pendingBatches.get(batchId);
        if (!batch)
            return;
        const state = this.syncStates.get(remoteAgentId);
        if (!state)
            return;
        // Remove acknowledged operations from pending
        const ackIds = new Set(batch.operations.map(op => op.id));
        state.pendingOperations = state.pendingOperations.filter(op => !ackIds.has(op.id));
        for (const id of ackIds) {
            state.acknowledgedOperations.add(id);
        }
        state.localClock = this.operationLog.getClock();
        state.merkleRoot = this.currentTree?.hash || '';
        this.pendingBatches.delete(batchId);
        this.emit('batchAcknowledged', { batchId, remoteAgentId });
    }
    /**
     * Request a full sync (when too diverged)
     */
    requestFullSync(remoteAgentId) {
        return {
            tree: this.currentTree ? this.merkleTree.serialize(this.currentTree) : null,
            clock: this.operationLog.getClock(),
            operations: this.operationLog.getOperations()
        };
    }
    /**
     * Apply a full sync from remote
     */
    applyFullSync(remoteAgentId, fullSync) {
        // Merge all operations
        const { applied, conflicts } = this.operationLog.merge(fullSync.operations);
        // Resolve all conflicts
        for (const conflict of conflicts) {
            const resolved = this.conflictResolver.resolve(conflict);
            if (resolved.resolution === 'merge' && resolved.mergedValue !== undefined) {
                this.operationLog.append({
                    type: 'set',
                    path: resolved.path,
                    value: resolved.mergedValue
                });
            }
        }
        // Rebuild tree from operations
        const context = this.buildContextFromOperations();
        this.currentTree = this.merkleTree.buildTree(context);
        // Update sync state
        const state = this.syncStates.get(remoteAgentId);
        state.remoteClock = fullSync.clock;
        state.merkleRoot = this.currentTree.hash;
        state.lastSyncTime = Date.now();
        state.pendingOperations = [];
        this.emit('fullSyncApplied', { remoteAgentId, operationCount: fullSync.operations.length });
    }
    /**
     * Build context object from operation log
     */
    buildContextFromOperations() {
        const context = {};
        const latest = this.operationLog.getLatestByPath();
        for (const [pathKey, op] of latest) {
            if (op.type === 'delete')
                continue;
            const path = op.path;
            let current = context;
            for (let i = 0; i < path.length - 1; i++) {
                if (!(path[i] in current)) {
                    current[path[i]] = {};
                }
                current = current[path[i]];
            }
            if (path.length > 0) {
                current[path[path.length - 1]] = op.value;
            }
        }
        return context;
    }
    /**
     * Start periodic sync
     */
    startPeriodicSync() {
        if (this.syncTimer)
            return;
        this.syncTimer = setInterval(() => {
            for (const [agentId] of this.syncStates) {
                const batch = this.createBatch(agentId);
                if (batch) {
                    this.emit('syncBatchReady', { agentId, batch });
                }
            }
        }, this.config.syncIntervalMs);
    }
    /**
     * Stop periodic sync
     */
    stopPeriodicSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }
    /**
     * Get current value at a path
     */
    get(path) {
        const context = this.buildContextFromOperations();
        let current = context;
        for (const key of path) {
            if (current === undefined || current === null)
                return undefined;
            current = current[key];
        }
        return current;
    }
    /**
     * Get sync statistics
     */
    getStats() {
        const pendingByAgent = {};
        const conflictsByAgent = {};
        for (const [agentId, state] of this.syncStates) {
            pendingByAgent[agentId] = state.pendingOperations.length;
            conflictsByAgent[agentId] = state.conflictCount;
        }
        return {
            operationCount: this.operationLog.getOperations().length,
            pendingByAgent,
            conflictsByAgent,
            merkleRoot: this.currentTree?.hash || '',
            clock: this.operationLog.getClock()
        };
    }
    /**
     * Compact the operation log
     */
    compact() {
        return this.operationLog.compact();
    }
    estimateDivergence(hash1, hash2) {
        // Simple divergence estimate based on hash difference
        if (hash1 === hash2)
            return 0;
        let diff = 0;
        for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
            if (hash1[i] !== hash2[i])
                diff++;
        }
        return diff * 10; // Scale factor
    }
}
// ============================================================================
// Factory Functions
// ============================================================================
/**
 * Create a delta sync manager with default config
 */
export function createDeltaSync(agentId, initialContext, config) {
    const manager = new DeltaSyncManager(agentId, config);
    if (initialContext) {
        manager.initialize(initialContext);
    }
    return manager;
}
/**
 * Example usage demonstrating AI-to-AI context sync
 */
export async function demonstrateDeltaSync() {
    console.log('🔄 Delta Sync Demo: Two AIs synchronizing mental models\n');
    // Create two AI agents
    const alice = createDeltaSync('alice', {
        understanding: { topic: 'quantum computing', depth: 7 },
        beliefs: ['superposition is key', 'entanglement enables speedup'],
        reasoning: { style: 'deductive', confidence: 0.8 }
    });
    const bob = createDeltaSync('bob', {
        understanding: { topic: 'quantum computing', depth: 5 },
        beliefs: ['qubits are fragile', 'error correction is critical'],
        reasoning: { style: 'inductive', confidence: 0.7 }
    });
    // Register each other
    alice.registerRemote('bob');
    bob.registerRemote('alice');
    console.log('Initial states:');
    console.log('  Alice:', alice.getStats().merkleRoot.slice(0, 8));
    console.log('  Bob:', bob.getStats().merkleRoot.slice(0, 8));
    // Alice makes some changes
    alice.set(['understanding', 'depth'], 8);
    alice.append(['beliefs'], 'measurement collapses state');
    alice.set(['insights', 'recent'], 'quantum error correction breakthrough');
    console.log('\nAlice made local changes...');
    // Create and send delta batch
    const batch = alice.createBatch('bob');
    if (batch) {
        console.log(`\nSending batch with ${batch.operations.length} operations`);
        console.log(`  Bloom filter has ${batch.bloomFilter.count} items`);
        // Bob receives the batch
        const result = bob.receiveBatch(batch);
        console.log(`\nBob received batch:`);
        console.log(`  Applied: ${result.applied.length}`);
        console.log(`  Conflicts: ${result.conflicts.length}`);
        // Alice acknowledges
        alice.acknowledgeBatch(batch.id, 'bob');
    }
    // Bob makes concurrent changes
    bob.set(['understanding', 'depth'], 9); // Conflict with Alice!
    bob.set(['questions', 'open'], ['decoherence timescales']);
    console.log('\nBob made concurrent changes...');
    // Send Bob's changes to Alice
    const bobBatch = bob.createBatch('alice');
    if (bobBatch) {
        const result = alice.receiveBatch(bobBatch);
        console.log(`\nAlice received batch:`);
        console.log(`  Applied: ${result.applied.length}`);
        console.log(`  Conflicts: ${result.conflicts.length}`);
        if (result.conflicts.length > 0) {
            console.log(`  Conflict resolution: ${result.conflicts[0].resolution}`);
        }
        bob.acknowledgeBatch(bobBatch.id, 'alice');
    }
    console.log('\nFinal stats:');
    console.log('  Alice:', JSON.stringify(alice.getStats(), null, 2));
    console.log('  Bob:', JSON.stringify(bob.getStats(), null, 2));
    console.log('\n✅ Delta sync complete - mental models synchronized!');
}
// Run demo if executed directly
if (require.main === module) {
    demonstrateDeltaSync().catch(console.error);
}
