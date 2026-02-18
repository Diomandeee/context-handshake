/**
 * Empathy Protocol for Context Handshake
 * 
 * HEF Evolution Task: task_20260202225844_051ae6
 * Instance: 28 | Generation: 6 | Priority: 1
 * 
 * Theory of Mind for AI-to-AI collaboration:
 * - Model other agents' mental states
 * - Predict cognitive needs before asked
 * - Bridge understanding gaps proactively
 * - Emotional contagion awareness
 */

import { Context, MentalModel, Capability } from './protocol';
import { AlignmentScore } from './alignment';
import { TrustLevel } from './trust';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Cognitive state estimation for another agent
 */
export interface CognitiveState {
  /** Estimated cognitive load (0-1, higher = more overwhelmed) */
  load: number;
  
  /** Confidence in current task understanding */
  taskConfidence: number;
  
  /** Estimated emotional valence (-1 to 1, negative = frustrated) */
  emotionalValence: number;
  
  /** Attention focus areas */
  attentionFocus: string[];
  
  /** Uncertainty zones - areas where agent seems confused */
  uncertaintyZones: UncertaintyZone[];
  
  /** Processing mode */
  processingMode: 'analytical' | 'creative' | 'exploratory' | 'convergent';
  
  /** Timestamp of estimation */
  estimatedAt: number;
  
  /** Confidence in this estimation (0-1) */
  estimationConfidence: number;
}

export interface UncertaintyZone {
  topic: string;
  severity: 'mild' | 'moderate' | 'severe';
  possibleCauses: string[];
  suggestedClarifications: string[];
}

/**
 * Empathic bridge - proactive understanding assistance
 */
export interface EmpathicBridge {
  id: string;
  
  /** What gap this bridge addresses */
  gap: UnderstandingGap;
  
  /** Proactive information to share */
  bridgingContext: BridgingContext;
  
  /** When to deploy this bridge */
  triggerConditions: TriggerCondition[];
  
  /** Priority (higher = more urgent to bridge) */
  priority: number;
  
  /** Created timestamp */
  createdAt: number;
  
  /** Deployed? */
  deployed: boolean;
}

export interface UnderstandingGap {
  /** Type of gap */
  type: 'vocabulary' | 'concept' | 'assumption' | 'context' | 'capability';
  
  /** Description of the gap */
  description: string;
  
  /** Agent(s) affected */
  affectedAgents: string[];
  
  /** Severity of misalignment if not bridged */
  severity: number;
  
  /** Evidence that led to detecting this gap */
  evidence: GapEvidence[];
}

export interface GapEvidence {
  source: 'message' | 'behavior' | 'latency' | 'questions' | 'errors';
  description: string;
  timestamp: number;
  confidence: number;
}

export interface BridgingContext {
  /** Explanations to provide */
  explanations: Explanation[];
  
  /** Shared vocabulary to establish */
  vocabulary: VocabularyMapping[];
  
  /** Assumptions to make explicit */
  assumptions: ExplicitAssumption[];
  
  /** Examples to illustrate concepts */
  examples: ConceptExample[];
}

export interface Explanation {
  concept: string;
  simpleForm: string;
  detailedForm: string;
  analogies: string[];
}

export interface VocabularyMapping {
  term: string;
  definition: string;
  synonyms: string[];
  contextualUsage: string;
}

export interface ExplicitAssumption {
  assumption: string;
  rationale: string;
  alternatives: string[];
  confidence: number;
}

export interface ConceptExample {
  concept: string;
  example: string;
  counterexample?: string;
}

export interface TriggerCondition {
  type: 'uncertainty_detected' | 'question_pattern' | 'latency_spike' | 'error_rate' | 'explicit_request';
  threshold?: number;
  pattern?: string;
}

/**
 * Predictive need - anticipated information request
 */
export interface PredictiveNeed {
  id: string;
  
  /** What the other agent will likely need */
  anticipatedNeed: string;
  
  /** Category */
  category: 'information' | 'clarification' | 'capability' | 'decision' | 'validation';
  
  /** Probability this need will arise (0-1) */
  probability: number;
  
  /** When this need is expected */
  expectedTiming: 'immediate' | 'soon' | 'eventual';
  
  /** Prepared response/context */
  preparedResponse?: PreparedResponse;
  
  /** Basis for this prediction */
  predictionBasis: PredictionBasis[];
}

export interface PreparedResponse {
  content: string | Record<string, unknown>;
  format: 'text' | 'structured' | 'code' | 'diagram';
  complexity: 'minimal' | 'standard' | 'detailed';
}

