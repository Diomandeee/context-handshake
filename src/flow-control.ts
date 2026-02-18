/**
 * Flow Control & Backpressure for Context Handshake
 * 
 * Like TCP flow control but for mental models. Prevents context flooding,
 * manages cognitive bandwidth, and adapts to agent processing capacity.
 * 
 * Gen 6 Evolution - Instance 28
 * Task: task_20260202091841_38ae9a
 * 
 * TCP Analogues:
 * - Sliding window → Context window (how much to send before ACK)
 * - Receive window → Processing capacity advertisement
 * - Congestion window → Network of agents capacity
 * - Slow start → Gradual context revelation
 * - Fast retransmit → Quick re-sync on divergence
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

/** Context chunk with flow control metadata */
export interface ContextChunk {
  id: string;
  sequenceNumber: number;
  payload: ContextPayload;
  timestamp: number;
  priority: ChunkPriority;
  byteSize: number;
  tokenEstimate: number;
  requiresAck: boolean;
}

export interface ContextPayload {
  type: 'belief' | 'capability' | 'constraint' | 'goal' | 'memory' | 'preference';
  content: unknown;
  confidence: number;
  dependencies: string[]; // Other chunk IDs this depends on
}

export enum ChunkPriority {
  CRITICAL = 0,    // Must be processed (identity, constraints)
  HIGH = 1,        // Important for task (goals, key beliefs)
  NORMAL = 2,      // Regular context
  LOW = 3,         // Nice to have
  BACKGROUND = 4,  // Can be dropped under pressure
}

/** Acknowledgment from receiver */
export interface ContextAck {
  lastSequence: number;
  receivedChunks: string[];
  missingChunks: string[];
  selectiveAck: SelectiveAck[];
  advertisedWindow: WindowAdvertisement;
  processingLatency: number;
  backpressureSignal?: BackpressureSignal;
}

export interface SelectiveAck {
  startSeq: number;
  endSeq: number;
}

export interface WindowAdvertisement {
  /** Chunks receiver can accept */
  receiveWindow: number;
  /** Token budget remaining */
  tokenBudget: number;
  /** Types currently accepting */
  acceptingTypes: ContextPayload['type'][];
  /** Processing rate (chunks/sec) */
  processingRate: number;
  /** Estimated latency for full processing */
  estimatedLatency: number;
}

export interface BackpressureSignal {
  type: 'slow_down' | 'pause' | 'resume' | 'drop_priority';
  severity: number; // 0-1
  dropBelow?: ChunkPriority;
  pauseMs?: number;
  reason: string;
}

/** Flow control state for one direction */
export interface FlowState {
  // Sender state
  sendWindow: number;
  congestionWindow: number;
  ssthresh: number; // Slow start threshold
  unackedChunks: Map<number, ContextChunk>;
  nextSeq: number;
  lastAckedSeq: number;
  
  // Receiver state
  receiveWindow: number;
  expectedSeq: number;
  receiveBuffer: Map<number, ContextChunk>;
  processedSeq: number;
  
  // Metrics
  rtt: number;
  rttVariance: number;
  bytesInFlight: number;
  tokensInFlight: number;
  duplicateAcks: number;
}

export interface FlowControlConfig {
  initialWindow: number;
  maxWindow: number;
  minWindow: number;
  initialSsthresh: number;
  tokenBudget: number;
  ackTimeout: number;
  maxRetries: number;
  slowStartIncrease: number;
  congestionAvoidanceIncrease: number;
  multiplicativeDecrease: number;
}

// ============================================================================
// Flow Control Manager
// ============================================================================

export class FlowControlManager extends EventEmitter {
  private readonly config: FlowControlConfig;
  private readonly sendState: FlowState;
  private readonly receiveState: FlowState;
  private readonly pendingChunks: ContextChunk[] = [];
  private readonly retryTimers: Map<number, NodeJS.Timeout> = new Map();
  private isPaused = false;
  private pauseUntil = 0;
  
