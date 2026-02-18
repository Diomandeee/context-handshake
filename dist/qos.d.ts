/**
 * Quality of Service (QoS) for Context Handshake Protocol
 *
 * Like DSCP/TOS in TCP/IP, but for mental model exchange.
 * Ensures critical context (safety signals, corrections) gets
 * priority over background synchronization.
 *
 * HEF Evolution: Instance 28, Generation 6
 * Task ID: task_20260202172813_60f3ad
 */
import { EventEmitter } from 'events';
/**
 * Traffic classes for context exchange (inspired by DSCP)
 * Higher number = higher priority
 */
export declare enum TrafficClass {
    /** Background sync, non-urgent updates */
    BACKGROUND = 0,
    /** Standard context exchange */
    BEST_EFFORT = 1,
    /** Important but not critical */
    ASSURED = 2,
    /** Time-sensitive collaborative work */
    INTERACTIVE = 3,
    /** Critical corrections, safety signals */
    CRITICAL = 4,
    /** Emergency override - safety/shutdown */
    EMERGENCY = 5
}
/**
 * QoS marking for context packets
 */
export interface QoSMarking {
    /** Traffic class for prioritization */
    trafficClass: TrafficClass;
    /** Drop precedence within class (0=low drop, 2=high drop) */
    dropPrecedence: 0 | 1 | 2;
    /** Explicit congestion notification */
    ecn: 'not-ect' | 'ect0' | 'ect1' | 'ce';
    /** Time-to-live for the context (hops or ms) */
    ttl: number;
    /** Timestamp for latency measurement */
    timestamp: number;
}
/**
 * Context packet with QoS metadata
 */
export interface QoSPacket<T = unknown> {
    id: string;
    payload: T;
    marking: QoSMarking;
    /** Sequence number for ordering */
    seq: number;
    /** Source agent ID */
    source: string;
    /** Destination agent ID */
    destination: string;
    /** Context type for classification */
    contextType: ContextType;
}
/**
 * Context types that map to traffic classes
 */
export declare enum ContextType {
    /** Heartbeat/keepalive */
    HEARTBEAT = "heartbeat",
    /** Background model sync */
    SYNC = "sync",
    /** Standard context update */
    UPDATE = "update",
    /** Collaborative working memory */
    WORKING_MEMORY = "working_memory",
    /** Real-time collaboration */
    REALTIME = "realtime",
    /** Correction to shared understanding */
    CORRECTION = "correction",
    /** Safety-related signal */
    SAFETY = "safety",
    /** System emergency */
    EMERGENCY = "emergency"
}
/**
 * Queue configuration per traffic class
 */
export interface QueueConfig {
    /** Maximum queue depth */
    maxDepth: number;
    /** Weight for weighted fair queuing */
    weight: number;
    /** Minimum guaranteed bandwidth (0-1) */
    minBandwidth: number;
    /** Maximum allowed latency (ms) */
    maxLatency: number;
    /** Enable RED (Random Early Detection) */
    enableRED: boolean;
    /** RED threshold for random drops */
    redThreshold: number;
}
/**
 * Traffic shaping policy
 */
export interface TrafficPolicy {
    /** Token bucket rate (packets/second) */
    rate: number;
    /** Burst size (packets) */
    burst: number;
    /** Peak rate limit */
    peakRate: number;
    /** Action on exceed: drop, remark, or queue */
    exceedAction: 'drop' | 'remark' | 'queue';
    /** Remark to this class if action is 'remark' */
    remarkTo?: TrafficClass;
}
/**
 * Service Level Agreement
 */
export interface SLA {
    /** Maximum latency (ms) */
    maxLatency: number;
    /** Maximum jitter (ms) */
    maxJitter: number;
    /** Minimum throughput (packets/second) */
    minThroughput: number;
    /** Maximum packet loss (0-1) */
    maxLoss: number;
    /** Availability target (0-1) */
    availability: number;
}
/**
 * QoS statistics
 */
export interface QoSStats {
    /** Packets processed per class */
    packetsProcessed: Map<TrafficClass, number>;
    /** Packets dropped per class */
    packetsDropped: Map<TrafficClass, number>;
    /** Average latency per class (ms) */
    averageLatency: Map<TrafficClass, number>;
    /** Current queue depths */
    queueDepths: Map<TrafficClass, number>;
    /** Bandwidth utilization per class */
    bandwidthUsage: Map<TrafficClass, number>;
    /** SLA violations */
    slaViolations: SLAViolation[];
    /** Timestamp */
    timestamp: number;
}
export interface SLAViolation {
    trafficClass: TrafficClass;
    metric: 'latency' | 'jitter' | 'throughput' | 'loss';
    expected: number;
    actual: number;
    timestamp: number;
}
/**
 * Automatically classifies context by type and assigns traffic class
 */
