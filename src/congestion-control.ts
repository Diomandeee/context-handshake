/**
 * Congestion Control for Context Handshake Protocol
 * 
 * TCP-inspired algorithms adapted for cognitive bandwidth management.
 * Just as TCP's congestion control prevents network collapse, this
 * prevents cognitive overload during AI-to-AI collaboration.
 * 
 * Implements:
 * - AIMD (Additive Increase Multiplicative Decrease)
 * - Slow Start for new sessions
 * - Congestion Avoidance
 * - Fast Recovery
 * - BBR-style bandwidth estimation
 * 
 * HEF Evolution: Generation 6, Instance 28
 * Techniques: G05 (SCAMPER-Adapt), G11 (Perspective Shift), S02 (Synergistic Fusion)
 */

import { EventEmitter } from 'events';

// =============================================================================
// Types
// =============================================================================

/** Congestion control algorithm variants */
export type CongestionAlgorithm = 
  | 'reno'      // Classic TCP Reno - conservative, proven
  | 'cubic'     // TCP Cubic - aggressive recovery, default Linux
  | 'bbr'       // Bottleneck Bandwidth & RTT - model-based
  | 'adaptive'; // Auto-select based on conditions

/** Current congestion state (like TCP state machine) */
export type CongestionState = 
  | 'slow-start'           // Exponential growth to probe capacity
  | 'congestion-avoidance' // Linear growth to avoid overload
  | 'fast-recovery'        // After loss, recover without slow start
  | 'timeout-recovery';    // Severe loss, back to slow start

/** Cognitive load signal from receiver */
export interface CognitiveLoadSignal {
  timestamp: number;
  receiverId: string;
  
  // Current load indicators (0-1 scale)
  processingLoad: number;      // How busy is the receiver?
  memoryPressure: number;      // Working memory utilization
  contextSaturation: number;   // How full is their context window?
  
  // Quality signals
  comprehensionScore: number;  // Are they understanding? (0-1)
  responseLatency: number;     // How long to respond? (ms)
  
  // Explicit signals
  explicitBackpressure?: boolean;  // Receiver asked to slow down
  lossDetected?: boolean;          // Receiver missed something
}

/** Bandwidth estimate for BBR-style control */
export interface BandwidthEstimate {
  /** Maximum observed throughput (concepts/second) */
  maxBandwidth: number;
  /** Minimum observed RTT (ms) */
  minRtt: number;
  /** Current bandwidth-delay product */
  bdp: number;
  /** Confidence in estimate (0-1) */
  confidence: number;
  /** Sample count */
  samples: number;
}

/** Congestion event types */
export interface CongestionEvent {
  type: 'loss' | 'timeout' | 'ecn' | 'load-spike' | 'comprehension-drop';
  timestamp: number;
  severity: number;  // 0-1
  details?: Record<string, unknown>;
}

/** Congestion window state */
export interface CongestionWindow {
  /** Current window size (concepts that can be in-flight) */
  cwnd: number;
  /** Slow start threshold */
  ssthresh: number;
  /** Current state */
  state: CongestionState;
  /** Last update timestamp */
  lastUpdate: number;
}

/** Session-level congestion metrics */
export interface CongestionMetrics {
  sessionId: string;
  algorithm: CongestionAlgorithm;
  window: CongestionWindow;
  bandwidth: BandwidthEstimate;
  
  // Statistics
  totalSent: number;
  totalAcked: number;
  totalLost: number;
  avgRtt: number;
  rttVariance: number;
  
  // Performance
  throughput: number;        // Concepts/second achieved
  utilization: number;       // cwnd utilization (0-1)
  goodput: number;           // Useful throughput (excluding retransmits)
}

/** Configuration for congestion controller */
export interface CongestionConfig {
  algorithm: CongestionAlgorithm;
  
  // Window bounds
  initialCwnd: number;      // Initial window (default: 4)
  minCwnd: number;          // Never go below (default: 2)
  maxCwnd: number;          // Never exceed (default: 1000)
  
  // Slow start
  initialSsthresh: number;  // Initial threshold (default: 64)
  
