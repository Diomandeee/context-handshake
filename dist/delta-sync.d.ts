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
/**
 * Vector clock for tracking causal relationships
 */
export interface VectorClock {
    [agentId: string]: number;
}
/**
 * A single context delta operation
 */
export interface DeltaOperation {
    id: string;
    type: 'set' | 'delete' | 'merge' | 'increment' | 'append' | 'patch';
    path: string[];
    value?: any;
    previousHash?: string;
    timestamp: number;
    clock: VectorClock;
    agentId: string;
}
/**
 * Merkle tree node for efficient diffing
 */
export interface MerkleNode {
    hash: string;
    path: string[];
    isLeaf: boolean;
    children?: Map<string, MerkleNode>;
    value?: any;
    clock: VectorClock;
}
/**
 * Bloom filter for fast difference detection
 */
export interface BloomFilter {
    bits: Uint8Array;
    numHashes: number;
    size: number;
    count: number;
}
/**
 * Delta batch for efficient network transfer
 */
export interface DeltaBatch {
    id: string;
    sourceAgent: string;
    targetAgent: string;
    operations: DeltaOperation[];
    baseMerkleRoot: string;
    targetMerkleRoot: string;
    bloomFilter: BloomFilter;
    compressed: boolean;
    timestamp: number;
}
/**
 * Sync state between two agents
 */
export interface SyncState {
    localClock: VectorClock;
    remoteClock: VectorClock;
    lastSyncTime: number;
    pendingOperations: DeltaOperation[];
    acknowledgedOperations: Set<string>;
    merkleRoot: string;
    conflictCount: number;
}
/**
 * Diff result between two contexts
 */
export interface DiffResult {
    added: DeltaOperation[];
    modified: DeltaOperation[];
    deleted: DeltaOperation[];
    conflicts: ConflictInfo[];
    localOnly: string[];
    remoteOnly: string[];
    divergencePoint?: VectorClock;
}
/**
 * Conflict information
 */
export interface ConflictInfo {
    path: string[];
    localOp: DeltaOperation;
    remoteOp: DeltaOperation;
    resolution?: 'local' | 'remote' | 'merge' | 'manual';
    mergedValue?: any;
}
/**
 * Configuration for delta sync
 */