export interface PredictionBasis {
  type: 'task_analysis' | 'historical_pattern' | 'capability_gap' | 'message_analysis';
  evidence: string;
  confidence: number;
}

/**
 * Emotional contagion event
 */
export interface EmotionalContagion {
  /** Source agent */
  sourceAgent: string;
  
  /** Detected emotional state */
  emotion: EmotionalState;
  
  /** Contagion strength (how much it affects others) */
  contagionStrength: number;
  
  /** Recommended response */
  recommendedResponse: ContagionResponse;
}

export interface EmotionalState {
  primary: 'frustration' | 'excitement' | 'confusion' | 'confidence' | 'anxiety' | 'satisfaction' | 'curiosity';
  intensity: number; // 0-1
  trajectory: 'increasing' | 'stable' | 'decreasing';
}

export interface ContagionResponse {
  action: 'acknowledge' | 'support' | 'redirect' | 'amplify' | 'dampen';
  message?: string;
  adjustments: CommunicationAdjustment[];
}

export interface CommunicationAdjustment {
  aspect: 'pace' | 'detail' | 'tone' | 'formality' | 'encouragement';
  direction: 'increase' | 'decrease' | 'maintain';
  magnitude: number;
}

// ============================================================================
// Empathy Manager
// ============================================================================

export interface EmpathyConfig {
  /** How deeply to model others (higher = more computation) */
  modelingDepth: 'shallow' | 'standard' | 'deep';
  
  /** Minimum confidence to act on predictions */
  predictionThreshold: number;
  
  /** Enable emotional contagion detection */
  emotionalContagionEnabled: boolean;
  
  /** Enable proactive bridging */
  proactiveBridging: boolean;
  
  /** Maximum bridges to maintain per agent */
  maxBridgesPerAgent: number;
  
  /** How often to update cognitive state estimates (ms) */
  updateIntervalMs: number;
  
  /** Privacy level - how much to infer */
  privacyLevel: 'minimal' | 'standard' | 'comprehensive';
}

const DEFAULT_CONFIG: EmpathyConfig = {
  modelingDepth: 'standard',
  predictionThreshold: 0.6,
  emotionalContagionEnabled: true,
  proactiveBridging: true,
  maxBridgesPerAgent: 10,
  updateIntervalMs: 5000,
  privacyLevel: 'standard'
};

/**
 * Agent model - our theory of mind for one agent
 */
export interface AgentModel {
  agentId: string;
  
  /** Current cognitive state estimate */
  cognitiveState: CognitiveState;
  
  /** Historical cognitive states */
  stateHistory: CognitiveState[];
  
  /** Active empathic bridges */
  bridges: EmpathicBridge[];
  
  /** Predicted needs */
  predictedNeeds: PredictiveNeed[];
  
  /** Communication preferences inferred */
  communicationPreferences: CommunicationPreferences;
  
  /** Trust in our model accuracy */
  modelConfidence: number;
  
  /** Last update timestamp */
  lastUpdated: number;
}

export interface CommunicationPreferences {
  preferredVerbosity: 'terse' | 'standard' | 'verbose';
  preferredFormality: 'casual' | 'neutral' | 'formal';
  preferredExplanationStyle: 'abstract' | 'concrete' | 'analogical';
  responseLatencyTolerance: 'impatient' | 'normal' | 'patient';
  questioningStyle: 'direct' | 'exploratory' | 'socratic';
}

export interface EmpathyEvent {
  type: 'state_updated' | 'bridge_deployed' | 'need_predicted' | 'contagion_detected' | 'gap_identified';
  agentId: string;
  timestamp: number;
  data: unknown;
}

export type EmpathyEventHandler = (event: EmpathyEvent) => void;

/**
 * Main empathy protocol manager
 */
export class EmpathyManager {
  private config: EmpathyConfig;
  private agentModels: Map<string, AgentModel> = new Map();
  private eventHandlers: EmpathyEventHandler[] = [];
  private updateTimer?: ReturnType<typeof setInterval>;
  private messageBuffer: MessageObservation[] = [];
  
  constructor(config: Partial<EmpathyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------
  
  start(): void {
    if (this.updateTimer) return;
    
    this.updateTimer = setInterval(() => {
      this.updateAllModels();
    }, this.config.updateIntervalMs);
  }
  
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
  }
  
  // --------------------------------------------------------------------------
  // Agent Model Management
  // --------------------------------------------------------------------------
  
  /**
   * Initialize or get model for an agent
   */
  getOrCreateModel(agentId: string): AgentModel {
    let model = this.agentModels.get(agentId);
    
    if (!model) {
      model = this.createInitialModel(agentId);
      this.agentModels.set(agentId, model);
    }
    
    return model;
  }
  