  // Timeouts
  initialRto: number;       // Initial retransmit timeout (default: 1000ms)
  minRto: number;           // Minimum RTO (default: 200ms)
  maxRto: number;           // Maximum RTO (default: 60000ms)
  
  // BBR-specific
  bbrProbeBwGain: number;   // Probe bandwidth gain (default: 1.25)
  bbrDrainGain: number;     // Drain gain (default: 0.75)
  bbrRttWindowMs: number;   // RTT measurement window (default: 10000)
  
  // Cognitive-specific
  loadWeight: number;       // Weight for load signals (default: 0.3)
  comprehensionWeight: number; // Weight for comprehension (default: 0.4)
  latencyWeight: number;    // Weight for latency (default: 0.3)
  
  // Recovery
  fastRecoveryEnabled: boolean;
  maxConsecutiveLosses: number;  // Before timeout recovery
}

// =============================================================================
// RTT Estimator (Jacobson/Karels algorithm)
// =============================================================================

export class RttEstimator {
  private srtt: number = 0;        // Smoothed RTT
  private rttvar: number = 0;      // RTT variance
  private rto: number;             // Retransmit timeout
  private samples: number = 0;
  
  private readonly minRto: number;
  private readonly maxRto: number;
  private readonly alpha = 0.125;  // SRTT smoothing factor
  private readonly beta = 0.25;    // RTTVAR smoothing factor
  
  constructor(initialRto: number, minRto: number, maxRto: number) {
    this.rto = initialRto;
    this.minRto = minRto;
    this.maxRto = maxRto;
  }
  
  /** Add new RTT sample */
  addSample(rtt: number): void {
    this.samples++;
    
    if (this.samples === 1) {
      // First measurement
      this.srtt = rtt;
      this.rttvar = rtt / 2;
    } else {
      // Jacobson/Karels algorithm
      const delta = Math.abs(this.srtt - rtt);
      this.rttvar = (1 - this.beta) * this.rttvar + this.beta * delta;
      this.srtt = (1 - this.alpha) * this.srtt + this.alpha * rtt;
    }
    
    // Update RTO: RTO = SRTT + 4 * RTTVAR
    this.rto = Math.max(
      this.minRto,
      Math.min(this.maxRto, this.srtt + 4 * this.rttvar)
    );
  }
  
  /** Backoff RTO on timeout (double it) */
  backoff(): void {
    this.rto = Math.min(this.maxRto, this.rto * 2);
  }
  
  getSrtt(): number { return this.srtt; }
  getRttVar(): number { return this.rttvar; }
  getRto(): number { return this.rto; }
  getSampleCount(): number { return this.samples; }
}

// =============================================================================
// Congestion Controller Base
// =============================================================================

export abstract class CongestionController extends EventEmitter {
  protected sessionId: string;
  protected config: CongestionConfig;
  protected window: CongestionWindow;
  protected rttEstimator: RttEstimator;
  protected bandwidth: BandwidthEstimate;
  
  // Tracking
  protected inFlight: number = 0;
  protected totalSent: number = 0;
  protected totalAcked: number = 0;
  protected totalLost: number = 0;
  protected consecutiveLosses: number = 0;
  
  // History for analysis
  protected loadHistory: CognitiveLoadSignal[] = [];
  protected eventHistory: CongestionEvent[] = [];
  
  constructor(sessionId: string, config: Partial<CongestionConfig> = {}) {
    super();
    this.sessionId = sessionId;
    this.config = this.mergeConfig(config);
    
    this.window = {
      cwnd: this.config.initialCwnd,
      ssthresh: this.config.initialSsthresh,
      state: 'slow-start',
      lastUpdate: Date.now()
    };
    
    this.rttEstimator = new RttEstimator(
      this.config.initialRto,
      this.config.minRto,
      this.config.maxRto
    );
    
    this.bandwidth = {
      maxBandwidth: 0,
      minRtt: Infinity,
      bdp: 0,
      confidence: 0,
      samples: 0
    };
  }
  