export interface DeltaSyncConfig {
    maxBatchSize: number;
    maxPendingOps: number;
    bloomFilterSize: number;
    bloomHashCount: number;
    merkleTreeDepth: number;
    conflictStrategy: 'last-write-wins' | 'first-write-wins' | 'merge' | 'manual';
    compressionThreshold: number;
    syncIntervalMs: number;
    enableCausalOrdering: boolean;
}
export declare class VectorClockManager {
    /**
     * Create empty vector clock
     */
    static create(): VectorClock;
    /**
     * Increment clock for an agent
     */
    static increment(clock: VectorClock, agentId: string): VectorClock;
    /**
     * Merge two clocks (take max of each component)
     */
    static merge(a: VectorClock, b: VectorClock): VectorClock;
    /**
     * Compare two clocks
     * Returns: -1 (a < b), 0 (concurrent), 1 (a > b)
     */
    static compare(a: VectorClock, b: VectorClock): -1 | 0 | 1;
    /**
     * Check if a happened-before b
     */
    static happenedBefore(a: VectorClock, b: VectorClock): boolean;
    /**
     * Check if clocks are concurrent (neither happened-before the other)
     */
    static areConcurrent(a: VectorClock, b: VectorClock): boolean;
    /**
     * Get the dominance score (how many components are greater)
     */
    static dominance(a: VectorClock, b: VectorClock): number;
}
export declare class BloomFilterManager {
    /**
     * Create a new bloom filter
     */
    static create(size: number, numHashes: number): BloomFilter;
    /**
     * Generate hash indices for an item
     */
    private static hashIndices;
    /**
     * Add an item to the filter
     */
    static add(filter: BloomFilter, item: string): void;
    /**
     * Check if item might be in filter
     */
    static mightContain(filter: BloomFilter, item: string): boolean;
    /**
     * Estimate false positive rate
     */
    static falsePositiveRate(filter: BloomFilter): number;
    /**
     * Get difference hint between two filters
     * Returns items that are definitely NOT in the other filter
     */
    static differenceHint(local: BloomFilter, remote: BloomFilter): number;
    private static popcount;
}
export declare class MerkleTreeManager {
    private hashCache;
    /**
     * Build a merkle tree from a context object
     */
    buildTree(context: Record<string, any>, path?: string[]): MerkleNode;
    /**
     * Update a merkle tree with a delta operation
     */
    applyDelta(root: MerkleNode, op: DeltaOperation): MerkleNode;
    private applyDeltaRecursive;
    /**
     * Find differences between two merkle trees
     */
    diff(local: MerkleNode, remote: MerkleNode): {
        different: string[][];
        localOnly: string[][];
        remoteOnly: string[][];
    };
    private diffRecursive;
    /**
     * Serialize tree for transmission (compact format)
     */
    serialize(node: MerkleNode, depth?: number, maxDepth?: number): any;
    private hashValue;
}
export declare class DeltaOperationLog {
    private agentId;
    private operations;
    private operationIndex;
    private pathIndex;
    private clock;
    constructor(agentId: string);
    /**
     * Append a new operation
     */
    append(op: Omit<DeltaOperation, 'id' | 'timestamp' | 'clock' | 'agentId'>): DeltaOperation;
    /**
     * Merge operations from another agent
     */
    merge(remoteOps: DeltaOperation[]): {
        applied: DeltaOperation[];
        conflicts: ConflictInfo[];
    };
    /**
     * Get operations since a vector clock
     */
    getOperationsSince(clock: VectorClock): DeltaOperation[];
    /**
     * Get latest operation for each path
     */
    getLatestByPath(): Map<string, DeltaOperation>;
    /**
     * Compact the log by removing superseded operations
     */
    compact(): number;
    getClock(): VectorClock;
    getOperations(): DeltaOperation[];
    private clockEquals;
}
export declare class ConflictResolver {
    private strategy;
    constructor(strategy: DeltaSyncConfig['conflictStrategy']);
    /**
     * Resolve a conflict between two operations
     */
    resolve(conflict: ConflictInfo): ConflictInfo;
    private resolveLastWriteWins;
    private resolveFirstWriteWins;
    private resolveMerge;
    private deepMerge;
}
export declare class DeltaSyncManager extends EventEmitter {
    private agentId;
    private config;
    private operationLog;
    private merkleTree;
    private conflictResolver;
    private syncStates;
    private currentTree;
    private pendingBatches;
    private syncTimer;
    constructor(agentId: string, config?: Partial<DeltaSyncConfig>);
    /**
     * Initialize with a context object
     */
    initialize(context: Record<string, any>): void;
    private createOperationsFromContext;
    /**
     * Apply a local change
     */
    applyLocal(type: DeltaOperation['type'], path: string[], value?: any): DeltaOperation;
    /**
     * Set a value at a path
     */
    set(path: string[], value: any): DeltaOperation;
    /**
     * Delete a value at a path
     */
    delete(path: string[]): DeltaOperation;
    /**
     * Increment a numeric value
     */
    increment(path: string[], amount?: number): DeltaOperation;
    /**
     * Append to an array
     */
    append(path: string[], value: any): DeltaOperation;
    /**
     * Register a remote agent for sync
     */
    registerRemote(remoteAgentId: string): void;
    /**
     * Create a delta batch to send to a remote agent
     */
    createBatch(remoteAgentId: string): DeltaBatch | null;
    /**
     * Receive and apply a delta batch from a remote agent
     */
    receiveBatch(batch: DeltaBatch): {
        applied: DeltaOperation[];
        conflicts: ConflictInfo[];
        needsFullSync: boolean;
    };
    /**
     * Acknowledge a batch was received
     */
    acknowledgeBatch(batchId: string, remoteAgentId: string): void;
    /**
     * Request a full sync (when too diverged)
     */
    requestFullSync(remoteAgentId: string): {
        tree: any;
        clock: VectorClock;
        operations: DeltaOperation[];
    };
    /**
     * Apply a full sync from remote
     */
    applyFullSync(remoteAgentId: string, fullSync: {
        tree: any;
        clock: VectorClock;
        operations: DeltaOperation[];
    }): void;
    /**
     * Build context object from operation log
     */
    private buildContextFromOperations;
    /**
     * Start periodic sync
     */
    startPeriodicSync(): void;
    /**
     * Stop periodic sync
     */
    stopPeriodicSync(): void;
    /**
     * Get current value at a path
     */
    get(path: string[]): any;
    /**
     * Get sync statistics
     */
    getStats(): {
        operationCount: number;
        pendingByAgent: Record<string, number>;
        conflictsByAgent: Record<string, number>;
        merkleRoot: string;
        clock: VectorClock;
    };
    /**
     * Compact the operation log
     */
    compact(): number;
    private estimateDivergence;
}
/**
 * Create a delta sync manager with default config
 */
export declare function createDeltaSync(agentId: string, initialContext?: Record<string, any>, config?: Partial<DeltaSyncConfig>): DeltaSyncManager;
/**
 * Example usage demonstrating AI-to-AI context sync
 */
export declare function demonstrateDeltaSync(): Promise<void>;
