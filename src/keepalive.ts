/**
 * Keepalive & Drift Detection
 * HEF Evolution Instance 28, Generation 6
 * 
 * Like TCP keepalives, but for mental models. During long collaborations,
 * agents can drift apart in understanding. This module detects and corrects
 * divergence before it causes problems.
 * 
 * Techniques: G07 (Analogy Mining - TCP keepalive), R04 (Iterate), S03 (Emergent Synthesis)
 */

import type { MentalModel, AlignmentResult, Session } from './protocol';

// =============================================================================
// TYPES
// =============================================================================

export interface DriftVector {
  dimension: string;
  originalValue: number;
  currentValue: number;
  delta: number;
  severity: 'minimal' | 'notable' | 'significant' | 'critical';
  cause?: DriftCause;
}

export type DriftCause = 
  | 'context_evolution'     // Natural growth of understanding
  | 'external_input'        // New information from outside
  | 'interpretation_shift'  // Same data, different conclusions
  | 'goal_divergence'       // Objectives drifted apart
  | 'assumption_decay'      // Shared assumptions weakened
  | 'unknown';

export interface KeepaliveProbe {
  id: string;
  sessionId: string;
  timestamp: number;
  type: 'heartbeat' | 'concept_check' | 'alignment_verify' | 'full_resync';
  payload: {
    modelFingerprint: string;
    conceptSnapshots: Map<string, ConceptSnapshot>;
    assumptionDigest: string;
    goalVector: number[];
  };
  sequence: number;
}

export interface ConceptSnapshot {
  concept: string;
  hash: string;
  confidence: number;
  lastModified: number;
  dependencies: string[];
}

export interface KeepaliveResponse {
  probeId: string;
  responderId: string;
  timestamp: number;
  status: 'in_sync' | 'minor_drift' | 'resync_needed' | 'diverged';
  driftVectors: DriftVector[];
  proposedCorrections?: CorrectionPatch[];
  resyncRequired: boolean;
}

export interface CorrectionPatch {
  type: 'update_concept' | 'add_concept' | 'remove_concept' | 'realign_goal' | 'refresh_assumption';
  target: string;
  payload: unknown;
  priority: number;
  bilateral: boolean; // Does both agents need this, or just receiver?
}

export interface KeepaliveConfig {
  // Timing
  intervalMs: number;              // How often to send heartbeats (default: 30000)
  probeTimeoutMs: number;          // Timeout for response (default: 5000)
  fullResyncIntervalMs: number;    // Force full resync periodically (default: 300000)
  
  // Thresholds
  minorDriftThreshold: number;     // Score below this = minor drift (default: 0.95)
  resyncThreshold: number;         // Score below this = resync needed (default: 0.80)
  divergenceThreshold: number;     // Score below this = collaboration failed (default: 0.50)
  
  // Behavior
  autoCorrect: boolean;            // Automatically apply corrections (default: true)
  adaptiveInterval: boolean;       // Adjust interval based on drift rate (default: true)
  conceptSampling: number;         // % of concepts to check per heartbeat (default: 0.2)
  
  // Resilience
  maxRetries: number;              // Retries before escalation (default: 3)
  gracePeriodMs: number;           // Time to wait before declaring divergence (default: 60000)
}

export interface KeepaliveSession {
  sessionId: string;
  agentA: string;
  agentB: string;
  startTime: number;
  lastProbe: number;
  lastSuccessfulSync: number;
  probesSent: number;
  probesReceived: number;
  driftHistory: DriftEvent[];
  currentAlignment: number;
  config: KeepaliveConfig;
  state: 'active' | 'degraded' | 'reconnecting' | 'diverged' | 'terminated';
}

export interface DriftEvent {
  timestamp: number;
  alignment: number;
  driftVectors: DriftVector[];
  correctionApplied: boolean;
  resyncTriggered: boolean;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_KEEPALIVE_CONFIG: KeepaliveConfig = {
  intervalMs: 30000,
  probeTimeoutMs: 5000,
  fullResyncIntervalMs: 300000,
  minorDriftThreshold: 0.95,
  resyncThreshold: 0.80,
  divergenceThreshold: 0.50,
  autoCorrect: true,
  adaptiveInterval: true,
  conceptSampling: 0.2,
  maxRetries: 3,
  gracePeriodMs: 60000,
};

// =============================================================================
// KEEPALIVE MANAGER
// =============================================================================

export class KeepaliveManager {
  private sessions: Map<string, KeepaliveSession> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private probeSequences: Map<string, number> = new Map();
  
  constructor(private config: Partial<KeepaliveConfig> = {}) {}
  