  private mergeConfig(partial: Partial<CongestionConfig>): CongestionConfig {
    return {
      algorithm: partial.algorithm ?? 'cubic',
      initialCwnd: partial.initialCwnd ?? 4,
      minCwnd: partial.minCwnd ?? 2,
      maxCwnd: partial.maxCwnd ?? 1000,
      initialSsthresh: partial.initialSsthresh ?? 64,
      initialRto: partial.initialRto ?? 1000,
      minRto: partial.minRto ?? 200,
      maxRto: partial.maxRto ?? 60000,
      bbrProbeBwGain: partial.bbrProbeBwGain ?? 1.25,
      bbrDrainGain: partial.bbrDrainGain ?? 0.75,
      bbrRttWindowMs: partial.bbrRttWindowMs ?? 10000,
      loadWeight: partial.loadWeight ?? 0.3,
      comprehensionWeight: partial.comprehensionWeight ?? 0.4,
      latencyWeight: partial.latencyWeight ?? 0.3,
      fastRecoveryEnabled: partial.fastRecoveryEnabled ?? true,
      maxConsecutiveLosses: partial.maxConsecutiveLosses ?? 3
    };
  }
  
  // -------------------------------------------------------------------------
  // Core Interface
  // -------------------------------------------------------------------------
  
  /** Check if we can send more (within congestion window) */
  canSend(): boolean {
    return this.inFlight < Math.floor(this.window.cwnd);
  }
  
  /** Get available window (how many more can we send) */
  getAvailableWindow(): number {
    return Math.max(0, Math.floor(this.window.cwnd) - this.inFlight);
  }
  
  /** Record that we sent something */
  onSend(): void {
    this.inFlight++;
    this.totalSent++;
  }
  
  /** Record successful acknowledgment with RTT */
  onAck(rtt: number): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.totalAcked++;
    this.consecutiveLosses = 0;
    
    // Update RTT estimate
    this.rttEstimator.addSample(rtt);
    
    // Update bandwidth estimate
    this.updateBandwidthEstimate(rtt);
    
    // Algorithm-specific window adjustment
    this.onAckReceived(rtt);
    