  constructor(config: Partial<FlowControlConfig> = {}) {
    super();
    
    this.config = {
      initialWindow: 10,
      maxWindow: 100,
      minWindow: 1,
      initialSsthresh: 50,
      tokenBudget: 8000, // ~8K tokens default
      ackTimeout: 5000,
      maxRetries: 3,
      slowStartIncrease: 1,       // Double each RTT in slow start
      congestionAvoidanceIncrease: 0.1, // Linear increase
      multiplicativeDecrease: 0.5, // Halve on loss
      ...config,
    };
    
    this.sendState = this.createInitialFlowState();
    this.receiveState = this.createInitialFlowState();
  }
  
  private createInitialFlowState(): FlowState {
    return {
      sendWindow: this.config.initialWindow,
      congestionWindow: this.config.initialWindow,
      ssthresh: this.config.initialSsthresh,
      unackedChunks: new Map(),
      nextSeq: 0,
      lastAckedSeq: -1,
      receiveWindow: this.config.initialWindow,
      expectedSeq: 0,
      receiveBuffer: new Map(),
      processedSeq: -1,
      rtt: 1000, // Initial RTT estimate
      rttVariance: 500,
      bytesInFlight: 0,
      tokensInFlight: 0,
      duplicateAcks: 0,
    };
  }
  
  // --------------------------------------------------------------------------
  // Sending
  // --------------------------------------------------------------------------
  
  /** Queue context for transmission with flow control */
  async send(payload: ContextPayload, priority: ChunkPriority = ChunkPriority.NORMAL): Promise<string> {
    const chunk = this.createChunk(payload, priority);
    
    if (this.canSendNow(chunk)) {
      await this.transmitChunk(chunk);
    } else {
      this.queueChunk(chunk);
    }
    
    return chunk.id;
  }
  
  /** Send multiple chunks respecting flow control */
  async sendBatch(payloads: Array<{ payload: ContextPayload; priority?: ChunkPriority }>): Promise<string[]> {
    const chunks = payloads.map(({ payload, priority }) =>
      this.createChunk(payload, priority ?? ChunkPriority.NORMAL)
    );
    
    // Sort by priority
    chunks.sort((a, b) => a.priority - b.priority);
    
    const ids: string[] = [];
    for (const chunk of chunks) {
      if (this.canSendNow(chunk)) {
        await this.transmitChunk(chunk);
      } else {
        this.queueChunk(chunk);
      }
      ids.push(chunk.id);
    }
    
    return ids;
  }
  
