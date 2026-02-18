/**
 * Context Speculation - TCP Fast Open for Mental Models
 * 
 * Like TCP Fast Open reduces handshake latency by caching connection data,
 * Context Speculation pre-loads likely-needed context based on learned
 * collaboration patterns. When Agent A has worked with Agent B before,
 * skip the full discovery—speculate on what context will be needed.
 * 
 * Gen 6 | Instance 28 | task_20260203030845_806efb
 * Evolution Techniques: G15 (Analogy), R06 (Efficiency), G05 (SCAMPER-Adapt)
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ============================================================================
// Core Types
// ============================================================================

export interface ContextPattern {
  id: string;
  agentPairHash: string;           // Hash of both agent IDs
  taskTypeSignature: string;       // What kind of tasks trigger this
  frequentConcepts: ConceptFrequency[];
  temporalPatterns: TemporalPattern[];
  successCorrelations: SuccessCorrelation[];
  lastSeen: number;
  hitCount: number;
  missRate: number;
  confidence: number;               // 0-1, how reliable is this pattern
}

export interface ConceptFrequency {
  concept: string;
  frequency: number;                // How often requested
  positionInHandshake: number;      // When typically requested (early/late)
  coOccurrences: string[];          // Often requested together
}

export interface TemporalPattern {
  hourOfDay: number;
  dayOfWeek: number;
  typicalTaskType: string;
  avgContextSize: number;
}

export interface SuccessCorrelation {
  contextSet: string[];             // Which concepts were present
  outcomeScore: number;             // How successful was the collab
  sampleSize: number;
}

export interface SpeculativeContext {
  id: string;
  predictedConcepts: PredictedConcept[];
  speculationConfidence: number;
  generatedAt: number;
  expiresAt: number;
  source: 'pattern' | 'temporal' | 'hybrid';
}

export interface PredictedConcept {
  concept: string;
  probability: number;              // 0-1, how likely to be needed
  preloadedValue?: unknown;         // The actual pre-fetched context
  costToFetch: number;              // Tokens/latency to fetch if wrong
  benefitIfHit: number;             // Tokens/latency saved if right
  ev: number;                       // Expected value (benefit * prob - cost * (1-prob))
}

export interface SpeculationResult {
  hit: boolean;
  concept: string;
  speculatedValue: unknown;
  actualValue: unknown;
  latencySaved?: number;
  tokensSaved?: number;
}

export interface PatternLearning {
  agentPair: [string, string];
  taskType: string;
  requestedConcepts: string[];
  timestamp: number;
  outcome: 'success' | 'failure' | 'partial';
  outcomeScore: number;
}

// ============================================================================
// Speculation Engine
// ============================================================================

export class ContextSpeculationEngine extends EventEmitter {
  private patterns: Map<string, ContextPattern> = new Map();
  private activeSpeculations: Map<string, SpeculativeContext> = new Map();
  private learningBuffer: PatternLearning[] = [];
  
  // Tuning parameters
  private readonly minConfidenceToSpeculate = 0.6;
  private readonly maxSpeculativeConcepts = 10;
  private readonly patternDecayHalfLife = 7 * 24 * 60 * 60 * 1000; // 1 week
  private readonly learningBatchSize = 20;
  private readonly evThreshold = 0.2; // Minimum expected value to speculate
  
  constructor(
    private readonly contextFetcher: (concept: string) => Promise<unknown>,
    private readonly options: SpeculationOptions = {}
  ) {
    super();
    this.startMaintenanceLoop();
  }

  // --------------------------------------------------------------------------
  // Pattern Learning
  // --------------------------------------------------------------------------

  /**
   * Record a collaboration for pattern learning
   */
  recordCollaboration(learning: PatternLearning): void {
    this.learningBuffer.push(learning);
    
    if (this.learningBuffer.length >= this.learningBatchSize) {
      this.processLearningBuffer();
    }
    
    this.emit('learning:recorded', learning);
  }

  private processLearningBuffer(): void {
    const buffer = this.learningBuffer.splice(0);
    
    // Group by agent pair
    const byPair = new Map<string, PatternLearning[]>();
    for (const learning of buffer) {
      const pairHash = this.hashAgentPair(learning.agentPair);
      const existing = byPair.get(pairHash) || [];
      existing.push(learning);
      byPair.set(pairHash, existing);
    }
    
    // Update patterns for each pair
    for (const [pairHash, learnings] of byPair) {
      this.updatePattern(pairHash, learnings);
    }
    
    this.emit('learning:batch-processed', { count: buffer.length });
  }

  private updatePattern(pairHash: string, learnings: PatternLearning[]): void {
    let pattern = this.patterns.get(pairHash);
    
    if (!pattern) {
      pattern = this.createEmptyPattern(pairHash, learnings[0]);
    }
    
    // Update concept frequencies
    const conceptCounts = new Map<string, number>();
    const coOccurrences = new Map<string, Set<string>>();
    
    for (const learning of learnings) {
      for (let i = 0; i < learning.requestedConcepts.length; i++) {
        const concept = learning.requestedConcepts[i];
        conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
        
        // Track co-occurrences
        const others = new Set(learning.requestedConcepts.filter((_, j) => j !== i));
        const existing = coOccurrences.get(concept) || new Set();
        others.forEach(o => existing.add(o));
        coOccurrences.set(concept, existing);
      }
    }
    
    // Merge with existing pattern
    for (const [concept, count] of conceptCounts) {
      const existing = pattern.frequentConcepts.find(c => c.concept === concept);
      if (existing) {
        existing.frequency = (existing.frequency + count) / 2; // Moving average
        existing.coOccurrences = [...new Set([
          ...existing.coOccurrences,
          ...(coOccurrences.get(concept) || [])
        ])].slice(0, 5); // Top 5 co-occurrences
      } else {
        pattern.frequentConcepts.push({
          concept,
          frequency: count,
          positionInHandshake: 0, // Will be refined
          coOccurrences: [...(coOccurrences.get(concept) || [])].slice(0, 5)
        });
      }
    }
    
    // Update success correlations
    for (const learning of learnings) {
      if (learning.outcome === 'success' && learning.outcomeScore > 0.8) {
        const conceptSet = [...learning.requestedConcepts].sort();
        const setKey = conceptSet.join('|');
        
        const existing = pattern.successCorrelations.find(
          c => c.contextSet.join('|') === setKey
        );
        
        if (existing) {
          existing.outcomeScore = (existing.outcomeScore + learning.outcomeScore) / 2;
          existing.sampleSize++;
        } else {
          pattern.successCorrelations.push({
            contextSet: conceptSet,
            outcomeScore: learning.outcomeScore,
            sampleSize: 1
          });
        }
      }
    }
    
    // Update temporal patterns
    for (const learning of learnings) {
      const date = new Date(learning.timestamp);
      const temporal: TemporalPattern = {
        hourOfDay: date.getHours(),
        dayOfWeek: date.getDay(),
        typicalTaskType: learning.taskType,
        avgContextSize: learning.requestedConcepts.length
      };
      
      // Keep only recent temporal patterns (last 20)
      pattern.temporalPatterns.push(temporal);
      if (pattern.temporalPatterns.length > 20) {
        pattern.temporalPatterns.shift();
      }
    }
    
    // Update metadata
    pattern.lastSeen = Date.now();
    pattern.hitCount += learnings.length;
    pattern.confidence = this.calculatePatternConfidence(pattern);
    
    // Sort by frequency
    pattern.frequentConcepts.sort((a, b) => b.frequency - a.frequency);
    pattern.frequentConcepts = pattern.frequentConcepts.slice(0, 20); // Keep top 20
    
    this.patterns.set(pairHash, pattern);
    this.emit('pattern:updated', { pairHash, confidence: pattern.confidence });
  }

  private createEmptyPattern(pairHash: string, sample: PatternLearning): ContextPattern {
    return {
      id: crypto.randomUUID(),
      agentPairHash: pairHash,
      taskTypeSignature: sample.taskType,
      frequentConcepts: [],
      temporalPatterns: [],
      successCorrelations: [],
      lastSeen: Date.now(),
      hitCount: 0,
      missRate: 0,
      confidence: 0
    };
  }

  private calculatePatternConfidence(pattern: ContextPattern): number {
    // Factors: sample size, recency, consistency
    const sampleFactor = Math.min(pattern.hitCount / 50, 1); // Max out at 50 samples
    
    const age = Date.now() - pattern.lastSeen;
    const recencyFactor = Math.exp(-age / this.patternDecayHalfLife);
    
    const consistencyFactor = 1 - pattern.missRate;
    
    return sampleFactor * 0.4 + recencyFactor * 0.3 + consistencyFactor * 0.3;
  }

  // --------------------------------------------------------------------------
  // Speculation Generation
  // --------------------------------------------------------------------------

  /**
   * Generate speculative context for an upcoming collaboration
   */
  async speculate(
    agentA: string,
    agentB: string,
    taskHint?: string
  ): Promise<SpeculativeContext | null> {
    const pairHash = this.hashAgentPair([agentA, agentB]);
    const pattern = this.patterns.get(pairHash);
    
    if (!pattern || pattern.confidence < this.minConfidenceToSpeculate) {
      this.emit('speculation:skipped', {
        reason: pattern ? 'low-confidence' : 'no-pattern',
        pairHash
      });
      return null;
    }
    
    // Select concepts to speculate on
    const candidates = this.selectSpeculationCandidates(pattern, taskHint);
    
    if (candidates.length === 0) {
      return null;
    }
    
    // Pre-fetch high-EV concepts
    const predictions: PredictedConcept[] = [];
    
    for (const candidate of candidates) {
      try {
        const value = await this.contextFetcher(candidate.concept);
        predictions.push({
          ...candidate,
          preloadedValue: value
        });
      } catch (error) {
        // Failed to prefetch - still include without value
        predictions.push(candidate);
      }
    }
    
    const speculation: SpeculativeContext = {
      id: crypto.randomUUID(),
      predictedConcepts: predictions,
      speculationConfidence: pattern.confidence,
      generatedAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute TTL
      source: taskHint ? 'hybrid' : 'pattern'
    };
    
    this.activeSpeculations.set(speculation.id, speculation);
    this.emit('speculation:generated', {
      id: speculation.id,
      conceptCount: predictions.length,
      confidence: speculation.speculationConfidence
    });
    
    return speculation;
  }

  private selectSpeculationCandidates(
    pattern: ContextPattern,
    taskHint?: string
  ): PredictedConcept[] {
    const candidates: PredictedConcept[] = [];
    
    // Calculate base probability from frequency
    const totalFrequency = pattern.frequentConcepts.reduce(
      (sum, c) => sum + c.frequency, 0
    );
    
    for (const concept of pattern.frequentConcepts) {
      const baseProbability = concept.frequency / totalFrequency;
      
      // Boost if task hint matches
      let taskBoost = 1.0;
      if (taskHint && concept.concept.toLowerCase().includes(taskHint.toLowerCase())) {
        taskBoost = 1.5;
      }
      
      // Boost based on success correlation
      let successBoost = 1.0;
      for (const correlation of pattern.successCorrelations) {
        if (correlation.contextSet.includes(concept.concept)) {
          successBoost = Math.max(successBoost, correlation.outcomeScore);
        }
      }
      
      // Temporal boost - is this concept typically requested at this time?
      let temporalBoost = 1.0;
      const now = new Date();
      const matchingTemporal = pattern.temporalPatterns.filter(
        t => t.hourOfDay === now.getHours() || t.dayOfWeek === now.getDay()
      );
      if (matchingTemporal.length > pattern.temporalPatterns.length * 0.3) {
        temporalBoost = 1.2;
      }
      
      const probability = Math.min(
        baseProbability * taskBoost * successBoost * temporalBoost,
        0.95 // Cap at 95%
      );
      
      // Estimate costs (simplified - could be more sophisticated)
      const costToFetch = 100; // tokens to fetch if speculation was wrong
      const benefitIfHit = 500; // tokens saved if speculation was right
      
      const ev = (probability * benefitIfHit) - ((1 - probability) * costToFetch);
      
      if (ev > this.evThreshold) {
        candidates.push({
          concept: concept.concept,
          probability,
          costToFetch,
          benefitIfHit,
          ev
        });
      }
    }
    
    // Sort by EV and take top N
    candidates.sort((a, b) => b.ev - a.ev);
    return candidates.slice(0, this.maxSpeculativeConcepts);
  }

  // --------------------------------------------------------------------------
  // Speculation Verification
  // --------------------------------------------------------------------------

  /**
   * Check if a requested concept was speculated
   */
  checkSpeculation(
    speculationId: string,
    concept: string
  ): SpeculationResult | null {
    const speculation = this.activeSpeculations.get(speculationId);
    
    if (!speculation || speculation.expiresAt < Date.now()) {
      return null;
    }
    
    const predicted = speculation.predictedConcepts.find(
      p => p.concept === concept
    );
    
    if (!predicted) {
      // Miss - concept wasn't speculated
      this.emit('speculation:miss', { speculationId, concept });
      this.recordSpeculationResult(speculationId, concept, false);
      return {
        hit: false,
        concept,
        speculatedValue: undefined,
        actualValue: undefined
      };
    }
    
    // Hit - return pre-loaded value
    this.emit('speculation:hit', {
      speculationId,
      concept,
      probability: predicted.probability
    });
    this.recordSpeculationResult(speculationId, concept, true);
    
    return {
      hit: true,
      concept,
      speculatedValue: predicted.preloadedValue,
      actualValue: predicted.preloadedValue,
      latencySaved: 50, // Estimated ms saved
      tokensSaved: predicted.benefitIfHit
    };
  }

  private recordSpeculationResult(
    speculationId: string,
    concept: string,
    hit: boolean
  ): void {
    // Update miss rate for the pattern
    const speculation = this.activeSpeculations.get(speculationId);
    if (!speculation) return;
    
    // This would need to trace back to the pattern - simplified here
    // In production, speculation would store its source pattern ID
  }

  /**
   * Finalize a speculation session - analyze what was used vs speculated
   */
  finalizeSpeculation(
    speculationId: string,
    actuallyRequested: string[]
  ): SpeculationAnalysis {
    const speculation = this.activeSpeculations.get(speculationId);
    
    if (!speculation) {
      return { hits: 0, misses: 0, wasted: 0, accuracy: 0, savings: 0 };
    }
    
    const speculated = new Set(speculation.predictedConcepts.map(p => p.concept));
    const requested = new Set(actuallyRequested);
    
    let hits = 0;
    let misses = 0;
    let wasted = 0;
    let totalSavings = 0;
    let totalWaste = 0;
    
    for (const concept of requested) {
      if (speculated.has(concept)) {
        hits++;
        const pred = speculation.predictedConcepts.find(p => p.concept === concept);
        if (pred) totalSavings += pred.benefitIfHit;
      } else {
        misses++;
      }
    }
    
    for (const concept of speculated) {
      if (!requested.has(concept)) {
        wasted++;
        const pred = speculation.predictedConcepts.find(p => p.concept === concept);
        if (pred) totalWaste += pred.costToFetch;
      }
    }
    
    const accuracy = requested.size > 0 ? hits / requested.size : 0;
    
    // Clean up
    this.activeSpeculations.delete(speculationId);
    
    this.emit('speculation:finalized', {
      speculationId,
      hits,
      misses,
      wasted,
      accuracy
    });
    
    return {
      hits,
      misses,
      wasted,
      accuracy,
      savings: totalSavings - totalWaste
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private hashAgentPair(pair: [string, string]): string {
    const sorted = [...pair].sort();
    return crypto.createHash('sha256')
      .update(sorted.join(':'))
      .digest('hex')
      .substring(0, 16);
  }

  private startMaintenanceLoop(): void {
    // Periodically decay old patterns and clean up expired speculations
    setInterval(() => {
      const now = Date.now();
      
      // Clean expired speculations
      for (const [id, spec] of this.activeSpeculations) {
        if (spec.expiresAt < now) {
          this.activeSpeculations.delete(id);
        }
      }
      
      // Decay old patterns
      for (const [hash, pattern] of this.patterns) {
        const age = now - pattern.lastSeen;
        if (age > this.patternDecayHalfLife * 4) {
          // Pattern too old, remove
          this.patterns.delete(hash);
          this.emit('pattern:expired', { pairHash: hash });
        }
      }
      
      // Process any remaining learning buffer
      if (this.learningBuffer.length > 0) {
        this.processLearningBuffer();
      }
    }, 60 * 1000); // Every minute
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  export(): PatternExport {
    return {
      patterns: Array.from(this.patterns.values()),
      exportedAt: Date.now()
    };
  }

  import(data: PatternExport): void {
    for (const pattern of data.patterns) {
      this.patterns.set(pattern.agentPairHash, pattern);
    }
    this.emit('patterns:imported', { count: data.patterns.length });
  }

  getStats(): SpeculationStats {
    let totalHits = 0;
    let totalPatterns = this.patterns.size;
    
    for (const pattern of this.patterns.values()) {
      totalHits += pattern.hitCount;
    }
    
    return {
      totalPatterns,
      totalHits,
      activeSpeculations: this.activeSpeculations.size,
      avgConfidence: this.patterns.size > 0
        ? Array.from(this.patterns.values()).reduce((s, p) => s + p.confidence, 0) / this.patterns.size
        : 0
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface SpeculationOptions {
  minConfidence?: number;
  maxConcepts?: number;
  evThreshold?: number;
}

export interface SpeculationAnalysis {
  hits: number;
  misses: number;
  wasted: number;         // Concepts speculated but not needed
  accuracy: number;       // hits / total requested
  savings: number;        // Net tokens saved (can be negative)
}

export interface PatternExport {
  patterns: ContextPattern[];
  exportedAt: number;
}

export interface SpeculationStats {
  totalPatterns: number;
  totalHits: number;
  activeSpeculations: number;
  avgConfidence: number;
}

// ============================================================================
// Integration with Context Handshake
// ============================================================================

export class SpeculativeHandshake {
  private engine: ContextSpeculationEngine;
  private currentSpeculation: SpeculativeContext | null = null;
  
  constructor(
    engine: ContextSpeculationEngine,
    private readonly handshakeCallback: (speculation?: SpeculativeContext) => Promise<void>
  ) {
    this.engine = engine;
  }

  /**
   * Begin a speculative handshake - pre-load context before formal handshake
   */
  async beginSpeculative(
    localAgent: string,
    remoteAgent: string,
    taskHint?: string
  ): Promise<{ useSpeculation: boolean; speculation?: SpeculativeContext }> {
    // Try to generate speculation
    this.currentSpeculation = await this.engine.speculate(localAgent, remoteAgent, taskHint);
    
    if (this.currentSpeculation) {
      return {
        useSpeculation: true,
        speculation: this.currentSpeculation
      };
    }
    
    return { useSpeculation: false };
  }

  /**
   * Get pre-loaded context if available, otherwise fetch normally
   */
  getContext(concept: string): unknown | undefined {
    if (!this.currentSpeculation) {
      return undefined;
    }
    
    const result = this.engine.checkSpeculation(this.currentSpeculation.id, concept);
    return result?.hit ? result.speculatedValue : undefined;
  }

  /**
   * Complete the handshake and record learning
   */
  finalize(requestedConcepts: string[], outcome: 'success' | 'failure', score: number): SpeculationAnalysis | null {
    if (!this.currentSpeculation) {
      return null;
    }
    
    const analysis = this.engine.finalizeSpeculation(
      this.currentSpeculation.id,
      requestedConcepts
    );
    
    this.currentSpeculation = null;
    return analysis;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createSpeculationEngine(
  contextFetcher: (concept: string) => Promise<unknown>,
  options?: SpeculationOptions
): ContextSpeculationEngine {
  return new ContextSpeculationEngine(contextFetcher, options);
}

/**
 * Philosophy:
 * 
 * "The best handshake is the one that already knows what you need.
 * Like a barista who starts your usual order when you walk in,
 * Context Speculation learns collaboration patterns and pre-loads
 * the mental model pieces most likely to be needed.
 * 
 * Wrong speculations cost a little.
 * Right speculations save a lot.
 * The math is expected value—bet on what history suggests."
 * 
 * — Gen 6, on learning to anticipate
 */