    this.window.lastUpdate = Date.now();
    this.emit('ack', { rtt, cwnd: this.window.cwnd, state: this.window.state });
  }
  
  /** Record loss detection */
  onLoss(event: Partial<CongestionEvent> = {}): void {
    this.totalLost++;
    this.consecutiveLosses++;
    this.inFlight = Math.max(0, this.inFlight - 1);
    
    const congestionEvent: CongestionEvent = {
      type: event.type ?? 'loss',
      timestamp: Date.now(),
      severity: event.severity ?? 0.5,
      details: event.details
    };
    
    this.eventHistory.push(congestionEvent);
    if (this.eventHistory.length > 100) {
      this.eventHistory.shift();
    }
    
    // Check for severe loss
    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      this.onTimeout();
      return;
    }
    
    // Algorithm-specific loss handling
    this.onLossDetected(congestionEvent);
    
    this.window.lastUpdate = Date.now();
    this.emit('loss', { event: congestionEvent, cwnd: this.window.cwnd, state: this.window.state });
  }
  
  /** Handle timeout (severe congestion) */
  onTimeout(): void {
    this.rttEstimator.backoff();
    
    // TCP timeout: ssthresh = cwnd/2, cwnd = 1 (or minCwnd)
    this.window.ssthresh = Math.max(this.config.minCwnd, Math.floor(this.window.cwnd / 2));
    this.window.cwnd = this.config.minCwnd;
    this.window.state = 'timeout-recovery';
    this.consecutiveLosses = 0;
    
    this.emit('timeout', { 
      newCwnd: this.window.cwnd, 
      newSsthresh: this.window.ssthresh,
      rto: this.rttEstimator.getRto()
    });
  }
  
  /** Process cognitive load signal from receiver */
  onCognitiveLoadSignal(signal: CognitiveLoadSignal): void {
    this.loadHistory.push(signal);
    if (this.loadHistory.length > 50) {
      this.loadHistory.shift();
    }
    
    // Calculate composite load score
    const loadScore = this.calculateLoadScore(signal);
    
    // Explicit backpressure is treated as loss
    if (signal.explicitBackpressure) {
      this.onLoss({ type: 'load-spike', severity: 0.8 });
      return;
    }
    
    // Loss detected by receiver
    if (signal.lossDetected) {
      this.onLoss({ type: 'loss', severity: 0.6 });
      return;
    }
    
    // Comprehension drop is a quality signal
    if (signal.comprehensionScore < 0.5) {
      this.onLoss({ 
        type: 'comprehension-drop', 
        severity: 1 - signal.comprehensionScore,
        details: { comprehensionScore: signal.comprehensionScore }
      });
      return;
    }
    
    // Adjust window based on load (proactive congestion avoidance)
    this.adjustForLoad(loadScore, signal);
    
    this.emit('load-signal', { signal, loadScore, cwnd: this.window.cwnd });
  }
  
  /** Calculate composite load score (0 = no load, 1 = overloaded) */
  private calculateLoadScore(signal: CognitiveLoadSignal): number {
    const { loadWeight, comprehensionWeight, latencyWeight } = this.config;
    
    // Invert comprehension (high = good, we want high = bad for load)
    const comprehensionLoad = 1 - signal.comprehensionScore;
    
    // Normalize latency (assume >5000ms is fully loaded)
    const latencyLoad = Math.min(1, signal.responseLatency / 5000);
    
    // Average of explicit load indicators
    const directLoad = (
      signal.processingLoad + 
      signal.memoryPressure + 
      signal.contextSaturation
    ) / 3;
    
    return (
      directLoad * loadWeight +
      comprehensionLoad * comprehensionWeight +
      latencyLoad * latencyWeight
    );
  }
  
  /** Proactively adjust window based on load signals */
  private adjustForLoad(loadScore: number, signal: CognitiveLoadSignal): void {
    if (loadScore > 0.8) {
      // High load: reduce window proactively (like ECN)
      this.window.cwnd = Math.max(
        this.config.minCwnd,
        this.window.cwnd * 0.8
      );
      this.window.state = 'congestion-avoidance';
    } else if (loadScore > 0.6) {
      // Medium load: slow down growth
      // (handled by algorithm-specific adjustments)
    } else if (loadScore < 0.3 && this.window.state === 'congestion-avoidance') {
      // Low load: can be more aggressive
      // Allow faster growth (algorithm-specific)
      this.onLowLoad(loadScore);
    }
  }
  
  /** Update bandwidth estimate for BBR */
  private updateBandwidthEstimate(rtt: number): void {
    // Track minimum RTT
    if (rtt < this.bandwidth.minRtt) {
      this.bandwidth.minRtt = rtt;
    }
    
    // Estimate bandwidth from delivery rate
    const deliveryRate = this.totalAcked / ((Date.now() - this.window.lastUpdate) / 1000 || 1);
    
    if (deliveryRate > this.bandwidth.maxBandwidth) {
      this.bandwidth.maxBandwidth = deliveryRate;
    }
    
    // Bandwidth-delay product
    this.bandwidth.bdp = this.bandwidth.maxBandwidth * (this.bandwidth.minRtt / 1000);
    
    // Update confidence based on samples
    this.bandwidth.samples++;
    this.bandwidth.confidence = Math.min(1, this.bandwidth.samples / 20);
  }
  
  // -------------------------------------------------------------------------
  // Abstract methods for algorithm implementations
  // -------------------------------------------------------------------------
  
  protected abstract onAckReceived(rtt: number): void;
  protected abstract onLossDetected(event: CongestionEvent): void;
  protected abstract onLowLoad(loadScore: number): void;
  
  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------
  
  getMetrics(): CongestionMetrics {
    const elapsed = (Date.now() - this.window.lastUpdate) / 1000 || 1;
    
    return {
      sessionId: this.sessionId,
      algorithm: this.config.algorithm,
      window: { ...this.window },
      bandwidth: { ...this.bandwidth },
      totalSent: this.totalSent,
      totalAcked: this.totalAcked,
      totalLost: this.totalLost,
      avgRtt: this.rttEstimator.getSrtt(),
      rttVariance: this.rttEstimator.getRttVar(),
      throughput: this.totalAcked / elapsed,
      utilization: this.inFlight / this.window.cwnd,
      goodput: (this.totalAcked - this.totalLost) / elapsed
    };
  }
  
  getWindow(): CongestionWindow {
    return { ...this.window };
  }
  
  getRto(): number {
    return this.rttEstimator.getRto();
  }
}

