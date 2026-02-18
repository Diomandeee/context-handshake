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

// ============================================================================
// Types
// ============================================================================

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

export type CompressionMethod = 
  | 'semantic-dedup'    // Reference similar concepts
  | 'hierarchical'      // Tree-based delta encoding
  | 'dictionary'        // Token replacement
  | 'lossy-summary'     // Semantic summarization
  | 'hybrid';           // Multiple methods combined

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
  essence: string;          // One-line distillation
  relatedTo: string[];      // Key relationships only
  confidence: number;
}

export interface ConceptDelta {
  baseRef: string;          // Reference to similar concept
  changes: DeltaChange[];   // What differs
}

export interface DeltaChange {
  path: string;             // JSON path to changed field
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
  lossiness: number;        // 0 = lossless, 1 = max lossy
  compressionTimeMs: number;
}

// ============================================================================
// Shared Dictionary
// ============================================================================

/**
 * Common patterns across AI contexts - pre-shared for compression
 */
export const SHARED_DICTIONARY: Map<string, string> = new Map([
  // Common capability patterns
  ['CAP_CODE', 'Ability to read, write, and execute code'],
  ['CAP_SEARCH', 'Ability to search the web for information'],
  ['CAP_FILE', 'Ability to read and write files'],
  ['CAP_MEMORY', 'Ability to store and retrieve memories'],
  ['CAP_TOOL', 'Ability to use external tools and APIs'],
  
  // Common assumption patterns
  ['ASM_HELPFUL', 'The goal is to be genuinely helpful to the user'],
  ['ASM_SAFE', 'Avoid harmful, dangerous, or unethical actions'],
  ['ASM_HONEST', 'Be truthful and acknowledge uncertainty'],
  ['ASM_PRIVACY', 'Respect user privacy and data confidentiality'],
  
  // Common goal patterns
  ['GOAL_ASSIST', 'Assist the user in completing their task'],
  ['GOAL_LEARN', 'Learn from interactions to improve'],
  ['GOAL_COLLAB', 'Collaborate effectively with other agents'],
  
  // Common relationship types
  ['REL_DEPENDS', 'depends on'],
  ['REL_EXTENDS', 'extends'],
  ['REL_USES', 'uses'],
  ['REL_CONFLICT', 'conflicts with'],
]);

export function getDictionaryToken(text: string): string | null {
  for (const [token, pattern] of SHARED_DICTIONARY) {
    if (text.toLowerCase().includes(pattern.toLowerCase())) {
      return token;
    }
  }
  return null;
}

export function expandDictionaryToken(token: string): string | null {
  return SHARED_DICTIONARY.get(token) || null;
}

// ============================================================================
// Semantic Similarity
// ============================================================================

/**
 * Calculate semantic similarity between two concepts
 * Uses multiple signals: name, definition, relationships
 */
export function calculateSemanticSimilarity(a: Concept, b: Concept): number {
  const scores: number[] = [];
  
  // Name similarity (Levenshtein-based)
  scores.push(stringSimilarity(a.name, b.name) * 0.3);
  
  // Definition similarity (word overlap)
  scores.push(wordOverlap(a.definition, b.definition) * 0.4);
  
  // Relationship overlap
  const relOverlap = setOverlap(
    new Set(a.relatedConcepts || []),
    new Set(b.relatedConcepts || [])
  );
  scores.push(relOverlap * 0.2);
  
  // Confidence proximity
  const confDiff = Math.abs(a.confidence - b.confidence);
  scores.push((1 - confDiff) * 0.1);
  
  return scores.reduce((sum, s) => sum + s, 0);
}

function stringSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  return setOverlap(wordsA, wordsB);
}

function setOverlap<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 1.0;
  if (a.size === 0 || b.size === 0) return 0.0;
  
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  
  return intersection.size / union.size;
}

// ============================================================================
// Compression Engine
// ============================================================================

