/**
 * Resilience & Recovery for Context Handshakes
 * 
 * HEF Evolution: Instance 28, Generation 6
 * 
 * What happens when handshakes fail? Timeouts, disconnects, partial syncs...
 * This module provides:
 * - Checkpoint/resume for interrupted handshakes
 * - Graceful degradation with partial context
 * - Automatic retry with exponential backoff
 * - Circuit breakers for persistently failing agents
 * - Recovery strategies based on failure type
 */

import type {
  ContextOffer,
  AlignmentResult,
  HandshakeSession,
  MergedContext
} from './protocol';

// ============================================================================
// FAILURE TYPES
// ============================================================================

export type FailureType =
  | 'timeout'           // Agent didn't respond in time
  | 'disconnect'        // Connection lost mid-handshake
  | 'alignment_failed'  // Too low alignment to proceed
  | 'negotiation_stalled' // Couldn't reach agreement
  | 'compression_error' // Failed to decompress context
  | 'trust_violation'   // Agent behaved suspiciously
  | 'resource_exhausted' // Out of memory/tokens
  | 'version_mismatch'  // Incompatible protocol versions
  | 'unknown';

export interface FailureEvent {
  type: FailureType;
  timestamp: number;
  phase: 'syn' | 'syn-ack' | 'ack' | 'streaming' | 'finalization';
  agentId: string;
  sessionId: string;
  message: string;
  recoverable: boolean;
  checkpoint?: HandshakeCheckpoint;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CHECKPOINTS - Save handshake state for resume
// ============================================================================

export interface HandshakeCheckpoint {
  id: string;
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  phase: 'syn' | 'syn-ack' | 'ack' | 'streaming';
  
  // Partial state
  initiator: {
    agentId: string;
    contextSent: boolean;
    context?: Partial<ContextOffer>;
  };
  responder: {
    agentId: string;
    contextReceived: boolean;
    alignmentScore?: number;
    context?: Partial<ContextOffer>;
  };
  
  // Streaming state (if applicable)
  streaming?: {
    chunksTransferred: number;
    totalChunks: number;
    lastChunkId: string;
    alignmentProgression: number[];
  };
  