// =============================================================================
// TCP Reno Implementation
// =============================================================================

export class RenoCongestionController extends CongestionController {
  private dupAckCount: number = 0;
  
  constructor(sessionId: string, config: Partial<CongestionConfig> = {}) {
    super(sessionId, { ...config, algorithm: 'reno' });
  }
  
  protected onAckReceived(rtt: number): void {
    this.dupAckCount = 0;
    
    if (this.window.state === 'slow-start') {
      // Exponential growth: cwnd += 1 for each ACK
      this.window.cwnd = Math.min(this.config.maxCwnd, this.window.cwnd + 1);
      
      // Exit slow start when we hit threshold
      if (this.window.cwnd >= this.window.ssthresh) {
        this.window.state = 'congestion-avoidance';
      }
    } else if (this.window.state === 'congestion-avoidance') {
      // Linear growth: cwnd += 1/cwnd for each ACK (1 per RTT)
      this.window.cwnd = Math.min(
        this.config.maxCwnd,
        this.window.cwnd + 1 / this.window.cwnd
      );
    } else if (this.window.state === 'fast-recovery') {
      // Exit fast recovery after new ACK
      this.window.cwnd = this.window.ssthresh;
      this.window.state = 'congestion-avoidance';
    } else if (this.window.state === 'timeout-recovery') {
      // Back to slow start
      this.window.state = 'slow-start';
    }
  }
  
  protected onLossDetected(event: CongestionEvent): void {
    if (this.config.fastRecoveryEnabled && this.window.state !== 'fast-recovery') {
      // Fast recovery: ssthresh = cwnd/2, cwnd = ssthresh + 3
      this.window.ssthresh = Math.max(this.config.minCwnd, Math.floor(this.window.cwnd / 2));
      this.window.cwnd = this.window.ssthresh + 3;
      this.window.state = 'fast-recovery';
    } else if (this.window.state === 'fast-recovery') {
      // Additional loss in fast recovery: inflate window
      this.window.cwnd += 1;
    } else {
      // No fast recovery: multiplicative decrease
      this.window.ssthresh = Math.max(this.config.minCwnd, Math.floor(this.window.cwnd / 2));
      this.window.cwnd = this.window.ssthresh;
      this.window.state = 'congestion-avoidance';
    }
  }
  
  protected onLowLoad(loadScore: number): void {
    // Reno doesn't accelerate on low load, stays conservative
  }
}

// =============================================================================
// TCP Cubic Implementation
// =============================================================================

export class CubicCongestionController extends CongestionController {
  private wMax: number = 0;         // Window size before last reduction
  private k: number = 0;            // Time to reach wMax
  private epochStart: number = 0;   // Start of current epoch
  
  private readonly beta = 0.7;      // Multiplicative decrease factor
  private readonly c = 0.4;         // Cubic scaling constant
  
  constructor(sessionId: string, config: Partial<CongestionConfig> = {}) {
    super(sessionId, { ...config, algorithm: 'cubic' });
  }
  
  protected onAckReceived(rtt: number): void {
    if (this.window.state === 'slow-start') {
      // Slow start same as Reno
      this.window.cwnd = Math.min(this.config.maxCwnd, this.window.cwnd + 1);
      
      if (this.window.cwnd >= this.window.ssthresh) {
        this.window.state = 'congestion-avoidance';
        this.epochStart = Date.now();
        this.k = Math.cbrt(this.wMax * (1 - this.beta) / this.c);
      }
    } else if (this.window.state === 'congestion-avoidance') {
      // Cubic growth
      const t = (Date.now() - this.epochStart) / 1000; // seconds since epoch
      const cubicCwnd = this.c * Math.pow(t - this.k, 3) + this.wMax;
      
      // TCP-friendly region (linear increase like Reno)
      const tcpCwnd = this.wMax * this.beta + (3 * (1 - this.beta) / (1 + this.beta)) * (t / this.rttEstimator.getSrtt() * 1000);
      
      // Use maximum of cubic and tcp-friendly
      this.window.cwnd = Math.min(
        this.config.maxCwnd,
        Math.max(cubicCwnd, tcpCwnd)
      );
    } else if (this.window.state === 'fast-recovery') {
      this.window.cwnd = this.window.ssthresh;
      this.window.state = 'congestion-avoidance';
      this.epochStart = Date.now();
    } else if (this.window.state === 'timeout-recovery') {
      this.window.state = 'slow-start';
    }
  }
  