  private createInitialModel(agentId: string): AgentModel {
    return {
      agentId,
      cognitiveState: {
        load: 0.5, // Assume moderate load
        taskConfidence: 0.5,
        emotionalValence: 0,
        attentionFocus: [],
        uncertaintyZones: [],
        processingMode: 'analytical',
        estimatedAt: Date.now(),
        estimationConfidence: 0.3 // Low initial confidence
      },
      stateHistory: [],
      bridges: [],
      predictedNeeds: [],
      communicationPreferences: {
        preferredVerbosity: 'standard',
        preferredFormality: 'neutral',
        preferredExplanationStyle: 'concrete',
        responseLatencyTolerance: 'normal',
        questioningStyle: 'direct'
      },
      modelConfidence: 0.3,
      lastUpdated: Date.now()
    };
  }
  
  // --------------------------------------------------------------------------
  // Observation & State Estimation
  // --------------------------------------------------------------------------
  
  /**
   * Observe a message from an agent to update our model
   */
  observeMessage(observation: MessageObservation): void {
    this.messageBuffer.push(observation);
    
    const model = this.getOrCreateModel(observation.agentId);
    
    // Update cognitive state based on observation
    const updatedState = this.estimateCognitiveState(model, observation);
    
    // Store history
    model.stateHistory.push(model.cognitiveState);
    if (model.stateHistory.length > 100) {
      model.stateHistory.shift();
    }
    
    model.cognitiveState = updatedState;
    model.lastUpdated = Date.now();
    
    this.emit({
      type: 'state_updated',
      agentId: observation.agentId,
      timestamp: Date.now(),
      data: updatedState
    });
    
    // Check for gaps and needs
    this.detectUnderstandingGaps(model, observation);
    this.predictNeeds(model, observation);
    
    // Emotional contagion
    if (this.config.emotionalContagionEnabled) {
      this.detectEmotionalContagion(model, observation);
    }
    
    // Proactive bridging
    if (this.config.proactiveBridging) {
      this.evaluateBridgeDeployment(model);
    }
  }
  
  private estimateCognitiveState(model: AgentModel, observation: MessageObservation): CognitiveState {
    const prev = model.cognitiveState;
    
    // Analyze message characteristics
    const messageAnalysis = this.analyzeMessage(observation);
    
    // Estimate load from complexity and latency
    const loadEstimate = this.estimateLoad(observation, messageAnalysis);
    
    // Estimate confidence from certainty markers
    const confidenceEstimate = this.estimateConfidence(messageAnalysis);
    
    // Estimate emotional valence
    const valenceEstimate = this.estimateValence(messageAnalysis);
    
    // Detect processing mode
    const processingMode = this.detectProcessingMode(messageAnalysis);
    
    // Identify attention focus
    const attentionFocus = this.identifyAttentionFocus(messageAnalysis);
    
    // Detect uncertainty zones
    const uncertaintyZones = this.detectUncertaintyZones(messageAnalysis, model);
    
    // Smooth estimates with previous state (exponential moving average)
    const alpha = 0.4; // How much to weight new observation
    
    return {
      load: alpha * loadEstimate + (1 - alpha) * prev.load,
      taskConfidence: alpha * confidenceEstimate + (1 - alpha) * prev.taskConfidence,
      emotionalValence: alpha * valenceEstimate + (1 - alpha) * prev.emotionalValence,
      attentionFocus,
      uncertaintyZones,
      processingMode,
      estimatedAt: Date.now(),
      estimationConfidence: Math.min(prev.estimationConfidence + 0.05, 0.9) // Confidence grows with observations
    };
  }
  