  // Recovery hints
  retryCount: number;
  lastFailure?: FailureType;
  recommendedStrategy: RecoveryStrategy;
}

// ============================================================================
// RECOVERY STRATEGIES
// ============================================================================

export type RecoveryStrategy =
  | 'retry_immediate'     // Just try again
  | 'retry_backoff'       // Wait with exponential backoff
  | 'resume_checkpoint'   // Continue from saved state
  | 'fallback_minimal'    // Use minimal context, skip full sync
  | 'fallback_fingerprint' // Use cached fingerprint if available
  | 'escalate_trust'      // Require higher trust before retry
  | 'switch_protocol'     // Try different sync method (streaming → batch)
  | 'abort_circuit_open'  // Don't retry, circuit breaker open
  | 'delegate_recovery'   // Ask another agent to mediate
  | 'proceed_partial';    // Continue with whatever context we have

export interface RecoveryPlan {
  strategy: RecoveryStrategy;
  delayMs: number;
  maxAttempts: number;
  checkpoint?: HandshakeCheckpoint;
  fallbackContext?: Partial<MergedContext>;
  notes: string;
}

/**
 * Determine best recovery strategy based on failure type
 */
export function determineRecoveryStrategy(
  failure: FailureEvent,
  history: FailureEvent[],
  config: ResilienceConfig
): RecoveryPlan {
  const recentFailures = history.filter(
    f => f.agentId === failure.agentId &&
         Date.now() - f.timestamp < config.failureWindowMs
  );
  
  // Circuit breaker check
  if (recentFailures.length >= config.circuitBreakerThreshold) {
    return {
      strategy: 'abort_circuit_open',
      delayMs: config.circuitBreakerCooldownMs,
      maxAttempts: 0,
      notes: `Circuit breaker open after ${recentFailures.length} failures`
    };
  }
  
  // Strategy by failure type
  switch (failure.type) {
    case 'timeout':
      return {
        strategy: failure.checkpoint ? 'resume_checkpoint' : 'retry_backoff',
        delayMs: calculateBackoff(failure.checkpoint?.retryCount ?? 0, config),
        maxAttempts: 3,
        checkpoint: failure.checkpoint,
        notes: 'Timeout - agent may be overloaded'
      };
      
    case 'disconnect':
      if (failure.checkpoint && failure.phase === 'streaming') {
        return {
          strategy: 'resume_checkpoint',
          delayMs: 1000,
          maxAttempts: 5,
          checkpoint: failure.checkpoint,
          notes: 'Resume streaming from last checkpoint'
        };
      }
      return {
        strategy: 'retry_backoff',
        delayMs: calculateBackoff(0, config),
        maxAttempts: 3,
        notes: 'Connection lost - network issue'
      };
      
    case 'alignment_failed':
      return {
        strategy: 'delegate_recovery',
        delayMs: 0,
        maxAttempts: 1,
        notes: 'Low alignment - may need mediator agent'
      };
      
    case 'negotiation_stalled':
      return {
        strategy: 'fallback_minimal',
        delayMs: 0,
        maxAttempts: 1,
        fallbackContext: buildMinimalContext(failure.checkpoint),
        notes: 'Negotiation stuck - proceed with basics'
      };
      
    case 'compression_error':
      return {
        strategy: 'switch_protocol',
        delayMs: 0,
        maxAttempts: 2,
        notes: 'Compression failed - try uncompressed sync'
      };
      
    case 'trust_violation':
      return {
        strategy: 'escalate_trust',
        delayMs: 5000,
        maxAttempts: 1,
        notes: 'Trust issue - require verification before retry'
      };
      
    case 'resource_exhausted':
      return {
        strategy: 'fallback_minimal',
        delayMs: 10000,
        maxAttempts: 1,
        fallbackContext: buildMinimalContext(failure.checkpoint),
        notes: 'Resources low - use minimal context'
      };
      
    case 'version_mismatch':
      return {
        strategy: 'switch_protocol',
        delayMs: 0,
        maxAttempts: 1,
        notes: 'Version mismatch - negotiate compatible version'
      };
      
    default:
      return {
        strategy: 'proceed_partial',
        delayMs: 0,
        maxAttempts: 1,
        fallbackContext: buildMinimalContext(failure.checkpoint),
        notes: 'Unknown failure - proceed with available context'
      };
  }
}

function calculateBackoff(retryCount: number, config: ResilienceConfig): number {
  const base = config.baseBackoffMs;
  const max = config.maxBackoffMs;
  const jitter = Math.random() * 0.3 + 0.85; // 0.85 - 1.15
  return Math.min(base * Math.pow(2, retryCount) * jitter, max);
}

function buildMinimalContext(checkpoint?: HandshakeCheckpoint): Partial<MergedContext> {
  if (!checkpoint) {
    return {
      capabilities: [],
      taskUnderstanding: 'minimal',
      sharedKnowledge: {},
      roleAssignments: {},
      confidence: 0.3
    };
  }
  
  // Build from whatever we have
  return {
    capabilities: checkpoint.initiator.context?.capabilities ?? [],
    taskUnderstanding: 'partial',
    sharedKnowledge: {},
    roleAssignments: {},
    confidence: (checkpoint.responder.alignmentScore ?? 0.3) * 0.5
  };
}

// ============================================================================
// CHECKPOINT MANAGER
// ============================================================================

export class CheckpointManager {
  private checkpoints = new Map<string, HandshakeCheckpoint>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  
  constructor(private config: ResilienceConfig) {
    if (config.enableAutoCleanup) {
      this.cleanupInterval = setInterval(
        () => this.cleanupExpired(),
        config.cleanupIntervalMs
      );
    }
  }
  