  protected onLossDetected(event: CongestionEvent): void {
    // Save window before reduction
    this.wMax = this.window.cwnd;
    
    // Multiplicative decrease
    this.window.ssthresh = Math.max(
      this.config.minCwnd,
      Math.floor(this.window.cwnd * this.beta)
    );
    
    if (this.config.fastRecoveryEnabled) {
      this.window.cwnd = this.window.ssthresh;
      this.window.state = 'fast-recovery';
    } else {
      this.window.cwnd = this.window.ssthresh;
      this.window.state = 'congestion-avoidance';
    }
    
    // Reset epoch
    this.epochStart = Date.now();
    this.k = Math.cbrt(this.wMax * (1 - this.beta) / this.c);
  }
  
  protected onLowLoad(loadScore: number): void {
    // Cubic can be more aggressive on low load
    // Increase wMax to allow faster convergence
    if (loadScore < 0.2 && this.wMax > 0) {
      this.wMax *= 1.05;
    }
  }
}

// =============================================================================
// BBR-style Implementation (Bandwidth-Based)
// =============================================================================

type BbrState = 'startup' | 'drain' | 'probe_bw' | 'probe_rtt';

export class BbrCongestionController extends CongestionController {
  private bbrState: BbrState = 'startup';
  private cycleIndex: number = 0;
  private lastRttProbe: number = 0;
  private filledPipe: boolean = false;
  
  // Pacing gains for ProbeBW cycle
  private readonly pacingGains = [1.25, 0.75, 1, 1, 1, 1, 1, 1];
  
  constructor(sessionId: string, config: Partial<CongestionConfig> = {}) {
    super(sessionId, { ...config, algorithm: 'bbr' });
  }
  
  protected onAckReceived(rtt: number): void {
    // Update bandwidth model
    if (this.bandwidth.confidence > 0.3) {
      this.updateBbrState(rtt);
    }
    
    // Set cwnd based on BDP * gain
    const gain = this.getCurrentGain();
    const targetCwnd = Math.max(
      this.config.minCwnd,
      Math.min(this.config.maxCwnd, this.bandwidth.bdp * gain)
    );
    
    // Smooth transition
    this.window.cwnd = this.window.cwnd * 0.7 + targetCwnd * 0.3;
    
    // BBR doesn't use traditional slow-start/congestion-avoidance states
    // But we map for compatibility
    this.window.state = this.bbrState === 'startup' ? 'slow-start' : 'congestion-avoidance';
  }
  
  private updateBbrState(rtt: number): void {
    const now = Date.now();
    
    switch (this.bbrState) {
      case 'startup':
        // Exit startup when bandwidth stops growing
        if (this.bandwidth.maxBandwidth > 0 && this.filledPipe) {
          this.bbrState = 'drain';
        }
        // Check if pipe is filled (bandwidth plateau)
        if (this.bandwidth.samples > 10) {
          this.filledPipe = true;
        }
        break;
        
      case 'drain':
        // Drain inflight to BDP
        if (this.inFlight <= this.bandwidth.bdp) {
          this.bbrState = 'probe_bw';
          this.cycleIndex = 0;
        }
        break;
        
      case 'probe_bw':
        // Cycle through pacing gains
        this.cycleIndex = (this.cycleIndex + 1) % this.pacingGains.length;
        
        // Periodically probe RTT
        if (now - this.lastRttProbe > this.config.bbrRttWindowMs) {
          this.bbrState = 'probe_rtt';
          this.lastRttProbe = now;
        }
        break;
        
      case 'probe_rtt':
        // Reduce window to probe true RTT
        this.window.cwnd = this.config.minCwnd;
        
        // Return to probe_bw after one RTT
        if (now - this.lastRttProbe > this.rttEstimator.getSrtt()) {
          this.bbrState = 'probe_bw';
          this.bandwidth.minRtt = rtt; // Update minRtt
        }
        break;
    }
  }
  