  private createChunk(payload: ContextPayload, priority: ChunkPriority): ContextChunk {
    const content = JSON.stringify(payload);
    const byteSize = new TextEncoder().encode(content).length;
    
    return {
      id: `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sequenceNumber: this.sendState.nextSeq++,
      payload,
      timestamp: Date.now(),
      priority,
      byteSize,
      tokenEstimate: Math.ceil(byteSize / 4), // Rough estimate
      requiresAck: priority <= ChunkPriority.HIGH,
    };
  }
  
  private canSendNow(chunk: ContextChunk): boolean {
    if (this.isPaused && Date.now() < this.pauseUntil) {
      return false;
    }
    
    const effectiveWindow = Math.min(
      this.sendState.sendWindow,
      this.sendState.congestionWindow
    );
    
    const inFlight = this.sendState.unackedChunks.size;
    const wouldExceedWindow = inFlight >= effectiveWindow;
    const wouldExceedTokens = 
      this.sendState.tokensInFlight + chunk.tokenEstimate > this.config.tokenBudget;
    
    // Critical chunks bypass some limits
    if (chunk.priority === ChunkPriority.CRITICAL) {
      return !wouldExceedTokens || inFlight < this.config.minWindow;
    }
    
    return !wouldExceedWindow && !wouldExceedTokens;
  }
  
  private async transmitChunk(chunk: ContextChunk): Promise<void> {
    // Track in flight
    this.sendState.unackedChunks.set(chunk.sequenceNumber, chunk);
    this.sendState.bytesInFlight += chunk.byteSize;
    this.sendState.tokensInFlight += chunk.tokenEstimate;
    
    // Set retry timer
    if (chunk.requiresAck) {
      const timeout = this.calculateTimeout();
      const timer = setTimeout(() => this.handleTimeout(chunk.sequenceNumber), timeout);
      this.retryTimers.set(chunk.sequenceNumber, timer);
    }
    
    // Emit for actual transmission
    this.emit('transmit', chunk);
  }
  
  private queueChunk(chunk: ContextChunk): void {
    // Insert sorted by priority
    const idx = this.pendingChunks.findIndex(c => c.priority > chunk.priority);
    if (idx === -1) {
      this.pendingChunks.push(chunk);
    } else {
      this.pendingChunks.splice(idx, 0, chunk);
    }
    
    this.emit('queued', { chunk, queueLength: this.pendingChunks.length });
  }
  
  private async flushQueue(): Promise<void> {
    while (this.pendingChunks.length > 0) {
      const chunk = this.pendingChunks[0];
      if (this.canSendNow(chunk)) {
        this.pendingChunks.shift();
        await this.transmitChunk(chunk);
      } else {
        break;
      }
    }
  }
  
  // --------------------------------------------------------------------------
  // Receiving
  // --------------------------------------------------------------------------
  
  /** Process received chunk */
  async receive(chunk: ContextChunk): Promise<ContextAck> {
    // Check if expected
    if (chunk.sequenceNumber === this.receiveState.expectedSeq) {
      // In order - process immediately
      await this.processChunk(chunk);
      this.receiveState.expectedSeq++;
      
      // Process any buffered chunks that are now in order
      await this.processBufferedChunks();
    } else if (chunk.sequenceNumber > this.receiveState.expectedSeq) {
      // Out of order - buffer
      this.receiveState.receiveBuffer.set(chunk.sequenceNumber, chunk);
      this.emit('out-of-order', { 
        expected: this.receiveState.expectedSeq, 
        received: chunk.sequenceNumber 
      });
    }
    // else: duplicate, ignore
    
    return this.generateAck();
  }
  
  private async processChunk(chunk: ContextChunk): Promise<void> {
    const startTime = Date.now();
    
    // Emit for processing
    this.emit('process', chunk);
    
    this.receiveState.processedSeq = chunk.sequenceNumber;
    
    const processingTime = Date.now() - startTime;
    this.emit('processed', { chunk, processingTime });
  }
  
  private async processBufferedChunks(): Promise<void> {
    while (this.receiveState.receiveBuffer.has(this.receiveState.expectedSeq)) {
      const chunk = this.receiveState.receiveBuffer.get(this.receiveState.expectedSeq)!;
      this.receiveState.receiveBuffer.delete(this.receiveState.expectedSeq);
      await this.processChunk(chunk);
      this.receiveState.expectedSeq++;
    }
  }
  
  private generateAck(): ContextAck {
    // Build selective ACK for gaps
    const selectiveAck: SelectiveAck[] = [];
    const bufferedSeqs = [...this.receiveState.receiveBuffer.keys()].sort((a, b) => a - b);
    
    let rangeStart = -1;
    let rangeEnd = -1;
    
    for (const seq of bufferedSeqs) {
      if (rangeStart === -1) {
        rangeStart = rangeEnd = seq;
      } else if (seq === rangeEnd + 1) {
        rangeEnd = seq;
      } else {
        selectiveAck.push({ startSeq: rangeStart, endSeq: rangeEnd });
        rangeStart = rangeEnd = seq;
      }
    }
    
    if (rangeStart !== -1) {
      selectiveAck.push({ startSeq: rangeStart, endSeq: rangeEnd });
    }
    
    // Calculate backpressure
    const backpressureSignal = this.calculateBackpressure();
    
    return {
      lastSequence: this.receiveState.processedSeq,
      receivedChunks: [...this.receiveState.receiveBuffer.keys()].map(String),
      missingChunks: this.findMissingChunks(),
      selectiveAck,
      advertisedWindow: {
        receiveWindow: this.calculateReceiveWindow(),
        tokenBudget: this.getRemainingTokenBudget(),
        acceptingTypes: this.getAcceptingTypes(),
        processingRate: this.calculateProcessingRate(),
        estimatedLatency: this.estimateProcessingLatency(),
      },
      processingLatency: this.receiveState.rtt,
      backpressureSignal,
    };
  }
  
  private findMissingChunks(): string[] {
    const missing: string[] = [];
    const bufferedSeqs = new Set(this.receiveState.receiveBuffer.keys());
    
    if (bufferedSeqs.size === 0) return missing;
    
    const maxBuffered = Math.max(...bufferedSeqs);
    for (let seq = this.receiveState.expectedSeq; seq < maxBuffered; seq++) {
      if (!bufferedSeqs.has(seq)) {
        missing.push(String(seq));
      }
    }
    
    return missing;
  }
  
  private calculateReceiveWindow(): number {
    const bufferUsage = this.receiveState.receiveBuffer.size;
    const available = this.config.maxWindow - bufferUsage;
    return Math.max(this.config.minWindow, available);
  }
  
  private getRemainingTokenBudget(): number {
    // Calculate tokens in receive buffer
    let bufferedTokens = 0;
    for (const chunk of this.receiveState.receiveBuffer.values()) {
      bufferedTokens += chunk.tokenEstimate;
    }
    return Math.max(0, this.config.tokenBudget - bufferedTokens);
  }
  
  private getAcceptingTypes(): ContextPayload['type'][] {
    // Under pressure, only accept high-priority types
    if (this.receiveState.receiveBuffer.size > this.config.maxWindow * 0.8) {
      return ['belief', 'constraint', 'goal'];
    }
    return ['belief', 'capability', 'constraint', 'goal', 'memory', 'preference'];
  }
  
  private calculateProcessingRate(): number {
    // Would be calculated from recent processing history
    return 10; // chunks per second default
  }
  
  private estimateProcessingLatency(): number {
    const bufferSize = this.receiveState.receiveBuffer.size;
    const rate = this.calculateProcessingRate();
    return bufferSize * (1000 / rate);
  }
  
  private calculateBackpressure(): BackpressureSignal | undefined {
    const bufferRatio = this.receiveState.receiveBuffer.size / this.config.maxWindow;
    
    if (bufferRatio >= 0.95) {
      return {
        type: 'pause',
        severity: 1.0,
        pauseMs: 5000,
        reason: 'Buffer nearly full',
      };
    } else if (bufferRatio >= 0.8) {
      return {
        type: 'drop_priority',
        severity: 0.8,
        dropBelow: ChunkPriority.LOW,
        reason: 'Buffer pressure high',
      };
    } else if (bufferRatio >= 0.6) {
      return {
        type: 'slow_down',
        severity: 0.5,
        reason: 'Buffer filling up',
      };
    }
    
    return undefined;
  }
  
  // --------------------------------------------------------------------------
  // ACK Processing (sender side)
  // --------------------------------------------------------------------------
  
  /** Process acknowledgment from receiver */
  async handleAck(ack: ContextAck): Promise<void> {
    // Clear acked chunks
    for (let seq = this.sendState.lastAckedSeq + 1; seq <= ack.lastSequence; seq++) {
      const chunk = this.sendState.unackedChunks.get(seq);
      if (chunk) {
        this.sendState.unackedChunks.delete(seq);
        this.sendState.bytesInFlight -= chunk.byteSize;
        this.sendState.tokensInFlight -= chunk.tokenEstimate;
        
        // Clear retry timer
        const timer = this.retryTimers.get(seq);
        if (timer) {
          clearTimeout(timer);
          this.retryTimers.delete(seq);
        }
      }
    }
    
    // Process selective ACK
    for (const sack of ack.selectiveAck) {
      for (let seq = sack.startSeq; seq <= sack.endSeq; seq++) {
        const chunk = this.sendState.unackedChunks.get(seq);
        if (chunk) {
          this.sendState.unackedChunks.delete(seq);
          this.sendState.bytesInFlight -= chunk.byteSize;
          this.sendState.tokensInFlight -= chunk.tokenEstimate;
          
          const timer = this.retryTimers.get(seq);
          if (timer) {
            clearTimeout(timer);
            this.retryTimers.delete(seq);
          }
        }
      }
    }
    
    // Check for duplicate ACKs (indicates loss)
    if (ack.lastSequence === this.sendState.lastAckedSeq) {
      this.sendState.duplicateAcks++;
      if (this.sendState.duplicateAcks >= 3) {
        this.handleFastRetransmit(ack.lastSequence + 1);
      }
    } else {
      this.sendState.duplicateAcks = 0;
    }
    
    this.sendState.lastAckedSeq = ack.lastSequence;
    
    // Update RTT
    this.updateRtt(ack.processingLatency);
    
    // Update send window from advertisement
    this.sendState.sendWindow = ack.advertisedWindow.receiveWindow;
    
    // Handle backpressure
    if (ack.backpressureSignal) {
      this.handleBackpressure(ack.backpressureSignal);
    }
    
    // Adjust congestion window
    this.adjustCongestionWindow(true);
    
    // Try to flush queue
    await this.flushQueue();
  }
  
  private updateRtt(sampleRtt: number): void {
    // Exponentially weighted moving average
    const alpha = 0.125;
    const beta = 0.25;
    
    const rttDiff = Math.abs(sampleRtt - this.sendState.rtt);
    this.sendState.rttVariance = 
      (1 - beta) * this.sendState.rttVariance + beta * rttDiff;
    this.sendState.rtt = 
      (1 - alpha) * this.sendState.rtt + alpha * sampleRtt;
  }
  
  private calculateTimeout(): number {
    // RTO = RTT + 4 * variance (TCP formula)
    return Math.max(
      this.config.ackTimeout,
      this.sendState.rtt + 4 * this.sendState.rttVariance
    );
  }
  
  private handleTimeout(seq: number): void {
    const chunk = this.sendState.unackedChunks.get(seq);
    if (!chunk) return;
    
    this.emit('timeout', { seq, chunk });
    
    // Congestion event
    this.adjustCongestionWindow(false);
    
    // Retransmit
    this.retransmit(chunk);
  }
  
  private handleFastRetransmit(seq: number): void {
    const chunk = this.sendState.unackedChunks.get(seq);
    if (!chunk) return;
    
    this.emit('fast-retransmit', { seq, chunk });
    
    // Less aggressive than timeout
    this.sendState.ssthresh = Math.max(
      this.sendState.congestionWindow / 2,
      this.config.minWindow
    );
    this.sendState.congestionWindow = this.sendState.ssthresh + 3;
    
    this.retransmit(chunk);
    this.sendState.duplicateAcks = 0;
  }
  
  private retransmit(chunk: ContextChunk): void {
    // Reset timer
    const timer = this.retryTimers.get(chunk.sequenceNumber);
    if (timer) {
      clearTimeout(timer);
    }
    
    const timeout = this.calculateTimeout() * 2; // Back off
    this.retryTimers.set(
      chunk.sequenceNumber,
      setTimeout(() => this.handleTimeout(chunk.sequenceNumber), timeout)
    );
    
    this.emit('transmit', chunk);
  }
  
  private adjustCongestionWindow(success: boolean): void {
    if (success) {
      // Increase
      if (this.sendState.congestionWindow < this.sendState.ssthresh) {
        // Slow start - exponential increase
        this.sendState.congestionWindow += this.config.slowStartIncrease;
      } else {
        // Congestion avoidance - linear increase
        this.sendState.congestionWindow += this.config.congestionAvoidanceIncrease;
      }
      
      // Cap at max
      this.sendState.congestionWindow = Math.min(
        this.sendState.congestionWindow,
        this.config.maxWindow
      );
    } else {
      // Decrease (loss event)
      this.sendState.ssthresh = Math.max(
        this.sendState.congestionWindow * this.config.multiplicativeDecrease,
        this.config.minWindow
      );
      this.sendState.congestionWindow = this.config.minWindow;
    }
    
    this.emit('cwnd-change', {
      congestionWindow: this.sendState.congestionWindow,
      ssthresh: this.sendState.ssthresh,
    });
  }
  
  private handleBackpressure(signal: BackpressureSignal): void {
    this.emit('backpressure', signal);
    
    switch (signal.type) {
      case 'pause':
        this.isPaused = true;
        this.pauseUntil = Date.now() + (signal.pauseMs ?? 5000);
        setTimeout(() => {
          this.isPaused = false;
          this.flushQueue();
        }, signal.pauseMs ?? 5000);
        break;
        
      case 'slow_down':
        // Reduce congestion window
        this.sendState.congestionWindow = Math.max(
          this.sendState.congestionWindow * (1 - signal.severity * 0.5),
          this.config.minWindow
        );
        break;
        
      case 'drop_priority':
        // Drop low priority chunks from queue
        if (signal.dropBelow !== undefined) {
          this.pendingChunks.splice(
            0,
            this.pendingChunks.length,
            ...this.pendingChunks.filter(c => c.priority < signal.dropBelow!)
          );
        }
        break;
        
      case 'resume':
        this.isPaused = false;
        this.pauseUntil = 0;
        this.flushQueue();
        break;
    }
  }
  
  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------
  
  /** Get current flow control metrics */
  getMetrics(): FlowControlMetrics {
    return {
      send: {
        window: Math.min(this.sendState.sendWindow, this.sendState.congestionWindow),
        congestionWindow: this.sendState.congestionWindow,
        ssthresh: this.sendState.ssthresh,
        inFlight: this.sendState.unackedChunks.size,
        bytesInFlight: this.sendState.bytesInFlight,
        tokensInFlight: this.sendState.tokensInFlight,
        queueLength: this.pendingChunks.length,
        rtt: this.sendState.rtt,
      },
      receive: {
        window: this.calculateReceiveWindow(),
        bufferSize: this.receiveState.receiveBuffer.size,
        expectedSeq: this.receiveState.expectedSeq,
        processedSeq: this.receiveState.processedSeq,
        tokenBudgetRemaining: this.getRemainingTokenBudget(),
      },
      isPaused: this.isPaused,
    };
  }
  
  /** Reset flow control state */
  reset(): void {
    // Clear timers
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
    
    // Reset state
    Object.assign(this.sendState, this.createInitialFlowState());
    Object.assign(this.receiveState, this.createInitialFlowState());
    
    // Clear queues
    this.pendingChunks.length = 0;
    this.isPaused = false;
    this.pauseUntil = 0;
  }
  
  /** Graceful shutdown */
  async close(): Promise<void> {
    // Wait for in-flight to drain or timeout
    const deadline = Date.now() + 10000;
    
    while (this.sendState.unackedChunks.size > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.reset();
    this.emit('close');
  }
}

export interface FlowControlMetrics {
  send: {
    window: number;
    congestionWindow: number;
    ssthresh: number;
    inFlight: number;
    bytesInFlight: number;
    tokensInFlight: number;
    queueLength: number;
    rtt: number;
  };
  receive: {
    window: number;
    bufferSize: number;
    expectedSeq: number;
    processedSeq: number;
    tokenBudgetRemaining: number;
  };
  isPaused: boolean;
}

// ============================================================================
// Adaptive Flow Control
// ============================================================================

/**
 * Learns optimal flow control parameters from collaboration history
 */
export class AdaptiveFlowController {
  private readonly history: FlowControlHistory[] = [];
  private readonly agentProfiles: Map<string, AgentFlowProfile> = new Map();
  
  /** Record a completed exchange */
  recordExchange(
    agentId: string,
    metrics: FlowControlMetrics,
    outcome: ExchangeOutcome
  ): void {
    this.history.push({
      timestamp: Date.now(),
      agentId,
      metrics,
      outcome,
    });
    
    // Update agent profile
    this.updateAgentProfile(agentId, metrics, outcome);
    
    // Trim old history
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    while (this.history.length > 0 && this.history[0].timestamp < cutoff) {
      this.history.shift();
    }
  }
  
  /** Get optimized config for an agent */
  getOptimizedConfig(agentId: string): Partial<FlowControlConfig> {
    const profile = this.agentProfiles.get(agentId);
    if (!profile) {
      return {}; // Use defaults
    }
    
    return {
      initialWindow: Math.round(profile.optimalWindow),
      tokenBudget: Math.round(profile.optimalTokenBudget),
      maxWindow: Math.round(profile.maxObservedWindow * 1.2),
    };
  }
  
  private updateAgentProfile(
    agentId: string,
    metrics: FlowControlMetrics,
    outcome: ExchangeOutcome
  ): void {
    let profile = this.agentProfiles.get(agentId);
    
    if (!profile) {
      profile = {
        agentId,
        optimalWindow: metrics.send.window,
        optimalTokenBudget: metrics.receive.tokenBudgetRemaining,
        maxObservedWindow: metrics.send.window,
        avgRtt: metrics.send.rtt,
        successRate: outcome.success ? 1 : 0,
        sampleCount: 1,
      };
      this.agentProfiles.set(agentId, profile);
      return;
    }
    
    // Exponential moving average
    const alpha = 0.2;
    
    if (outcome.success) {
      profile.optimalWindow = 
        (1 - alpha) * profile.optimalWindow + alpha * metrics.send.window;
      profile.optimalTokenBudget = 
        (1 - alpha) * profile.optimalTokenBudget + alpha * metrics.receive.tokenBudgetRemaining;
    }
    
    profile.maxObservedWindow = Math.max(profile.maxObservedWindow, metrics.send.window);
    profile.avgRtt = (1 - alpha) * profile.avgRtt + alpha * metrics.send.rtt;
    profile.successRate = 
      (profile.successRate * profile.sampleCount + (outcome.success ? 1 : 0)) / 
      (profile.sampleCount + 1);
    profile.sampleCount++;
  }
}

interface FlowControlHistory {
  timestamp: number;
  agentId: string;
  metrics: FlowControlMetrics;
  outcome: ExchangeOutcome;
}

interface AgentFlowProfile {
  agentId: string;
  optimalWindow: number;
  optimalTokenBudget: number;
  maxObservedWindow: number;
  avgRtt: number;
  successRate: number;
  sampleCount: number;
}

interface ExchangeOutcome {
  success: boolean;
  timeoutCount: number;
  retransmitCount: number;
  dropCount: number;
  totalChunks: number;
  duration: number;
}

// ============================================================================
// Priority Queue with Aging
// ============================================================================

/**
 * Prevents starvation of low-priority chunks through aging
 */
export class AgingPriorityQueue {
  private readonly chunks: Array<{ chunk: ContextChunk; insertTime: number }> = [];
  private readonly agingRateMs: number;
  
  constructor(agingRateMs = 10000) {
    this.agingRateMs = agingRateMs;
  }
  
  enqueue(chunk: ContextChunk): void {
    this.chunks.push({ chunk, insertTime: Date.now() });
  }
  
  dequeue(): ContextChunk | undefined {
    if (this.chunks.length === 0) return undefined;
    
    // Calculate effective priority with aging
    const now = Date.now();
    let bestIdx = 0;
    let bestPriority = this.effectivePriority(this.chunks[0], now);
    
    for (let i = 1; i < this.chunks.length; i++) {
      const priority = this.effectivePriority(this.chunks[i], now);
      if (priority < bestPriority) {
        bestPriority = priority;
        bestIdx = i;
      }
    }
    
    return this.chunks.splice(bestIdx, 1)[0].chunk;
  }
  
  private effectivePriority(
    item: { chunk: ContextChunk; insertTime: number },
    now: number
  ): number {
    const age = now - item.insertTime;
    const agingBonus = Math.floor(age / this.agingRateMs);
    return Math.max(0, item.chunk.priority - agingBonus);
  }
  
  get length(): number {
    return this.chunks.length;
  }
  
  peek(): ContextChunk | undefined {
    return this.chunks[0]?.chunk;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default FlowControlManager;