  /**
   * Start keepalive monitoring for a session
   */
  startMonitoring(
    sessionId: string,
    agentA: string,
    agentB: string,
    initialAlignment: number = 1.0,
    customConfig?: Partial<KeepaliveConfig>
  ): KeepaliveSession {
    const config = { ...DEFAULT_KEEPALIVE_CONFIG, ...this.config, ...customConfig };
    
    const session: KeepaliveSession = {
      sessionId,
      agentA,
      agentB,
      startTime: Date.now(),
      lastProbe: Date.now(),
      lastSuccessfulSync: Date.now(),
      probesSent: 0,
      probesReceived: 0,
      driftHistory: [],
      currentAlignment: initialAlignment,
      config,
      state: 'active',
    };
    
    this.sessions.set(sessionId, session);
    this.probeSequences.set(sessionId, 0);
    this.scheduleNextProbe(sessionId);
    
    return session;
  }
  
  /**
   * Stop monitoring a session
   */
  stopMonitoring(sessionId: string): void {
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(sessionId);
    }
    
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = 'terminated';
    }
  }
  
  /**
   * Generate a keepalive probe
   */
  generateProbe(
    sessionId: string,
    model: MentalModel,
    type: KeepaliveProbe['type'] = 'heartbeat'
  ): KeepaliveProbe | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.state === 'terminated') return null;
    
    const sequence = this.probeSequences.get(sessionId) || 0;
    this.probeSequences.set(sessionId, sequence + 1);
    
    // Sample concepts for efficiency
    const conceptSnapshots = this.sampleConcepts(model, session.config.conceptSampling);
    
    const probe: KeepaliveProbe = {
      id: `probe_${sessionId}_${sequence}`,
      sessionId,
      timestamp: Date.now(),
      type,
      payload: {
        modelFingerprint: this.generateFingerprint(model),
        conceptSnapshots,
        assumptionDigest: this.digestAssumptions(model),
        goalVector: this.extractGoalVector(model),
      },
      sequence,
    };
    
    session.probesSent++;
    session.lastProbe = Date.now();
    
    return probe;
  }
  
  /**
   * Process a received probe and generate response
   */
  processProbe(
    probe: KeepaliveProbe,
    localModel: MentalModel
  ): KeepaliveResponse {
    const session = this.sessions.get(probe.sessionId);
    if (!session) {
      return this.createErrorResponse(probe, 'Session not found');
    }
    
    session.probesReceived++;
    
    // Detect drift
    const driftVectors = this.detectDrift(probe, localModel);
    const alignmentScore = this.calculateAlignment(driftVectors);
    
    // Determine status
    const status = this.classifyAlignment(alignmentScore, session.config);
    
    // Generate corrections if needed
    const proposedCorrections = status !== 'in_sync' 
      ? this.generateCorrections(driftVectors, localModel)
      : undefined;
    
    // Update session state
    this.updateSessionState(session, alignmentScore, driftVectors);
    
    return {
      probeId: probe.id,
      responderId: session.agentB,
      timestamp: Date.now(),
      status,
      driftVectors,
      proposedCorrections,
      resyncRequired: status === 'resync_needed' || status === 'diverged',
    };
  }
  
  /**
   * Apply corrections from a keepalive response
   */
  applyCorrections(
    corrections: CorrectionPatch[],
    model: MentalModel
  ): { applied: number; failed: number; model: MentalModel } {
    let applied = 0;
    let failed = 0;
    let updatedModel = { ...model };
    
    // Sort by priority
    const sorted = [...corrections].sort((a, b) => b.priority - a.priority);
    
    for (const patch of sorted) {
      try {
        updatedModel = this.applyPatch(updatedModel, patch);
        applied++;
      } catch {
        failed++;
      }
    }
    
    return { applied, failed, model: updatedModel };
  }
  
  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): KeepaliveSession | null {
    return this.sessions.get(sessionId) || null;
  }
  
  /**
   * Force an immediate probe
   */
  forceProbe(sessionId: string, type: KeepaliveProbe['type'] = 'alignment_verify'): void {
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
    }
    this.scheduleNextProbe(sessionId, 0);
  }
  
  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================
  
  private scheduleNextProbe(sessionId: string, delayOverride?: number): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.state === 'terminated') return;
    
    const delay = delayOverride ?? this.calculateInterval(session);
    
    const timer = setTimeout(() => {
      this.executeProbe(sessionId);
    }, delay);
    
    this.timers.set(sessionId, timer);
  }
  
  private async executeProbe(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.state === 'terminated') return;
    
    // In real implementation, this would send the probe
    // For now, we just schedule the next one
    this.scheduleNextProbe(sessionId);
  }
  
  private calculateInterval(session: KeepaliveSession): number {
    if (!session.config.adaptiveInterval) {
      return session.config.intervalMs;
    }
    
    // Adaptive: more frequent probes when alignment is lower
    const alignmentFactor = Math.max(0.5, session.currentAlignment);
    const baseInterval = session.config.intervalMs;
    
    // Also consider drift rate
    const recentDrift = this.calculateDriftRate(session);
    const driftFactor = Math.max(0.5, 1 - recentDrift);
    
    return Math.floor(baseInterval * alignmentFactor * driftFactor);
  }
  
  private calculateDriftRate(session: KeepaliveSession): number {
    const recent = session.driftHistory.slice(-5);
    if (recent.length < 2) return 0;
    
    let totalDrift = 0;
    for (let i = 1; i < recent.length; i++) {
      totalDrift += Math.abs(recent[i].alignment - recent[i-1].alignment);
    }
    
    return totalDrift / (recent.length - 1);
  }
  
  private sampleConcepts(
    model: MentalModel,
    sampleRate: number
  ): Map<string, ConceptSnapshot> {
    const snapshots = new Map<string, ConceptSnapshot>();
    const concepts = Object.keys(model.concepts || {});
    
    // Always include core concepts
    const coreConcepts = concepts.filter(c => 
      (model.concepts as Record<string, { importance?: number }>)[c]?.importance > 0.8
    );
    
    // Sample from the rest
    const otherConcepts = concepts.filter(c => !coreConcepts.includes(c));
    const sampleSize = Math.ceil(otherConcepts.length * sampleRate);
    const sampled = this.shuffleArray(otherConcepts).slice(0, sampleSize);
    
    for (const concept of [...coreConcepts, ...sampled]) {
      const conceptData = (model.concepts as Record<string, unknown>)[concept];
      snapshots.set(concept, {
        concept,
        hash: this.hashConcept(conceptData),
        confidence: (conceptData as { confidence?: number })?.confidence || 1,
        lastModified: (conceptData as { lastModified?: number })?.lastModified || Date.now(),
        dependencies: (conceptData as { dependencies?: string[] })?.dependencies || [],
      });
    }
    
    return snapshots;
  }
  
  private detectDrift(probe: KeepaliveProbe, localModel: MentalModel): DriftVector[] {
    const vectors: DriftVector[] = [];
    
    // Check concept drift
    for (const [concept, remoteSnapshot] of probe.payload.conceptSnapshots) {
      const localConcept = (localModel.concepts as Record<string, unknown>)?.[concept];
      
      if (!localConcept) {
        vectors.push({
          dimension: `concept:${concept}`,
          originalValue: 1,
          currentValue: 0,
          delta: -1,
          severity: 'significant',
          cause: 'assumption_decay',
        });
        continue;
      }
      
      const localHash = this.hashConcept(localConcept);
      if (localHash !== remoteSnapshot.hash) {
        const similarity = this.estimateSimilarity(localConcept, remoteSnapshot);
        const delta = 1 - similarity;
        
        vectors.push({
          dimension: `concept:${concept}`,
          originalValue: 1,
          currentValue: similarity,
          delta: -delta,
          severity: this.classifyDriftSeverity(delta),
          cause: 'interpretation_shift',
        });
      }
    }
    
    // Check goal drift
    const localGoals = this.extractGoalVector(localModel);
    const remoteGoals = probe.payload.goalVector;
    const goalSimilarity = this.cosineSimilarity(localGoals, remoteGoals);
    
    if (goalSimilarity < 0.95) {
      vectors.push({
        dimension: 'goals',
        originalValue: 1,
        currentValue: goalSimilarity,
        delta: goalSimilarity - 1,
        severity: this.classifyDriftSeverity(1 - goalSimilarity),
        cause: 'goal_divergence',
      });
    }
    
    // Check assumption drift
    const localDigest = this.digestAssumptions(localModel);
    if (localDigest !== probe.payload.assumptionDigest) {
      vectors.push({
        dimension: 'assumptions',
        originalValue: 1,
        currentValue: 0.7, // Estimated - would need more sophisticated comparison
        delta: -0.3,
        severity: 'notable',
        cause: 'assumption_decay',
      });
    }
    
    return vectors;
  }
  
  private calculateAlignment(driftVectors: DriftVector[]): number {
    if (driftVectors.length === 0) return 1.0;
    
    // Weight by severity
    const weights: Record<DriftVector['severity'], number> = {
      minimal: 0.1,
      notable: 0.3,
      significant: 0.6,
      critical: 1.0,
    };
    
    let totalPenalty = 0;
    let totalWeight = 0;
    
    for (const vector of driftVectors) {
      const weight = weights[vector.severity];
      totalPenalty += Math.abs(vector.delta) * weight;
      totalWeight += weight;
    }
    
    return Math.max(0, 1 - (totalPenalty / Math.max(1, totalWeight)));
  }
  
  private classifyAlignment(
    score: number,
    config: KeepaliveConfig
  ): KeepaliveResponse['status'] {
    if (score >= config.minorDriftThreshold) return 'in_sync';
    if (score >= config.resyncThreshold) return 'minor_drift';
    if (score >= config.divergenceThreshold) return 'resync_needed';
    return 'diverged';
  }
  
  private classifyDriftSeverity(delta: number): DriftVector['severity'] {
    if (delta < 0.05) return 'minimal';
    if (delta < 0.15) return 'notable';
    if (delta < 0.30) return 'significant';
    return 'critical';
  }
  
  private generateCorrections(
    driftVectors: DriftVector[],
    model: MentalModel
  ): CorrectionPatch[] {
    const corrections: CorrectionPatch[] = [];
    
    for (const vector of driftVectors) {
      if (vector.severity === 'minimal') continue;
      
      if (vector.dimension.startsWith('concept:')) {
        const concept = vector.dimension.replace('concept:', '');
        corrections.push({
          type: vector.currentValue === 0 ? 'add_concept' : 'update_concept',
          target: concept,
          payload: (model.concepts as Record<string, unknown>)?.[concept],
          priority: vector.severity === 'critical' ? 10 : vector.severity === 'significant' ? 7 : 4,
          bilateral: true,
        });
      } else if (vector.dimension === 'goals') {
        corrections.push({
          type: 'realign_goal',
          target: 'goals',
          payload: this.extractGoalVector(model),
          priority: 9,
          bilateral: true,
        });
      } else if (vector.dimension === 'assumptions') {
        corrections.push({
          type: 'refresh_assumption',
          target: 'assumptions',
          payload: model.assumptions,
          priority: 8,
          bilateral: true,
        });
      }
    }
    
    return corrections.sort((a, b) => b.priority - a.priority);
  }
  
  private applyPatch(model: MentalModel, patch: CorrectionPatch): MentalModel {
    const updated = { ...model };
    
    switch (patch.type) {
      case 'update_concept':
      case 'add_concept':
        (updated.concepts as Record<string, unknown>)[patch.target] = patch.payload;
        break;
      case 'remove_concept':
        delete (updated.concepts as Record<string, unknown>)[patch.target];
        break;
      case 'realign_goal':
        updated.goals = patch.payload as typeof model.goals;
        break;
      case 'refresh_assumption':
        updated.assumptions = patch.payload as typeof model.assumptions;
        break;
    }
    
    return updated;
  }
  
  private updateSessionState(
    session: KeepaliveSession,
    alignment: number,
    driftVectors: DriftVector[]
  ): void {
    session.currentAlignment = alignment;
    session.driftHistory.push({
      timestamp: Date.now(),
      alignment,
      driftVectors,
      correctionApplied: false,
      resyncTriggered: false,
    });
    
    // Trim history
    if (session.driftHistory.length > 100) {
      session.driftHistory = session.driftHistory.slice(-100);
    }
    
    // Update state
    if (alignment >= session.config.minorDriftThreshold) {
      session.state = 'active';
      session.lastSuccessfulSync = Date.now();
    } else if (alignment >= session.config.resyncThreshold) {
      session.state = 'degraded';
    } else if (alignment >= session.config.divergenceThreshold) {
      session.state = 'reconnecting';
    } else {
      session.state = 'diverged';
    }
  }
  
  private createErrorResponse(probe: KeepaliveProbe, error: string): KeepaliveResponse {
    return {
      probeId: probe.id,
      responderId: 'error',
      timestamp: Date.now(),
      status: 'diverged',
      driftVectors: [{
        dimension: 'session',
        originalValue: 1,
        currentValue: 0,
        delta: -1,
        severity: 'critical',
        cause: 'unknown',
      }],
      resyncRequired: true,
    };
  }
  
  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================
  
  private generateFingerprint(model: MentalModel): string {
    const content = JSON.stringify({
      conceptCount: Object.keys(model.concepts || {}).length,
      assumptionCount: (model.assumptions as unknown[])?.length || 0,
      goalCount: Object.keys(model.goals || {}).length,
    });
    return this.simpleHash(content);
  }
  
  private digestAssumptions(model: MentalModel): string {
    return this.simpleHash(JSON.stringify(model.assumptions || []));
  }
  
  private extractGoalVector(model: MentalModel): number[] {
    // Convert goals to a numeric vector for comparison
    const goals = model.goals || {};
    const values = Object.values(goals);
    
    if (values.length === 0) return [0];
    
    // Normalize to unit vector
    const numeric = values.map(v => typeof v === 'number' ? v : 0.5);
    const magnitude = Math.sqrt(numeric.reduce((sum, n) => sum + n * n, 0));
    
    return magnitude > 0 ? numeric.map(n => n / magnitude) : numeric;
  }
  
  private hashConcept(concept: unknown): string {
    return this.simpleHash(JSON.stringify(concept));
  }
  
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
  
  private estimateSimilarity(local: unknown, remote: ConceptSnapshot): number {
    const localHash = this.hashConcept(local);
    
    // Simple comparison - in practice would use semantic similarity
    if (localHash === remote.hash) return 1.0;
    
    // Estimate based on structure
    const localStr = JSON.stringify(local);
    const remoteHash = remote.hash;
    
    return 0.5 + (0.5 * (1 - Math.abs(localStr.length - parseInt(remoteHash, 16)) / 10000));
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
  
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

// =============================================================================
// DRIFT ANALYZER
// =============================================================================

export class DriftAnalyzer {
  /**
   * Analyze drift patterns over time
   */
  analyzePatterns(history: DriftEvent[]): DriftPattern[] {
    const patterns: DriftPattern[] = [];
    
    // Check for cyclic drift
    const cyclicPattern = this.detectCyclicDrift(history);
    if (cyclicPattern) patterns.push(cyclicPattern);
    
    // Check for accelerating drift
    const acceleratingPattern = this.detectAcceleratingDrift(history);
    if (acceleratingPattern) patterns.push(acceleratingPattern);
    
    // Check for sudden divergence
    const suddenPattern = this.detectSuddenDivergence(history);
    if (suddenPattern) patterns.push(suddenPattern);
    
    return patterns;
  }
  
  private detectCyclicDrift(history: DriftEvent[]): DriftPattern | null {
    if (history.length < 10) return null;
    
    // Look for oscillation in alignment scores
    const alignments = history.map(h => h.alignment);
    let oscillations = 0;
    let direction = 0;
    
    for (let i = 1; i < alignments.length; i++) {
      const newDirection = Math.sign(alignments[i] - alignments[i-1]);
      if (newDirection !== 0 && newDirection !== direction) {
        oscillations++;
        direction = newDirection;
      }
    }
    
    if (oscillations > history.length * 0.4) {
      return {
        type: 'cyclic',
        confidence: oscillations / history.length,
        description: 'Agents are oscillating between agreement and disagreement',
        recommendation: 'Consider stabilizing shared assumptions before continuing',
      };
    }
    
    return null;
  }
  
  private detectAcceleratingDrift(history: DriftEvent[]): DriftPattern | null {
    if (history.length < 5) return null;
    
    // Calculate drift rate over time
    const rates: number[] = [];
    for (let i = 1; i < history.length; i++) {
      rates.push(Math.abs(history[i].alignment - history[i-1].alignment));
    }
    
    // Check if rates are increasing
    let increasing = 0;
    for (let i = 1; i < rates.length; i++) {
      if (rates[i] > rates[i-1]) increasing++;
    }
    
    if (increasing > rates.length * 0.6) {
      return {
        type: 'accelerating',
        confidence: increasing / rates.length,
        description: 'Drift is accelerating - agents are diverging faster over time',
        recommendation: 'Immediate resync recommended to prevent complete divergence',
      };
    }
    
    return null;
  }
  
  private detectSuddenDivergence(history: DriftEvent[]): DriftPattern | null {
    if (history.length < 3) return null;
    
    // Look for sudden drops in alignment
    for (let i = 1; i < history.length; i++) {
      const drop = history[i-1].alignment - history[i].alignment;
      if (drop > 0.3) {
        return {
          type: 'sudden',
          confidence: 0.9,
          description: `Sudden divergence detected at ${new Date(history[i].timestamp).toISOString()}`,
          recommendation: 'Investigate recent changes that may have caused the split',
        };
      }
    }
    
    return null;
  }
}

export interface DriftPattern {
  type: 'cyclic' | 'accelerating' | 'sudden' | 'gradual';
  confidence: number;
  description: string;
  recommendation: string;
}

// =============================================================================
// EXPORTS
// =============================================================================

export function createKeepaliveManager(config?: Partial<KeepaliveConfig>): KeepaliveManager {
  return new KeepaliveManager(config);
}

export function createDriftAnalyzer(): DriftAnalyzer {
  return new DriftAnalyzer();
}