  private getCurrentGain(): number {
    switch (this.bbrState) {
      case 'startup':
        return 2.89; // 2/ln(2) - aggressive startup
      case 'drain':
        return this.config.bbrDrainGain;
      case 'probe_bw':
        return this.pacingGains[this.cycleIndex];
      case 'probe_rtt':
        return 1;
      default:
        return 1;
    }
  }
  
  protected onLossDetected(event: CongestionEvent): void {
    // BBR doesn't react to loss the same way
    // It trusts its bandwidth model more than loss signals
    
    // But for cognitive context, we should be more careful
    if (event.severity > 0.7) {
      // Significant loss: reduce bandwidth estimate
      this.bandwidth.maxBandwidth *= 0.9;
      this.bandwidth.confidence *= 0.8;
    }
    
    // Comprehension drops are important for AI
    if (event.type === 'comprehension-drop') {
      this.bandwidth.maxBandwidth *= 0.8;
      this.bbrState = 'drain';
    }
  }
  
  protected onLowLoad(loadScore: number): void {
    // BBR can probe more aggressively on low load
    if (this.bbrState === 'probe_bw' && loadScore < 0.2) {
      this.bandwidth.maxBandwidth *= 1.1;
    }
  }
  
  getBbrState(): BbrState {
    return this.bbrState;
  }
}

// =============================================================================
// Adaptive Controller (auto-selects algorithm)
// =============================================================================

export class AdaptiveCongestionController extends CongestionController {
  private delegate: CongestionController;
  private recentPerformance: Array<{ algorithm: CongestionAlgorithm; throughput: number; loss: number }> = [];
  
  constructor(sessionId: string, config: Partial<CongestionConfig> = {}) {
    super(sessionId, { ...config, algorithm: 'adaptive' });
    
    // Start with Cubic as default
    this.delegate = new CubicCongestionController(sessionId, config);
  }
  
  protected onAckReceived(rtt: number): void {
    this.delegate.onAck(rtt);
    this.syncFromDelegate();
    this.maybeSwitch();
  }
  
  protected onLossDetected(event: CongestionEvent): void {
    this.delegate.onLoss(event);
    this.syncFromDelegate();
    this.maybeSwitch();
  }
  
  protected onLowLoad(loadScore: number): void {
    // Delegate handles this
  }
  
  private syncFromDelegate(): void {
    const metrics = this.delegate.getMetrics();
    this.window = { ...metrics.window };
    this.bandwidth = { ...metrics.bandwidth };
  }
  
  private maybeSwitch(): void {
    // Record performance periodically
    if (this.totalAcked % 50 === 0) {
      const metrics = this.delegate.getMetrics();
      this.recentPerformance.push({
        algorithm: metrics.algorithm,
        throughput: metrics.throughput,
        loss: metrics.totalLost / Math.max(1, metrics.totalSent)
      });
      
      if (this.recentPerformance.length > 10) {
        this.recentPerformance.shift();
      }
    }
    
    // Consider switching every 100 acks
    if (this.totalAcked % 100 === 0 && this.recentPerformance.length >= 5) {
      this.evaluateSwitch();
    }
  }
  
  private evaluateSwitch(): void {
    const current = this.delegate.getMetrics();
    const lossRate = current.totalLost / Math.max(1, current.totalSent);
    
    // High loss with Cubic? Try Reno (more conservative)
    if (current.algorithm === 'cubic' && lossRate > 0.1) {
      this.switchTo('reno');
      return;
    }
    
    // Stable with good bandwidth info? Try BBR
    if (lossRate < 0.02 && this.bandwidth.confidence > 0.7 && current.algorithm !== 'bbr') {
      this.switchTo('bbr');
      return;
    }
    
    // BBR not working well? Fall back to Cubic
    if (current.algorithm === 'bbr' && (lossRate > 0.05 || this.bandwidth.confidence < 0.5)) {
      this.switchTo('cubic');
      return;
    }
  }
  
