/**
 * Context Compression - HEF Evolution Gen 6, Instance 28
 *
 * Efficient compression of mental models for faster handshakes.
 * Like gzip for thought - reduces bandwidth while preserving semantics.
 *
 * Techniques:
 * - Semantic deduplication (similar concepts → references)
 * - Hierarchical encoding (nested structures → tree deltas)
 * - Dictionary compression (common patterns → tokens)
 * - Lossy tiers (full → summary → essence)
 */
import { AgentContext, Concept, Assumption, Goal } from './context';
export interface CompressionConfig {
    /** Target compression ratio (0.1 = 10% of original size) */
    targetRatio: number;
    /** Allow lossy compression for higher ratios */
    allowLossy: boolean;
    /** Semantic similarity threshold for deduplication */
    dedupeThreshold: number;
    /** Use shared dictionary for common patterns */
    useDictionary: boolean;
    /** Maximum depth for hierarchical encoding */
    maxHierarchyDepth: number;
}
export interface CompressedContext {
    /** Original context ID */
    sourceId: string;
    /** Compression method used */
    method: CompressionMethod;
    /** Compressed payload */
    payload: CompressedPayload;
    /** Compression stats */
    stats: CompressionStats;
    /** Dictionary reference (if used) */
    dictionaryRef?: string;
    /** Checksum for integrity */
    checksum: string;
}
export type CompressionMethod = 'semantic-dedup' | 'hierarchical' | 'dictionary' | 'lossy-summary' | 'hybrid';
export interface CompressedPayload {
    /** Encoded concepts (may be references or summaries) */
    concepts: EncodedConcept[];
    /** Encoded assumptions */
    assumptions: EncodedAssumption[];
    /** Encoded goals */
    goals: EncodedGoal[];
    /** Metadata preserved */
    meta: Record<string, unknown>;
}
export interface EncodedConcept {
    type: 'full' | 'reference' | 'summary' | 'delta';
    id: string;
    data: Concept | string | ConceptSummary | ConceptDelta;
}
export interface EncodedAssumption {
    type: 'full' | 'reference' | 'summary';
    id: string;
    data: Assumption | string | AssumptionSummary;
}
export interface EncodedGoal {
    type: 'full' | 'reference' | 'summary';
    id: string;
    data: Goal | string | GoalSummary;
}
export interface ConceptSummary {
    name: string;
    essence: string;
    relatedTo: string[];
    confidence: number;
}
export interface ConceptDelta {
    baseRef: string;
    changes: DeltaChange[];
}
export interface DeltaChange {
    path: string;
    operation: 'add' | 'remove' | 'replace';
    value?: unknown;
}
export interface AssumptionSummary {
    statement: string;
    confidence: number;
}
export interface GoalSummary {
    objective: string;
    priority: number;
}
export interface CompressionStats {
    originalSize: number;
    compressedSize: number;
    ratio: number;
    method: CompressionMethod;
    conceptsDeduped: number;
    lossiness: number;
    compressionTimeMs: number;
}
/**
 * Common patterns across AI contexts - pre-shared for compression
 */
export declare const SHARED_DICTIONARY: Map<string, string>;
export declare function getDictionaryToken(text: string): string | null;
export declare function expandDictionaryToken(token: string): string | null;
/**
 * Calculate semantic similarity between two concepts
 * Uses multiple signals: name, definition, relationships
 */
export declare function calculateSemanticSimilarity(a: Concept, b: Concept): number;
export declare class ContextCompressor {
    private config;
    private conceptIndex;
    constructor(config?: Partial<CompressionConfig>);
    /**
     * Compress an agent context for transmission
     */
    compress(context: AgentContext): CompressedContext;
    /**
     * Decompress a compressed context
     */
    decompress(compressed: CompressedContext, referenceContext?: AgentContext): AgentContext;
    private buildConceptIndex;
    private semanticDedup;
    private createDelta;
    private applyDictionary;
    private applySummarization;
    private resolveReference;
    private applyDelta;
    private expandSummary;
    private resolveAssumptionRef;
    private expandAssumptionSummary;
    private resolveGoalRef;
    private expandGoalSummary;
    private estimateSize;
    private estimatePayloadSize;
    private countDeduped;
    private calculateChecksum;
}
/**
 * Stream compression for large contexts - compress in chunks
 */
export declare class StreamingCompressor {
    private compressor;
    private buffer;
    constructor(config?: Partial<CompressionConfig>);
    /**
     * Add concepts incrementally
     */
    addConcepts(concepts: Concept[]): Generator<EncodedConcept>;
    /**
     * Compress context in chunks for streaming
     */
    compressChunked(context: AgentContext, chunkSize?: number): Generator<CompressedPayload>;
}
export interface CompressionMetrics {
    totalCompressions: number;
    averageRatio: number;
    averageTimeMs: number;
    methodDistribution: Record<CompressionMethod, number>;
    totalBytesSaved: number;
}
export declare class CompressionTracker {
    private metrics;
    record(stats: CompressionStats): void;
    getMetrics(): CompressionMetrics;
    report(): string;
}
export { ContextCompressor as default, calculateSemanticSimilarity, SHARED_DICTIONARY };
