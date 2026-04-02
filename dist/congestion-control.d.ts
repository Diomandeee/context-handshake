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
/** Congestion control algorithm variants */
export type CongestionAlgorithm = 'reno' | 'cubic' | 'bbr' | 'adaptive';
/** Current congestion state (like TCP state machine) */
export type CongestionState = 'slow-start' | 'congestion-avoidance' | 'fast-recovery' | 'timeout-recovery';
/** Cognitive load signal from receiver */
export interface CognitiveLoadSignal {
    timestamp: number;
    receiverId: string;
    processingLoad: number;
    memoryPressure: number;
    contextSaturation: number;
    comprehensionScore: number;
    responseLatency: number;
    explicitBackpressure?: boolean;
    lossDetected?: boolean;
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
    severity: number;
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
    totalSent: number;
    totalAcked: number;
    totalLost: number;
    avgRtt: number;
    rttVariance: number;
    throughput: number;
    utilization: number;
    goodput: number;
}
/** Configuration for congestion controller */
export interface CongestionConfig {
    algorithm: CongestionAlgorithm;
    initialCwnd: number;
    minCwnd: number;
    maxCwnd: number;
    initialSsthresh: number;
    initialRto: number;
    minRto: number;
    maxRto: number;
    bbrProbeBwGain: number;
    bbrDrainGain: number;
    bbrRttWindowMs: number;
    loadWeight: number;
    comprehensionWeight: number;
    latencyWeight: number;
    fastRecoveryEnabled: boolean;
    maxConsecutiveLosses: number;
}
export declare class RttEstimator {
    private srtt;
    private rttvar;
    private rto;
    private samples;
    private readonly minRto;
    private readonly maxRto;
    private readonly alpha;
    private readonly beta;
    constructor(initialRto: number, minRto: number, maxRto: number);
    /** Add new RTT sample */
    addSample(rtt: number): void;
    /** Backoff RTO on timeout (double it) */
    backoff(): void;
    getSrtt(): number;
    getRttVar(): number;
    getRto(): number;
    getSampleCount(): number;
}
export declare abstract class CongestionController extends EventEmitter {
    protected sessionId: string;
    protected config: CongestionConfig;
    protected window: CongestionWindow;
    protected rttEstimator: RttEstimator;
    protected bandwidth: BandwidthEstimate;
    protected inFlight: number;
    protected totalSent: number;
    protected totalAcked: number;
    protected totalLost: number;
    protected consecutiveLosses: number;
    protected loadHistory: CognitiveLoadSignal[];
    protected eventHistory: CongestionEvent[];
    constructor(sessionId: string, config?: Partial<CongestionConfig>);
    private mergeConfig;
    /** Check if we can send more (within congestion window) */
    canSend(): boolean;
    /** Get available window (how many more can we send) */
    getAvailableWindow(): number;
    /** Record that we sent something */
    onSend(): void;
    /** Record successful acknowledgment with RTT */
    onAck(rtt: number): void;
    /** Record loss detection */
    onLoss(event?: Partial<CongestionEvent>): void;
    /** Handle timeout (severe congestion) */
    onTimeout(): void;
    /** Process cognitive load signal from receiver */
    onCognitiveLoadSignal(signal: CognitiveLoadSignal): void;
    /** Calculate composite load score (0 = no load, 1 = overloaded) */
    private calculateLoadScore;
    /** Proactively adjust window based on load signals */
    private adjustForLoad;
    /** Update bandwidth estimate for BBR */
    private updateBandwidthEstimate;
    protected abstract onAckReceived(rtt: number): void;
    protected abstract onLossDetected(event: CongestionEvent): void;
    protected abstract onLowLoad(loadScore: number): void;
    getMetrics(): CongestionMetrics;
    getWindow(): CongestionWindow;
    getRto(): number;
}
export declare class RenoCongestionController extends CongestionController {
    private dupAckCount;
    constructor(sessionId: string, config?: Partial<CongestionConfig>);
    protected onAckReceived(rtt: number): void;
    protected onLossDetected(event: CongestionEvent): void;
    protected onLowLoad(loadScore: number): void;
}
export declare class CubicCongestionController extends CongestionController {
    private wMax;
    private k;
    private epochStart;
    private readonly beta;
    private readonly c;
    constructor(sessionId: string, config?: Partial<CongestionConfig>);
    protected onAckReceived(rtt: number): void;
    protected onLossDetected(event: CongestionEvent): void;
    protected onLowLoad(loadScore: number): void;
}
type BbrState = 'startup' | 'drain' | 'probe_bw' | 'probe_rtt';
export declare class BbrCongestionController extends CongestionController {
    private bbrState;
    private cycleIndex;
    private lastRttProbe;
    private filledPipe;
    private readonly pacingGains;
    constructor(sessionId: string, config?: Partial<CongestionConfig>);
    protected onAckReceived(rtt: number): void;
    private updateBbrState;
    private getCurrentGain;
    protected onLossDetected(event: CongestionEvent): void;
    protected onLowLoad(loadScore: number): void;
    getBbrState(): BbrState;
}
export declare class AdaptiveCongestionController extends CongestionController {
    private delegate;
    private recentPerformance;
    constructor(sessionId: string, config?: Partial<CongestionConfig>);
    protected onAckReceived(rtt: number): void;
    protected onLossDetected(event: CongestionEvent): void;
    protected onLowLoad(loadScore: number): void;
    private syncFromDelegate;
    private maybeSwitch;
    private evaluateSwitch;
    private switchTo;
    onCognitiveLoadSignal(signal: CognitiveLoadSignal): void;
    getCurrentAlgorithm(): CongestionAlgorithm;
}
export declare function createCongestionController(sessionId: string, algorithm?: CongestionAlgorithm, config?: Partial<CongestionConfig>): CongestionController;
export interface CongestionAwareSession {
    sessionId: string;
    congestion: CongestionController;
    pendingContextChunks: Array<{
        id: string;
        sentAt: number;
        content: unknown;
    }>;
    /** Check if we can send more context */
    canSendMore(): boolean;
    /** Send context chunk with congestion control */
    sendContextChunk(content: unknown): Promise<{
        id: string;
        queued: boolean;
    }>;
    /** Acknowledge received context */
    acknowledgeContext(chunkId: string): void;
    /** Report cognitive load */
    reportLoad(signal: Omit<CognitiveLoadSignal, 'timestamp' | 'receiverId'>): void;
}
export declare function createCongestionAwareSession(sessionId: string, peerId: string, algorithm?: CongestionAlgorithm, config?: Partial<CongestionConfig>): CongestionAwareSession;
declare const _default: {
    CongestionController: typeof CongestionController;
    RenoCongestionController: typeof RenoCongestionController;
    CubicCongestionController: typeof CubicCongestionController;
    BbrCongestionController: typeof BbrCongestionController;
    AdaptiveCongestionController: typeof AdaptiveCongestionController;
    RttEstimator: typeof RttEstimator;
    createCongestionController: typeof createCongestionController;
    createCongestionAwareSession: typeof createCongestionAwareSession;
};
export default _default;