  private switchTo(algorithm: CongestionAlgorithm): void {
    const config = this.config;
    const oldMetrics = this.delegate.getMetrics();
    
    switch (algorithm) {
      case 'reno':
        this.delegate = new RenoCongestionController(this.sessionId, config);
        break;
      case 'cubic':
        this.delegate = new CubicCongestionController(this.sessionId, config);
        break;
      case 'bbr':
        this.delegate = new BbrCongestionController(this.sessionId, config);
        break;
    }
    
    // Preserve some state
    this.delegate.getMetrics(); // Initialize
    
    this.emit('algorithm-switch', {
      from: oldMetrics.algorithm,
      to: algorithm,
      reason: 'adaptive-evaluation'
    });
  }
  
  override onCognitiveLoadSignal(signal: CognitiveLoadSignal): void {
    // Forward to delegate and sync
    (this.delegate as any).onCognitiveLoadSignal?.(signal);
    super.onCognitiveLoadSignal(signal);
  }
  
  getCurrentAlgorithm(): CongestionAlgorithm {
    return this.delegate.getMetrics().algorithm;
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createCongestionController(
  sessionId: string,
  algorithm: CongestionAlgorithm = 'adaptive',
  config: Partial<CongestionConfig> = {}
): CongestionController {
  switch (algorithm) {
    case 'reno':
      return new RenoCongestionController(sessionId, config);
    case 'cubic':
      return new CubicCongestionController(sessionId, config);
    case 'bbr':
      return new BbrCongestionController(sessionId, config);
    case 'adaptive':
    default:
      return new AdaptiveCongestionController(sessionId, config);
  }
}

// =============================================================================
// Integration with Context Handshake
// =============================================================================

export interface CongestionAwareSession {
  sessionId: string;
  congestion: CongestionController;
  pendingContextChunks: Array<{ id: string; sentAt: number; content: unknown }>;
  
  /** Check if we can send more context */
  canSendMore(): boolean;
  
  /** Send context chunk with congestion control */
  sendContextChunk(content: unknown): Promise<{ id: string; queued: boolean }>;
  
  /** Acknowledge received context */
  acknowledgeContext(chunkId: string): void;
  
  /** Report cognitive load */
  reportLoad(signal: Omit<CognitiveLoadSignal, 'timestamp' | 'receiverId'>): void;
}

export function createCongestionAwareSession(
  sessionId: string,
  peerId: string,
  algorithm: CongestionAlgorithm = 'adaptive',
  config: Partial<CongestionConfig> = {}
): CongestionAwareSession {
  const congestion = createCongestionController(sessionId, algorithm, config);
  const pendingChunks: Array<{ id: string; sentAt: number; content: unknown }> = [];
  
  return {
    sessionId,
    congestion,
    pendingContextChunks: pendingChunks,
    
    canSendMore(): boolean {
      return congestion.canSend();
    },
    
    async sendContextChunk(content: unknown): Promise<{ id: string; queued: boolean }> {
      const id = `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      if (!congestion.canSend()) {
        return { id, queued: true };
      }
      
      congestion.onSend();
      pendingChunks.push({ id, sentAt: Date.now(), content });
      
      return { id, queued: false };
    },
    
    acknowledgeContext(chunkId: string): void {
      const idx = pendingChunks.findIndex(c => c.id === chunkId);
      if (idx >= 0) {
        const chunk = pendingChunks[idx];
        const rtt = Date.now() - chunk.sentAt;
        congestion.onAck(rtt);
        pendingChunks.splice(idx, 1);
      }
    },
    
    reportLoad(signal: Omit<CognitiveLoadSignal, 'timestamp' | 'receiverId'>): void {
      congestion.onCognitiveLoadSignal({
        ...signal,
        timestamp: Date.now(),
        receiverId: peerId
      });
    }
  };
}

// =============================================================================
// Exports
// =============================================================================

export default {
  // Controllers
  CongestionController,
  RenoCongestionController,
  CubicCongestionController,
  BbrCongestionController,
  AdaptiveCongestionController,
  
  // Utilities
  RttEstimator,
  createCongestionController,
  createCongestionAwareSession
};