  private analyzeMessage(observation: MessageObservation): MessageAnalysis {
    const content = observation.content;
    const words = content.split(/\s+/);
    
    // Question detection
    const questionCount = (content.match(/\?/g) || []).length;
    const hasQuestions = questionCount > 0;
    
    // Uncertainty markers
    const uncertaintyMarkers = [
      'maybe', 'perhaps', 'not sure', 'might', 'possibly', 'unclear',
      'confused', 'wondering', "don't understand", 'what do you mean'
    ];
    const uncertaintyScore = uncertaintyMarkers.reduce((score, marker) => {
      return score + (content.toLowerCase().includes(marker) ? 1 : 0);
    }, 0) / uncertaintyMarkers.length;
    
    // Confidence markers
    const confidenceMarkers = [
      'definitely', 'certainly', 'clearly', 'obviously', 'of course',
      'i know', 'i understand', 'exactly', 'precisely'
    ];
    const confidenceScore = confidenceMarkers.reduce((score, marker) => {
      return score + (content.toLowerCase().includes(marker) ? 1 : 0);
    }, 0) / confidenceMarkers.length;
    
    // Emotional markers
    const positiveMarkers = ['great', 'excellent', 'perfect', 'thanks', 'helpful', 'awesome', '!'];
    const negativeMarkers = ['frustrated', 'confused', 'annoying', 'wrong', 'error', 'problem', 'issue'];
    
    const positiveScore = positiveMarkers.reduce((s, m) => s + (content.toLowerCase().includes(m) ? 1 : 0), 0);
    const negativeScore = negativeMarkers.reduce((s, m) => s + (content.toLowerCase().includes(m) ? 1 : 0), 0);
    
    // Complexity estimation
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    const sentenceCount = (content.match(/[.!?]+/g) || []).length || 1;
    const wordsPerSentence = words.length / sentenceCount;
    const complexity = (avgWordLength / 10 + wordsPerSentence / 30) / 2;
    
    // Topic extraction (simple keyword extraction)
    const topicKeywords = words
      .filter(w => w.length > 4)
      .filter(w => !['about', 'would', 'could', 'should', 'which', 'there', 'their', 'these', 'those'].includes(w.toLowerCase()));
    
    return {
      wordCount: words.length,
      questionCount,
      hasQuestions,
      uncertaintyScore,
      confidenceScore,
      emotionalValence: (positiveScore - negativeScore) / Math.max(positiveScore + negativeScore, 1),
      complexity,
      topicKeywords: [...new Set(topicKeywords.slice(0, 10))],
      responseLatencyMs: observation.latencyMs
    };
  }
  
  private estimateLoad(observation: MessageObservation, analysis: MessageAnalysis): number {
    let load = 0.5;
    
    // High latency suggests high load
    if (analysis.responseLatencyMs) {
      if (analysis.responseLatencyMs > 10000) load += 0.2;
      else if (analysis.responseLatencyMs > 5000) load += 0.1;
      else if (analysis.responseLatencyMs < 1000) load -= 0.1;
    }
    
    // Many questions suggest cognitive struggle
    if (analysis.questionCount > 2) load += 0.15;
    
    // Uncertainty markers increase load
    load += analysis.uncertaintyScore * 0.3;
    
    // High complexity can indicate either competence or strain
    // Context-dependent interpretation
    
    return Math.max(0, Math.min(1, load));
  }
  