export declare class ContextClassifier {
    private rules;
    constructor();
    private initializeDefaultRules;
    private containsEmergencyKeywords;
    addRule(rule: ClassificationRule): void;
    classify(packet: Partial<QoSPacket>): QoSMarking;
    private getDefaultTTL;
}
interface ClassificationRule {
    match: (ctx: Partial<QoSPacket>) => boolean;
    trafficClass: TrafficClass;
    dropPrecedence: 0 | 1 | 2;
}
/**
 * Priority queue with weighted fair queuing
 */
export declare class PriorityQueue<T> extends EventEmitter {
    private queues;
    private configs;
    private stats;
    private deficitCounters;
    constructor();
    private initializeQueues;
    /**
     * Enqueue a packet with QoS marking
     */
    enqueue(item: T, marking: QoSMarking): boolean;
    /**
     * Dequeue using Weighted Fair Queuing (Deficit Round Robin)
     */
    dequeue(): {
        item: T;
        marking: QoSMarking;
        latency: number;
    } | null;
    private dequeueFrom;
    /**
     * Peek at next item without removing
     */
    peek(): {
        item: T;
        marking: QoSMarking;
    } | null;
    /**
     * Get current queue depths
     */
    getDepths(): Map<TrafficClass, number>;
    /**
     * Get queue statistics
     */
    getStats(): Map<TrafficClass, QueueStats>;
    /**
     * Update queue configuration
     */
    updateConfig(tc: TrafficClass, config: Partial<QueueConfig>): void;
    /**
     * Clear all queues
     */
    clear(): void;
    /**
     * Get total size across all queues
     */
    get size(): number;
}
interface QueueStats {
    enqueued: number;
    dequeued: number;
    dropped: number;
    totalLatency: number;
}
/**
 * Token bucket traffic shaper for rate limiting
 */
export declare class TrafficShaper extends EventEmitter {
    private policies;
    private buckets;
    constructor();
    private initializePolicies;
    /**
     * Shape a packet - returns action to take
     */
    shape(marking: QoSMarking): ShapeResult;
    /**
     * Update policy for a traffic class
     */
    updatePolicy(tc: TrafficClass, policy: Partial<TrafficPolicy>): void;
    /**
     * Get current token levels
     */
    getTokenLevels(): Map<TrafficClass, number>;
}
interface ShapeResult {
    action: 'pass' | 'drop' | 'remark' | 'queue';
    marking: QoSMarking;
}
/**
 * Monitors and enforces Service Level Agreements
 */
export declare class SLAMonitor extends EventEmitter {
    private slas;
    private metrics;
    private violations;
    private windowMs;
    constructor();
    private initializeSLAs;
    /**
     * Record a processed packet
     */
    recordPacket(tc: TrafficClass, latency: number, dropped?: boolean): void;
    private checkSLA;
    private calculateJitter;
    private recordViolation;
    /**
     * Get current SLA compliance status
     */
    getComplianceStatus(): Map<TrafficClass, ComplianceStatus>;
    /**
     * Update SLA for a traffic class
     */
    updateSLA(tc: TrafficClass, sla: Partial<SLA>): void;
    /**
     * Get recent violations
     */
    getViolations(since?: number): SLAViolation[];
}
interface ComplianceStatus {
    compliant: boolean;
    violationCount: number;
    currentLatency: number;
    currentThroughput: number;
    currentLossRate: number;
}
/**
 * Unified QoS Manager for Context Handshake Protocol
 */
export declare class QoSManager extends EventEmitter {
    private classifier;
    private queue;
    private shaper;
    private slaMonitor;
    private enabled;
    private seqCounter;
    constructor();
    private wireEvents;
    /**
     * Submit context for transmission
     */
    submit<T>(payload: T, contextType: ContextType, source: string, destination: string, explicitMarking?: Partial<QoSMarking>): boolean;
    /**
     * Get next packet for transmission
     */
    getNext<T = unknown>(): {
        packet: QoSPacket<T>;
        latency: number;
    } | null;
    /**
     * Process packets in batch
     */
    processBatch<T = unknown>(maxCount: number): Array<{
        packet: QoSPacket<T>;
        latency: number;
    }>;
    /**
     * Get comprehensive QoS statistics
     */
    getStats(): QoSStats;
    /**
     * Get SLA compliance status
     */
    getCompliance(): Map<TrafficClass, ComplianceStatus>;
    /**
     * Add custom classification rule
     */
    addClassificationRule(rule: ClassificationRule): void;
    /**
     * Update traffic policy
     */
    updateTrafficPolicy(tc: TrafficClass, policy: Partial<TrafficPolicy>): void;
    /**
     * Update SLA
     */
    updateSLA(tc: TrafficClass, sla: Partial<SLA>): void;
    /**
     * Update queue configuration
     */
    updateQueueConfig(tc: TrafficClass, config: Partial<QueueConfig>): void;
    /**
     * Enable/disable QoS
     */
    setEnabled(enabled: boolean): void;
    /**
     * Check if QoS is enabled
     */
    isEnabled(): boolean;
    /**
     * Get queue size
     */
    getQueueSize(): number;
    /**
     * Clear all queues
     */
    clear(): void;
}
export { ContextClassifier, PriorityQueue, TrafficShaper, SLAMonitor, QoSManager, };
export default QoSManager;