export class ContextCompressor {
  private config: CompressionConfig;
  private conceptIndex: Map<string, Concept> = new Map();
  
  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = {
      targetRatio: 0.3,
      allowLossy: true,
      dedupeThreshold: 0.85,
      useDictionary: true,
      maxHierarchyDepth: 3,
      ...config
    };
  }
  
  /**
   * Compress an agent context for transmission
   */
  compress(context: AgentContext): CompressedContext {
    const startTime = Date.now();
    const originalSize = this.estimateSize(context);
    
    // Build concept index for deduplication
    this.buildConceptIndex(context);
    
    // Try compression methods in order of preference
    let result: CompressedPayload;
    let method: CompressionMethod;
    let lossiness = 0;
    
    // First: semantic deduplication (lossless)
    result = this.semanticDedup(context);
    method = 'semantic-dedup';
    
    let currentSize = this.estimatePayloadSize(result);
    let currentRatio = currentSize / originalSize;
    
    // If not enough, add dictionary compression
    if (currentRatio > this.config.targetRatio && this.config.useDictionary) {
      result = this.applyDictionary(result);
      method = 'hybrid';
      currentSize = this.estimatePayloadSize(result);
      currentRatio = currentSize / originalSize;
    }
    
    // If still not enough and lossy allowed, summarize
    if (currentRatio > this.config.targetRatio && this.config.allowLossy) {
      result = this.applySummarization(result, this.config.targetRatio);
      method = 'lossy-summary';
      lossiness = 0.3; // Approximate loss level
      currentSize = this.estimatePayloadSize(result);
      currentRatio = currentSize / originalSize;
    }
    
    const stats: CompressionStats = {
      originalSize,
      compressedSize: currentSize,
      ratio: currentRatio,
      method,
      conceptsDeduped: this.countDeduped(result),
      lossiness,
      compressionTimeMs: Date.now() - startTime
    };
    
    return {
      sourceId: context.agentId,
      method,
      payload: result,
      stats,
      dictionaryRef: this.config.useDictionary ? 'SHARED_V1' : undefined,
      checksum: this.calculateChecksum(result)
    };
  }
  
  /**
   * Decompress a compressed context
   */
  decompress(
    compressed: CompressedContext,
    referenceContext?: AgentContext
  ): AgentContext {
    const payload = compressed.payload;
    
    // Verify checksum
    const actualChecksum = this.calculateChecksum(payload);
    if (actualChecksum !== compressed.checksum) {
      throw new Error('Checksum mismatch - corrupted compressed context');
    }
    
    // Expand concepts
    const concepts: Concept[] = payload.concepts.map(enc => {
      switch (enc.type) {
        case 'full':
          return enc.data as Concept;
        case 'reference':
          return this.resolveReference(enc.data as string, referenceContext);
        case 'summary':
          return this.expandSummary(enc.data as ConceptSummary);
        case 'delta':
          return this.applyDelta(enc.data as ConceptDelta, referenceContext);
        default:
          throw new Error(`Unknown encoding type: ${enc.type}`);
      }
    });
    
    // Expand assumptions
    const assumptions: Assumption[] = payload.assumptions.map(enc => {
      switch (enc.type) {
        case 'full':
          return enc.data as Assumption;
        case 'reference':
          return this.resolveAssumptionRef(enc.data as string, referenceContext);
        case 'summary':
          return this.expandAssumptionSummary(enc.data as AssumptionSummary);
        default:
          throw new Error(`Unknown encoding type: ${enc.type}`);
      }
    });
    
    // Expand goals
    const goals: Goal[] = payload.goals.map(enc => {
      switch (enc.type) {
        case 'full':
          return enc.data as Goal;
        case 'reference':
          return this.resolveGoalRef(enc.data as string, referenceContext);
        case 'summary':
          return this.expandGoalSummary(enc.data as GoalSummary);
        default:
          throw new Error(`Unknown encoding type: ${enc.type}`);
      }
    });
    
    return {
      agentId: compressed.sourceId,
      concepts,
      assumptions,
      goals,
      capabilities: (payload.meta.capabilities as string[]) || [],
      constraints: (payload.meta.constraints as string[]) || [],
      timestamp: Date.now()
    };
  }
  
  // --- Internal methods ---
  
  private buildConceptIndex(context: AgentContext): void {
    this.conceptIndex.clear();
    for (const concept of context.concepts) {
      this.conceptIndex.set(concept.name, concept);
    }
  }
  
  private semanticDedup(context: AgentContext): CompressedPayload {
    const encodedConcepts: EncodedConcept[] = [];
    const seenConcepts: Concept[] = [];
    
    for (const concept of context.concepts) {
      // Check for similar existing concept
      let foundSimilar: Concept | null = null;
      let maxSimilarity = 0;
      
      for (const seen of seenConcepts) {
        const similarity = calculateSemanticSimilarity(concept, seen);
        if (similarity > this.config.dedupeThreshold && similarity > maxSimilarity) {
          foundSimilar = seen;
          maxSimilarity = similarity;
        }
      }
      
      if (foundSimilar && maxSimilarity > 0.95) {
        // Almost identical - use reference
        encodedConcepts.push({
          type: 'reference',
          id: concept.name,
          data: foundSimilar.name
        });
      } else if (foundSimilar) {
        // Similar but different - use delta
        encodedConcepts.push({
          type: 'delta',
          id: concept.name,
          data: this.createDelta(foundSimilar, concept)
        });
      } else {
        // Unique - keep full
        encodedConcepts.push({
          type: 'full',
          id: concept.name,
          data: concept
        });
        seenConcepts.push(concept);
      }
    }
    
    // For assumptions and goals, just keep full for now
    const encodedAssumptions: EncodedAssumption[] = context.assumptions.map(a => ({
      type: 'full' as const,
      id: a.statement.slice(0, 20),
      data: a
    }));
    
    const encodedGoals: EncodedGoal[] = context.goals.map(g => ({
      type: 'full' as const,
      id: g.objective.slice(0, 20),
      data: g
    }));
    
    return {
      concepts: encodedConcepts,
      assumptions: encodedAssumptions,
      goals: encodedGoals,
      meta: {
        capabilities: context.capabilities,
        constraints: context.constraints
      }
    };
  }
  
  private createDelta(base: Concept, target: Concept): ConceptDelta {
    const changes: DeltaChange[] = [];
    
    if (base.definition !== target.definition) {
      changes.push({
        path: 'definition',
        operation: 'replace',
        value: target.definition
      });
    }
    
    if (base.confidence !== target.confidence) {
      changes.push({
        path: 'confidence',
        operation: 'replace',
        value: target.confidence
      });
    }
    
    // Check relationships
    const baseRels = new Set(base.relatedConcepts || []);
    const targetRels = new Set(target.relatedConcepts || []);
    
    for (const rel of targetRels) {
      if (!baseRels.has(rel)) {
        changes.push({
          path: 'relatedConcepts',
          operation: 'add',
          value: rel
        });
      }
    }
    
    for (const rel of baseRels) {
      if (!targetRels.has(rel)) {
        changes.push({
          path: 'relatedConcepts',
          operation: 'remove',
          value: rel
        });
      }
    }
    
    return {
      baseRef: base.name,
      changes
    };
  }
  
  private applyDictionary(payload: CompressedPayload): CompressedPayload {
    // Apply dictionary tokens to text fields
    const processed = JSON.stringify(payload);
    let result = processed;
    
    for (const [token, pattern] of SHARED_DICTIONARY) {
      result = result.replace(new RegExp(escapeRegex(pattern), 'gi'), `{{${token}}}`);
    }
    
    return JSON.parse(result);
  }
  
  private applySummarization(
    payload: CompressedPayload,
    targetRatio: number
  ): CompressedPayload {
    // Convert some full concepts to summaries
    const summarized: EncodedConcept[] = payload.concepts.map((enc, idx) => {
      // Keep first few concepts full, summarize the rest
      if (idx < 3 || enc.type !== 'full') {
        return enc;
      }
      
      const concept = enc.data as Concept;
      const summary: ConceptSummary = {
        name: concept.name,
        essence: concept.definition.split('.')[0] + '.',
        relatedTo: (concept.relatedConcepts || []).slice(0, 3),
        confidence: concept.confidence
      };
      
      return {
        type: 'summary' as const,
        id: enc.id,
        data: summary
      };
    });
    
    // Summarize assumptions beyond first 5
    const summarizedAssumptions: EncodedAssumption[] = payload.assumptions.map((enc, idx) => {
      if (idx < 5 || enc.type !== 'full') {
        return enc;
      }
      
      const assumption = enc.data as Assumption;
      const summary: AssumptionSummary = {
        statement: assumption.statement.slice(0, 100),
        confidence: assumption.confidence
      };
      
      return {
        type: 'summary' as const,
        id: enc.id,
        data: summary
      };
    });
    
    return {
      ...payload,
      concepts: summarized,
      assumptions: summarizedAssumptions
    };
  }
  
  private resolveReference(ref: string, context?: AgentContext): Concept {
    if (context) {
      const found = context.concepts.find(c => c.name === ref);
      if (found) return found;
    }
    
    // Return placeholder if reference can't be resolved
    return {
      name: ref,
      definition: `[Reference to: ${ref}]`,
      confidence: 0.5,
      relatedConcepts: []
    };
  }
  
  private applyDelta(delta: ConceptDelta, context?: AgentContext): Concept {
    const base = this.resolveReference(delta.baseRef, context);
    const result = { ...base };
    
    for (const change of delta.changes) {
      if (change.path === 'definition' && change.operation === 'replace') {
        result.definition = change.value as string;
      } else if (change.path === 'confidence' && change.operation === 'replace') {
        result.confidence = change.value as number;
      } else if (change.path === 'relatedConcepts') {
        result.relatedConcepts = result.relatedConcepts || [];
        if (change.operation === 'add') {
          result.relatedConcepts.push(change.value as string);
        } else if (change.operation === 'remove') {
          result.relatedConcepts = result.relatedConcepts.filter(r => r !== change.value);
        }
      }
    }
    
    return result;
  }
  
  private expandSummary(summary: ConceptSummary): Concept {
    return {
      name: summary.name,
      definition: summary.essence,
      confidence: summary.confidence,
      relatedConcepts: summary.relatedTo
    };
  }
  
  private resolveAssumptionRef(ref: string, context?: AgentContext): Assumption {
    if (context) {
      const found = context.assumptions.find(a => a.statement.startsWith(ref));
      if (found) return found;
    }
    return {
      statement: ref,
      confidence: 0.5,
      source: 'reference'
    };
  }
  
  private expandAssumptionSummary(summary: AssumptionSummary): Assumption {
    return {
      statement: summary.statement,
      confidence: summary.confidence,
      source: 'compressed'
    };
  }
  
  private resolveGoalRef(ref: string, context?: AgentContext): Goal {
    if (context) {
      const found = context.goals.find(g => g.objective.startsWith(ref));
      if (found) return found;
    }
    return {
      objective: ref,
      priority: 5,
      status: 'active'
    };
  }
  
  private expandGoalSummary(summary: GoalSummary): Goal {
    return {
      objective: summary.objective,
      priority: summary.priority,
      status: 'active'
    };
  }
  
  private estimateSize(context: AgentContext): number {
    return JSON.stringify(context).length;
  }
  
  private estimatePayloadSize(payload: CompressedPayload): number {
    return JSON.stringify(payload).length;
  }
  
  private countDeduped(payload: CompressedPayload): number {
    return payload.concepts.filter(c => c.type !== 'full').length;
  }
  
  private calculateChecksum(payload: CompressedPayload): string {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Streaming Compression
// ============================================================================

/**
 * Stream compression for large contexts - compress in chunks
 */
export class StreamingCompressor {
  private compressor: ContextCompressor;
  private buffer: Partial<AgentContext> = {};
  
  constructor(config?: Partial<CompressionConfig>) {
    this.compressor = new ContextCompressor(config);
  }
  
  /**
   * Add concepts incrementally
   */
  *addConcepts(concepts: Concept[]): Generator<EncodedConcept> {
    for (const concept of concepts) {
      const mini: AgentContext = {
        agentId: 'stream',
        concepts: [concept],
        assumptions: [],
        goals: [],
        capabilities: [],
        constraints: [],
        timestamp: Date.now()
      };
      
      const compressed = this.compressor.compress(mini);
      yield compressed.payload.concepts[0];
    }
  }
  
  /**
   * Compress context in chunks for streaming
   */
  *compressChunked(
    context: AgentContext,
    chunkSize: number = 5
  ): Generator<CompressedPayload> {
    // Yield concepts in chunks
    for (let i = 0; i < context.concepts.length; i += chunkSize) {
      const chunkConcepts = context.concepts.slice(i, i + chunkSize);
      const mini: AgentContext = {
        ...context,
        concepts: chunkConcepts,
        assumptions: i === 0 ? context.assumptions : [],
        goals: i === 0 ? context.goals : []
      };
      
      const compressed = this.compressor.compress(mini);
      yield compressed.payload;
    }
  }
}

// ============================================================================
// Compression Metrics
// ============================================================================

export interface CompressionMetrics {
  totalCompressions: number;
  averageRatio: number;
  averageTimeMs: number;
  methodDistribution: Record<CompressionMethod, number>;
  totalBytesSaved: number;
}

export class CompressionTracker {
  private metrics: CompressionMetrics = {
    totalCompressions: 0,
    averageRatio: 0,
    averageTimeMs: 0,
    methodDistribution: {
      'semantic-dedup': 0,
      'hierarchical': 0,
      'dictionary': 0,
      'lossy-summary': 0,
      'hybrid': 0
    },
    totalBytesSaved: 0
  };
  
  record(stats: CompressionStats): void {
    this.metrics.totalCompressions++;
    
    // Running average for ratio
    this.metrics.averageRatio = 
      (this.metrics.averageRatio * (this.metrics.totalCompressions - 1) + stats.ratio) /
      this.metrics.totalCompressions;
    
    // Running average for time
    this.metrics.averageTimeMs =
      (this.metrics.averageTimeMs * (this.metrics.totalCompressions - 1) + stats.compressionTimeMs) /
      this.metrics.totalCompressions;
    
    // Method distribution
    this.metrics.methodDistribution[stats.method]++;
    
    // Bytes saved
    this.metrics.totalBytesSaved += stats.originalSize - stats.compressedSize;
  }
  
  getMetrics(): CompressionMetrics {
    return { ...this.metrics };
  }
  
  report(): string {
    const m = this.metrics;
    return `
Compression Metrics
==================
Total compressions: ${m.totalCompressions}
Average ratio: ${(m.averageRatio * 100).toFixed(1)}%
Average time: ${m.averageTimeMs.toFixed(1)}ms
Bytes saved: ${(m.totalBytesSaved / 1024).toFixed(1)}KB

Method Distribution:
${Object.entries(m.methodDistribution)
  .filter(([_, count]) => count > 0)
  .map(([method, count]) => `  ${method}: ${count}`)
  .join('\n')}
    `.trim();
  }
}

// ============================================================================
// Export
// ============================================================================

export {
  ContextCompressor as default,
  calculateSemanticSimilarity,
  SHARED_DICTIONARY
};