  /**
   * Create checkpoint from current handshake state
   */
  createCheckpoint(
    session: HandshakeSession,
    phase: HandshakeCheckpoint['phase'],
    streamingState?: HandshakeCheckpoint['streaming']
  ): HandshakeCheckpoint {
    const checkpoint: HandshakeCheckpoint = {
      id: `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId: session.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.checkpointTtlMs,
      phase,
      initiator: {
        agentId: session.initiator.agentId,
        contextSent: true,
        context: session.initiator.context
      },
      responder: {
        agentId: session.responder?.agentId ?? 'unknown',
        contextReceived: !!session.responder?.context,
        alignmentScore: session.alignment?.score,
        context: session.responder?.context
      },
      streaming: streamingState,
      retryCount: 0,
      recommendedStrategy: 'resume_checkpoint'
    };
    
    this.checkpoints.set(checkpoint.id, checkpoint);
    return checkpoint;
  }
  
  /**
   * Update checkpoint after retry
   */
  updateAfterRetry(
    checkpointId: string,
    failure: FailureType
  ): HandshakeCheckpoint | null {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return null;
    
    checkpoint.retryCount++;
    checkpoint.lastFailure = failure;
    checkpoint.recommendedStrategy = checkpoint.retryCount > 3 
      ? 'fallback_minimal' 
      : 'resume_checkpoint';
      
    return checkpoint;
  }
  
  /**
   * Get checkpoint by session ID
   */
  getBySessionId(sessionId: string): HandshakeCheckpoint | null {
    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.sessionId === sessionId && checkpoint.expiresAt > Date.now()) {
        return checkpoint;
      }
    }
    return null;
  }
  
  /**
   * Remove checkpoint (successful handshake)
   */
  remove(checkpointId: string): void {
    this.checkpoints.delete(checkpointId);
  }
  
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.expiresAt < now) {
        this.checkpoints.delete(id);
      }
    }
  }
  
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export interface CircuitState {
  agentId: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailure: number;
  openedAt?: number;
  halfOpenAttempts: number;
}

export class CircuitBreaker {
  private circuits = new Map<string, CircuitState>();
  
  constructor(private config: ResilienceConfig) {}
  
  /**
   * Check if we can attempt handshake with this agent
   */
  canAttempt(agentId: string): { allowed: boolean; reason?: string } {
    const circuit = this.circuits.get(agentId);
    
    if (!circuit) {
      return { allowed: true };
    }
    
    switch (circuit.state) {
      case 'closed':
        return { allowed: true };
        
      case 'open':
        const cooldownElapsed = Date.now() - (circuit.openedAt ?? 0) > 
                               this.config.circuitBreakerCooldownMs;
        if (cooldownElapsed) {
          // Transition to half-open
          circuit.state = 'half-open';
          circuit.halfOpenAttempts = 0;
          return { allowed: true, reason: 'Circuit half-open, testing...' };
        }
        return { 
          allowed: false, 
          reason: `Circuit open until ${new Date((circuit.openedAt ?? 0) + this.config.circuitBreakerCooldownMs).toISOString()}` 
        };
        
      case 'half-open':
        if (circuit.halfOpenAttempts < this.config.halfOpenMaxAttempts) {
          circuit.halfOpenAttempts++;
          return { allowed: true, reason: 'Half-open test attempt' };
        }
        return { allowed: false, reason: 'Half-open attempts exhausted' };
    }
  }
  
  /**
   * Record a failure
   */
  recordFailure(agentId: string): void {
    let circuit = this.circuits.get(agentId);
    
    if (!circuit) {
      circuit = {
        agentId,
        state: 'closed',
        failureCount: 0,
        lastFailure: 0,
        halfOpenAttempts: 0
      };
      this.circuits.set(agentId, circuit);
    }
    
    // Reset if outside failure window
    if (Date.now() - circuit.lastFailure > this.config.failureWindowMs) {
      circuit.failureCount = 0;
    }
    
    circuit.failureCount++;
    circuit.lastFailure = Date.now();
    
    // Open circuit if threshold exceeded
    if (circuit.failureCount >= this.config.circuitBreakerThreshold) {
      circuit.state = 'open';
      circuit.openedAt = Date.now();
    }
    
    // If failed during half-open, reopen
    if (circuit.state === 'half-open') {
      circuit.state = 'open';
      circuit.openedAt = Date.now();
    }
  }
  
  /**
   * Record a success
   */
  recordSuccess(agentId: string): void {
    const circuit = this.circuits.get(agentId);
    if (!circuit) return;
    
    // Success in half-open closes the circuit
    if (circuit.state === 'half-open') {
      circuit.state = 'closed';
      circuit.failureCount = 0;
    }
    
    // Decay failure count on success
    circuit.failureCount = Math.max(0, circuit.failureCount - 1);
  }
  
  /**
   * Get current circuit state
   */
  getState(agentId: string): CircuitState | null {
    return this.circuits.get(agentId) ?? null;
  }
  
  /**
   * Get all open circuits
   */
  getOpenCircuits(): CircuitState[] {
    return Array.from(this.circuits.values())
      .filter(c => c.state === 'open');
  }
}

// ============================================================================
// GRACEFUL DEGRADATION
// ============================================================================

export interface DegradationLevel {
  level: 'full' | 'streaming' | 'minimal' | 'fingerprint' | 'emergency';
  capabilities: string[];
  maxContextSize: number;
  timeoutMs: number;
  description: string;
}

const DEGRADATION_LEVELS: DegradationLevel[] = [
  {
    level: 'full',
    capabilities: ['full-sync', 'streaming', 'negotiation', 'compression'],
    maxContextSize: Infinity,
    timeoutMs: 30000,
    description: 'Full handshake with all features'
  },
  {
    level: 'streaming',
    capabilities: ['streaming', 'compression'],
    maxContextSize: 100000,
    timeoutMs: 20000,
    description: 'Streaming sync without negotiation'
  },
  {
    level: 'minimal',
    capabilities: ['basic-sync'],
    maxContextSize: 10000,
    timeoutMs: 10000,
    description: 'Basic context exchange only'
  },
  {
    level: 'fingerprint',
    capabilities: ['fingerprint-only'],
    maxContextSize: 1000,
    timeoutMs: 5000,
    description: 'Fingerprint comparison, use cached context'
  },
  {
    level: 'emergency',
    capabilities: [],
    maxContextSize: 500,
    timeoutMs: 2000,
    description: 'Proceed without sync, minimal shared context'
  }
];

export class GracefulDegradation {
  private currentLevel: DegradationLevel = DEGRADATION_LEVELS[0];
  private degradationHistory: { level: string; timestamp: number; reason: string }[] = [];
  
  constructor(private config: ResilienceConfig) {}
  
  /**
   * Degrade to next level
   */
  degrade(reason: string): DegradationLevel {
    const currentIndex = DEGRADATION_LEVELS.findIndex(l => l.level === this.currentLevel.level);
    const nextIndex = Math.min(currentIndex + 1, DEGRADATION_LEVELS.length - 1);
    
    this.currentLevel = DEGRADATION_LEVELS[nextIndex];
    this.degradationHistory.push({
      level: this.currentLevel.level,
      timestamp: Date.now(),
      reason
    });
    
    return this.currentLevel;
  }
  
  /**
   * Try to recover to higher level
   */
  attemptRecovery(): DegradationLevel | null {
    const currentIndex = DEGRADATION_LEVELS.findIndex(l => l.level === this.currentLevel.level);
    if (currentIndex === 0) return null; // Already at full
    
    // Check if we've been stable
    const recentDegradations = this.degradationHistory.filter(
      d => Date.now() - d.timestamp < this.config.recoveryWindowMs
    );
    
    if (recentDegradations.length === 0) {
      this.currentLevel = DEGRADATION_LEVELS[currentIndex - 1];
      return this.currentLevel;
    }
    
    return null;
  }
  
  getCurrentLevel(): DegradationLevel {
    return this.currentLevel;
  }
  
  reset(): void {
    this.currentLevel = DEGRADATION_LEVELS[0];
    this.degradationHistory = [];
  }
}

// ============================================================================
// RESILIENT HANDSHAKE EXECUTOR
// ============================================================================

export interface ResilienceConfig {
  // Retry settings
  baseBackoffMs: number;        // Starting backoff delay
  maxBackoffMs: number;         // Maximum backoff delay
  maxRetries: number;           // Maximum retry attempts
  
  // Circuit breaker
  circuitBreakerThreshold: number;   // Failures before opening
  circuitBreakerCooldownMs: number;  // Time before half-open
  halfOpenMaxAttempts: number;       // Test attempts in half-open
  failureWindowMs: number;           // Window for counting failures
  
  // Checkpoints
  enableCheckpoints: boolean;
  checkpointTtlMs: number;       // How long checkpoints live
  enableAutoCleanup: boolean;
  cleanupIntervalMs: number;
  
  // Recovery
  recoveryWindowMs: number;      // Stability window for recovery
}

export const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
  baseBackoffMs: 1000,
  maxBackoffMs: 30000,
  maxRetries: 5,
  
  circuitBreakerThreshold: 5,
  circuitBreakerCooldownMs: 60000,
  halfOpenMaxAttempts: 2,
  failureWindowMs: 120000,
  
  enableCheckpoints: true,
  checkpointTtlMs: 300000, // 5 minutes
  enableAutoCleanup: true,
  cleanupIntervalMs: 60000,
  
  recoveryWindowMs: 180000 // 3 minutes
};

export class ResilientHandshakeExecutor {
  private checkpointManager: CheckpointManager;
  private circuitBreaker: CircuitBreaker;
  private degradation: GracefulDegradation;
  private failureHistory: FailureEvent[] = [];
  
  constructor(
    private config: ResilienceConfig = DEFAULT_RESILIENCE_CONFIG
  ) {
    this.checkpointManager = new CheckpointManager(config);
    this.circuitBreaker = new CircuitBreaker(config);
    this.degradation = new GracefulDegradation(config);
  }
  
  /**
   * Execute handshake with full resilience
   */
  async executeWithResilience<T>(
    targetAgentId: string,
    handshakeFn: (level: DegradationLevel) => Promise<T>,
    onCheckpoint?: (checkpoint: HandshakeCheckpoint) => void
  ): Promise<{ success: boolean; result?: T; error?: string; attempts: number }> {
    // Check circuit breaker
    const canAttempt = this.circuitBreaker.canAttempt(targetAgentId);
    if (!canAttempt.allowed) {
      return {
        success: false,
        error: canAttempt.reason,
        attempts: 0
      };
    }
    
    let attempts = 0;
    let lastError: Error | null = null;
    
    while (attempts < this.config.maxRetries) {
      attempts++;
      const level = this.degradation.getCurrentLevel();
      
      try {
        const result = await handshakeFn(level);
        
        // Success! Record and return
        this.circuitBreaker.recordSuccess(targetAgentId);
        this.degradation.attemptRecovery();
        
        return { success: true, result, attempts };
        
      } catch (error) {
        lastError = error as Error;
        
        // Create failure event
        const failure: FailureEvent = {
          type: this.classifyError(error as Error),
          timestamp: Date.now(),
          phase: 'syn', // Would be determined by actual phase
          agentId: targetAgentId,
          sessionId: `session_${Date.now()}`,
          message: (error as Error).message,
          recoverable: this.isRecoverable(error as Error)
        };
        
        this.failureHistory.push(failure);
        this.circuitBreaker.recordFailure(targetAgentId);
        
        // Get recovery plan
        const plan = determineRecoveryStrategy(
          failure, 
          this.failureHistory, 
          this.config
        );
        
        // If unrecoverable or circuit open, abort
        if (plan.strategy === 'abort_circuit_open' || !failure.recoverable) {
          return {
            success: false,
            error: `${failure.type}: ${failure.message}`,
            attempts
          };
        }
        
        // Apply strategy
        switch (plan.strategy) {
          case 'retry_backoff':
            await this.sleep(plan.delayMs);
            break;
            
          case 'fallback_minimal':
          case 'switch_protocol':
            this.degradation.degrade(failure.type);
            break;
            
          case 'proceed_partial':
            // Return partial success with fallback context
            return {
              success: true,
              result: plan.fallbackContext as T,
              attempts
            };
        }
        
        // Notify checkpoint if available
        if (onCheckpoint && failure.checkpoint) {
          onCheckpoint(failure.checkpoint);
        }
      }
    }
    
    return {
      success: false,
      error: lastError?.message ?? 'Max retries exceeded',
      attempts
    };
  }
  
  private classifyError(error: Error): FailureType {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('timeout')) return 'timeout';
    if (msg.includes('disconnect') || msg.includes('connection')) return 'disconnect';
    if (msg.includes('alignment')) return 'alignment_failed';
    if (msg.includes('negotiation')) return 'negotiation_stalled';
    if (msg.includes('compress') || msg.includes('decompress')) return 'compression_error';
    if (msg.includes('trust')) return 'trust_violation';
    if (msg.includes('memory') || msg.includes('resource')) return 'resource_exhausted';
    if (msg.includes('version')) return 'version_mismatch';
    
    return 'unknown';
  }
  
  private isRecoverable(error: Error): boolean {
    const type = this.classifyError(error);
    return type !== 'trust_violation' && type !== 'version_mismatch';
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Getters for monitoring
  getCircuitState(agentId: string) { return this.circuitBreaker.getState(agentId); }
  getCurrentDegradationLevel() { return this.degradation.getCurrentLevel(); }
  getOpenCircuits() { return this.circuitBreaker.getOpenCircuits(); }
  getFailureHistory() { return [...this.failureHistory]; }
  
  destroy(): void {
    this.checkpointManager.destroy();
  }
}

// ============================================================================
// HEALTH MONITOR
// ============================================================================

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  degradationLevel: string;
  openCircuits: number;
  recentFailures: number;
  uptime: number;
  lastSuccessfulHandshake?: number;
}

export class HealthMonitor {
  private startTime = Date.now();
  private lastSuccess: number | null = null;
  
  constructor(
    private executor: ResilientHandshakeExecutor,
    private config: ResilienceConfig
  ) {}
  
  recordSuccess(): void {
    this.lastSuccess = Date.now();
  }
  
  getHealth(): HealthStatus {
    const level = this.executor.getCurrentDegradationLevel();
    const openCircuits = this.executor.getOpenCircuits().length;
    const recentFailures = this.executor.getFailureHistory()
      .filter(f => Date.now() - f.timestamp < this.config.failureWindowMs).length;
    
    let overall: HealthStatus['overall'] = 'healthy';
    if (level.level !== 'full' || openCircuits > 0) {
      overall = 'degraded';
    }
    if (level.level === 'emergency' || openCircuits > 3) {
      overall = 'unhealthy';
    }
    
    return {
      overall,
      degradationLevel: level.level,
      openCircuits,
      recentFailures,
      uptime: Date.now() - this.startTime,
      lastSuccessfulHandshake: this.lastSuccess ?? undefined
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DEGRADATION_LEVELS
};