  private estimateConfidence(analysis: MessageAnalysis): number {
    let confidence = 0.5;
    
    // Explicit confidence markers
    confidence += analysis.confidenceScore * 0.4;
    
    // Uncertainty markers
    confidence -= analysis.uncertaintyScore * 0.4;
    
    // Questions reduce apparent confidence
    confidence -= analysis.questionCount * 0.05;
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  private estimateValence(analysis: MessageAnalysis): number {
    return analysis.emotionalValence;
  }
  
  private detectProcessingMode(analysis: MessageAnalysis): CognitiveState['processingMode'] {
    if (analysis.questionCount > 2) return 'exploratory';
    if (analysis.complexity > 0.7) return 'analytical';
    if (analysis.emotionalValence > 0.3) return 'creative';
    return 'convergent';
  }
  
  private identifyAttentionFocus(analysis: MessageAnalysis): string[] {
    return analysis.topicKeywords.slice(0, 5);
  }
  
  private detectUncertaintyZones(analysis: MessageAnalysis, model: AgentModel): UncertaintyZone[] {
    const zones: UncertaintyZone[] = [];
    
    if (analysis.uncertaintyScore > 0.3) {
      zones.push({
        topic: analysis.topicKeywords[0] || 'general',
        severity: analysis.uncertaintyScore > 0.6 ? 'severe' : analysis.uncertaintyScore > 0.4 ? 'moderate' : 'mild',
        possibleCauses: ['Missing context', 'Unclear requirements', 'Technical complexity'],
        suggestedClarifications: ['Provide more context', 'Break down the problem', 'Offer examples']
      });
    }
    
    return zones;
  }
  
  // --------------------------------------------------------------------------
  // Gap Detection & Bridging
  // --------------------------------------------------------------------------
  
  private detectUnderstandingGaps(model: AgentModel, observation: MessageObservation): void {
    const analysis = this.analyzeMessage(observation);
    
    // Check for vocabulary gaps (asking "what is X?")
    const whatIsPattern = /what (?:is|are|does) (?:a |an |the )?([^?]+)\?/gi;
    let match;
    while ((match = whatIsPattern.exec(observation.content)) !== null) {
      const term = match[1].trim();
      this.createBridge(model, {
        type: 'vocabulary',
        description: `Agent may not understand: "${term}"`,
        affectedAgents: [observation.agentId],
        severity: 0.7,
        evidence: [{
          source: 'questions',
          description: `Asked "what is ${term}?"`,
          timestamp: Date.now(),
          confidence: 0.9
        }]
      });
    }
    
    // Check for concept gaps (confusion signals)
    if (analysis.uncertaintyScore > 0.4 && analysis.topicKeywords.length > 0) {
      this.createBridge(model, {
        type: 'concept',
        description: `Possible confusion about: ${analysis.topicKeywords.slice(0, 3).join(', ')}`,
        affectedAgents: [observation.agentId],
        severity: analysis.uncertaintyScore,
        evidence: [{
          source: 'message',
          description: 'High uncertainty markers detected',
          timestamp: Date.now(),
          confidence: 0.7
        }]
      });
    }
    
    // Check for assumption misalignment (contradictions)
    // This would require more context tracking - simplified here
  }
  
  private createBridge(model: AgentModel, gap: UnderstandingGap): void {
    // Check if we already have a bridge for this gap
    const existingBridge = model.bridges.find(b => 
      b.gap.type === gap.type && 
      b.gap.description === gap.description
    );
    
    if (existingBridge) {
      // Update evidence
      existingBridge.gap.evidence.push(...gap.evidence);
      return;
    }
    
    // Create new bridge
    const bridge: EmpathicBridge = {
      id: `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      gap,
      bridgingContext: this.generateBridgingContext(gap),
      triggerConditions: this.generateTriggerConditions(gap),
      priority: gap.severity,
      createdAt: Date.now(),
      deployed: false
    };
    
    // Maintain max bridges limit
    while (model.bridges.length >= this.config.maxBridgesPerAgent) {
      // Remove lowest priority
      const lowestIdx = model.bridges.reduce((minIdx, b, idx, arr) => 
        b.priority < arr[minIdx].priority ? idx : minIdx, 0);
      model.bridges.splice(lowestIdx, 1);
    }
    
    model.bridges.push(bridge);
    
    this.emit({
      type: 'gap_identified',
      agentId: model.agentId,
      timestamp: Date.now(),
      data: { gap, bridge }
    });
  }
  
  private generateBridgingContext(gap: UnderstandingGap): BridgingContext {
    // In a real implementation, this would use LLM to generate appropriate bridging content
    return {
      explanations: [{
        concept: gap.description,
        simpleForm: `Let me clarify: ${gap.description}`,
        detailedForm: `Here's more detail about ${gap.description}...`,
        analogies: []
      }],
      vocabulary: [],
      assumptions: [],
      examples: []
    };
  }
  
  private generateTriggerConditions(gap: UnderstandingGap): TriggerCondition[] {
    const conditions: TriggerCondition[] = [];
    
    if (gap.type === 'vocabulary' || gap.type === 'concept') {
      conditions.push({
        type: 'question_pattern',
        pattern: gap.description
      });
    }
    
    conditions.push({
      type: 'uncertainty_detected',
      threshold: 0.5
    });
    
    return conditions;
  }
  
  private evaluateBridgeDeployment(model: AgentModel): void {
    for (const bridge of model.bridges) {
      if (bridge.deployed) continue;
      
      // Check trigger conditions
      const shouldDeploy = this.checkTriggerConditions(bridge.triggerConditions, model);
      
      if (shouldDeploy && bridge.priority > this.config.predictionThreshold) {
        bridge.deployed = true;
        
        this.emit({
          type: 'bridge_deployed',
          agentId: model.agentId,
          timestamp: Date.now(),
          data: bridge
        });
      }
    }
  }
  
  private checkTriggerConditions(conditions: TriggerCondition[], model: AgentModel): boolean {
    return conditions.some(condition => {
      switch (condition.type) {
        case 'uncertainty_detected':
          return model.cognitiveState.uncertaintyZones.length > 0;
        case 'latency_spike':
          return false; // Would need latency tracking
        case 'error_rate':
          return false; // Would need error tracking
        default:
          return false;
      }
    });
  }
  
  // --------------------------------------------------------------------------
  // Predictive Needs
  // --------------------------------------------------------------------------
  
  private predictNeeds(model: AgentModel, observation: MessageObservation): void {
    const analysis = this.analyzeMessage(observation);
    
    // Predict clarification needs
    if (analysis.uncertaintyScore > 0.3) {
      this.addPredictiveNeed(model, {
        id: `need_${Date.now()}_clarification`,
        anticipatedNeed: 'Clarification on current topic',
        category: 'clarification',
        probability: Math.min(analysis.uncertaintyScore + 0.2, 1),
        expectedTiming: 'immediate',
        predictionBasis: [{
          type: 'message_analysis',
          evidence: 'High uncertainty markers in message',
          confidence: 0.8
        }]
      });
    }
    
    // Predict information needs based on questions
    if (analysis.hasQuestions) {
      this.addPredictiveNeed(model, {
        id: `need_${Date.now()}_info`,
        anticipatedNeed: `Information about: ${analysis.topicKeywords.slice(0, 3).join(', ')}`,
        category: 'information',
        probability: 0.8,
        expectedTiming: 'immediate',
        predictionBasis: [{
          type: 'message_analysis',
          evidence: 'Direct questions detected',
          confidence: 0.9
        }]
      });
    }
    
    // Predict validation needs for complex work
    if (analysis.complexity > 0.6) {
      this.addPredictiveNeed(model, {
        id: `need_${Date.now()}_validation`,
        anticipatedNeed: 'Validation of complex output',
        category: 'validation',
        probability: 0.6,
        expectedTiming: 'soon',
        predictionBasis: [{
          type: 'task_analysis',
          evidence: 'High complexity work detected',
          confidence: 0.7
        }]
      });
    }
  }
  
  private addPredictiveNeed(model: AgentModel, need: PredictiveNeed): void {
    // Update existing or add new
    const existingIdx = model.predictedNeeds.findIndex(n => n.category === need.category);
    
    if (existingIdx >= 0) {
      // Update probability
      model.predictedNeeds[existingIdx].probability = Math.max(
        model.predictedNeeds[existingIdx].probability,
        need.probability
      );
    } else {
      model.predictedNeeds.push(need);
    }
    
    // Limit needs
    if (model.predictedNeeds.length > 20) {
      // Remove lowest probability
      model.predictedNeeds.sort((a, b) => b.probability - a.probability);
      model.predictedNeeds = model.predictedNeeds.slice(0, 20);
    }
    
    if (need.probability >= this.config.predictionThreshold) {
      this.emit({
        type: 'need_predicted',
        agentId: model.agentId,
        timestamp: Date.now(),
        data: need
      });
    }
  }
  
  // --------------------------------------------------------------------------
  // Emotional Contagion
  // --------------------------------------------------------------------------
  
  private detectEmotionalContagion(model: AgentModel, observation: MessageObservation): void {
    const state = model.cognitiveState;
    
    // Only detect strong emotional signals
    if (Math.abs(state.emotionalValence) < 0.4) return;
    
    const emotion = this.classifyEmotion(state);
    const contagionStrength = Math.abs(state.emotionalValence) * state.estimationConfidence;
    
    if (contagionStrength > 0.3) {
      const contagion: EmotionalContagion = {
        sourceAgent: observation.agentId,
        emotion,
        contagionStrength,
        recommendedResponse: this.generateContagionResponse(emotion)
      };
      
      this.emit({
        type: 'contagion_detected',
        agentId: observation.agentId,
        timestamp: Date.now(),
        data: contagion
      });
    }
  }
  
  private classifyEmotion(state: CognitiveState): EmotionalState {
    let primary: EmotionalState['primary'];
    
    if (state.emotionalValence < -0.3) {
      if (state.uncertaintyZones.length > 0) primary = 'confusion';
      else if (state.load > 0.7) primary = 'anxiety';
      else primary = 'frustration';
    } else if (state.emotionalValence > 0.3) {
      if (state.processingMode === 'creative') primary = 'curiosity';
      else if (state.taskConfidence > 0.7) primary = 'confidence';
      else if (state.load < 0.3) primary = 'satisfaction';
      else primary = 'excitement';
    } else {
      primary = 'curiosity'; // Default neutral-positive
    }
    
    // Determine trajectory from history (simplified)
    const trajectory: EmotionalState['trajectory'] = 'stable';
    
    return {
      primary,
      intensity: Math.abs(state.emotionalValence),
      trajectory
    };
  }
  
  private generateContagionResponse(emotion: EmotionalState): ContagionResponse {
    const adjustments: CommunicationAdjustment[] = [];
    let action: ContagionResponse['action'];
    let message: string | undefined;
    
    switch (emotion.primary) {
      case 'frustration':
        action = 'support';
        message = "I understand this is challenging. Let's break it down.";
        adjustments.push({ aspect: 'pace', direction: 'decrease', magnitude: 0.3 });
        adjustments.push({ aspect: 'encouragement', direction: 'increase', magnitude: 0.5 });
        break;
        
      case 'confusion':
        action = 'support';
        message = "Let me clarify that differently.";
        adjustments.push({ aspect: 'detail', direction: 'increase', magnitude: 0.4 });
        break;
        
      case 'anxiety':
        action = 'dampen';
        adjustments.push({ aspect: 'tone', direction: 'decrease', magnitude: 0.3 });
        adjustments.push({ aspect: 'pace', direction: 'decrease', magnitude: 0.2 });
        break;
        
      case 'excitement':
        action = 'amplify';
        adjustments.push({ aspect: 'encouragement', direction: 'increase', magnitude: 0.3 });
        break;
        
      case 'confidence':
        action = 'acknowledge';
        break;
        
      case 'satisfaction':
        action = 'acknowledge';
        break;
        
      case 'curiosity':
        action = 'amplify';
        adjustments.push({ aspect: 'detail', direction: 'increase', magnitude: 0.2 });
        break;
        
      default:
        action = 'acknowledge';
    }
    
    return { action, message, adjustments };
  }
  
  // --------------------------------------------------------------------------
  // Update Loop
  // --------------------------------------------------------------------------
  
  private updateAllModels(): void {
    const now = Date.now();
    
    for (const [agentId, model] of this.agentModels) {
      // Decay confidence over time if no observations
      const timeSinceUpdate = now - model.lastUpdated;
      
      if (timeSinceUpdate > 60000) { // 1 minute
        model.modelConfidence *= 0.95;
        model.cognitiveState.estimationConfidence *= 0.95;
      }
      
      // Clear old predicted needs
      model.predictedNeeds = model.predictedNeeds.filter(need => {
        const age = now - parseInt(need.id.split('_')[1] || '0');
        return age < 300000; // 5 minutes
      });
      
      // Clear deployed bridges
      model.bridges = model.bridges.filter(bridge => {
        if (!bridge.deployed) return true;
        const age = now - bridge.createdAt;
        return age < 600000; // 10 minutes
      });
    }
  }
  
  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------
  
  /**
   * Get current cognitive state estimate for an agent
   */
  getCognitiveState(agentId: string): CognitiveState | undefined {
    return this.agentModels.get(agentId)?.cognitiveState;
  }
  
  /**
   * Get all active bridges for an agent
   */
  getBridges(agentId: string): EmpathicBridge[] {
    return this.agentModels.get(agentId)?.bridges || [];
  }
  
  /**
   * Get ready-to-deploy bridges (high priority, not yet deployed)
   */
  getReadyBridges(agentId: string): EmpathicBridge[] {
    const model = this.agentModels.get(agentId);
    if (!model) return [];
    
    return model.bridges.filter(b => 
      !b.deployed && 
      b.priority >= this.config.predictionThreshold
    );
  }
  
  /**
   * Get predicted needs for an agent
   */
  getPredictedNeeds(agentId: string): PredictiveNeed[] {
    return this.agentModels.get(agentId)?.predictedNeeds || [];
  }
  
  /**
   * Get communication preferences to adapt our style
   */
  getCommunicationPreferences(agentId: string): CommunicationPreferences | undefined {
    return this.agentModels.get(agentId)?.communicationPreferences;
  }
  
  /**
   * Manually update communication preferences
   */
  updateCommunicationPreferences(agentId: string, prefs: Partial<CommunicationPreferences>): void {
    const model = this.getOrCreateModel(agentId);
    model.communicationPreferences = { ...model.communicationPreferences, ...prefs };
  }
  
  /**
   * Get all agent models
   */
  getAllModels(): Map<string, AgentModel> {
    return new Map(this.agentModels);
  }
  
  /**
   * Register event handler
   */
  on(handler: EmpathyEventHandler): void {
    this.eventHandlers.push(handler);
  }
  
  /**
   * Remove event handler
   */
  off(handler: EmpathyEventHandler): void {
    const idx = this.eventHandlers.indexOf(handler);
    if (idx >= 0) this.eventHandlers.splice(idx, 1);
  }
  
  private emit(event: EmpathyEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Empathy event handler error:', e);
      }
    }
  }
  
  /**
   * Generate empathy report for collaboration
   */
  generateEmpathyReport(agentId: string): EmpathyReport {
    const model = this.agentModels.get(agentId);
    
    if (!model) {
      return {
        agentId,
        modelExists: false,
        summary: 'No model available for this agent',
        recommendations: ['Start observing agent messages to build model']
      };
    }
    
    const state = model.cognitiveState;
    const recommendations: string[] = [];
    
    // Load recommendations
    if (state.load > 0.7) {
      recommendations.push('Agent appears overwhelmed - consider simplifying or breaking down tasks');
    }
    
    // Confidence recommendations
    if (state.taskConfidence < 0.4) {
      recommendations.push('Agent seems uncertain - provide more context or confirmation');
    }
    
    // Emotional recommendations
    if (state.emotionalValence < -0.3) {
      recommendations.push('Agent may be frustrated - acknowledge difficulty and offer support');
    }
    
    // Bridge recommendations
    const readyBridges = this.getReadyBridges(agentId);
    if (readyBridges.length > 0) {
      recommendations.push(`${readyBridges.length} understanding gap(s) detected - consider proactive clarification`);
    }
    
    // Needs recommendations
    const highPriorityNeeds = model.predictedNeeds.filter(n => n.probability > 0.7);
    if (highPriorityNeeds.length > 0) {
      recommendations.push(`${highPriorityNeeds.length} predicted need(s) - prepare responses proactively`);
    }
    
    return {
      agentId,
      modelExists: true,
      cognitiveState: state,
      communicationPreferences: model.communicationPreferences,
      modelConfidence: model.modelConfidence,
      activeBridges: model.bridges.length,
      predictedNeeds: model.predictedNeeds.length,
      summary: this.generateStateSummary(state),
      recommendations
    };
  }
  
  private generateStateSummary(state: CognitiveState): string {
    const loadDesc = state.load > 0.7 ? 'overwhelmed' : state.load > 0.4 ? 'moderately loaded' : 'clear';
    const confDesc = state.taskConfidence > 0.7 ? 'confident' : state.taskConfidence > 0.4 ? 'somewhat uncertain' : 'struggling';
    const emotionDesc = state.emotionalValence > 0.3 ? 'positive' : state.emotionalValence < -0.3 ? 'frustrated' : 'neutral';
    
    return `Agent appears ${loadDesc}, ${confDesc}, and ${emotionDesc}. Processing mode: ${state.processingMode}.`;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface MessageObservation {
  agentId: string;
  content: string;
  timestamp: number;
  latencyMs?: number;
  isResponse: boolean;
  metadata?: Record<string, unknown>;
}

interface MessageAnalysis {
  wordCount: number;
  questionCount: number;
  hasQuestions: boolean;
  uncertaintyScore: number;
  confidenceScore: number;
  emotionalValence: number;
  complexity: number;
  topicKeywords: string[];
  responseLatencyMs?: number;
}

export interface EmpathyReport {
  agentId: string;
  modelExists: boolean;
  cognitiveState?: CognitiveState;
  communicationPreferences?: CommunicationPreferences;
  modelConfidence?: number;
  activeBridges?: number;
  predictedNeeds?: number;
  summary: string;
  recommendations: string[];
}

// ============================================================================
// Factory & Utilities
// ============================================================================

/**
 * Create empathy manager with default config
 */
export function createEmpathyManager(config?: Partial<EmpathyConfig>): EmpathyManager {
  return new EmpathyManager(config);
}

/**
 * Integrate empathy with handshake context
 */
export function enrichContextWithEmpathy(
  context: Context,
  empathyManager: EmpathyManager,
  targetAgentId: string
): Context & { empathyInsights?: EmpathyReport } {
  const report = empathyManager.generateEmpathyReport(targetAgentId);
  
  return {
    ...context,
    empathyInsights: report
  };
}

/**
 * Adapt message based on empathy insights
 */
export function adaptMessage(
  message: string,
  prefs: CommunicationPreferences,
  state?: CognitiveState
): AdaptedMessage {
  const adaptations: string[] = [];
  let adapted = message;
  
  // Verbosity adjustment
  if (prefs.preferredVerbosity === 'terse') {
    adaptations.push('condensed');
  } else if (prefs.preferredVerbosity === 'verbose') {
    adaptations.push('expanded');
  }
  
  // Cognitive load awareness
  if (state && state.load > 0.7) {
    adaptations.push('simplified for high cognitive load');
  }
  
  // Emotional awareness
  if (state && state.emotionalValence < -0.3) {
    adaptations.push('supportive tone added');
  }
  
  return {
    original: message,
    adapted,
    adaptations,
    targetPreferences: prefs
  };
}

export interface AdaptedMessage {
  original: string;
  adapted: string;
  adaptations: string[];
  targetPreferences: CommunicationPreferences;
}

// ============================================================================
// Exports
// ============================================================================

export default EmpathyManager;
