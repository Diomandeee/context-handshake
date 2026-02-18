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

// ============================================================================
// TYPES
// ============================================================================

/**
 * Traffic classes for context exchange (inspired by DSCP)
 * Higher number = higher priority
 */
export enum TrafficClass {
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
  EMERGENCY = 5,
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
export enum ContextType {
  /** Heartbeat/keepalive */
  HEARTBEAT = 'heartbeat',
  /** Background model sync */
  SYNC = 'sync',
  /** Standard context update */
  UPDATE = 'update',
  /** Collaborative working memory */
  WORKING_MEMORY = 'working_memory',
  /** Real-time collaboration */
  REALTIME = 'realtime',
  /** Correction to shared understanding */
  CORRECTION = 'correction',
  /** Safety-related signal */
  SAFETY = 'safety',
  /** System emergency */
  EMERGENCY = 'emergency',
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

// ============================================================================
// CONTEXT TYPE CLASSIFIER
// ============================================================================

/**
 * Automatically classifies context by type and assigns traffic class
 */
export class ContextClassifier {
  private rules: ClassificationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Emergency signals - highest priority
    this.rules.push({
      match: (ctx) => 
        ctx.contextType === ContextType.EMERGENCY ||
        this.containsEmergencyKeywords(ctx),
      trafficClass: TrafficClass.EMERGENCY,
      dropPrecedence: 0,
    });

    // Safety signals
    this.rules.push({
      match: (ctx) => ctx.contextType === ContextType.SAFETY,
      trafficClass: TrafficClass.CRITICAL,
      dropPrecedence: 0,
    });

    // Corrections - need to propagate quickly
    this.rules.push({
      match: (ctx) => ctx.contextType === ContextType.CORRECTION,
      trafficClass: TrafficClass.CRITICAL,
      dropPrecedence: 1,
    });

    // Real-time collaboration
    this.rules.push({
      match: (ctx) => ctx.contextType === ContextType.REALTIME,
      trafficClass: TrafficClass.INTERACTIVE,
      dropPrecedence: 0,
    });

    // Working memory
    this.rules.push({
      match: (ctx) => ctx.contextType === ContextType.WORKING_MEMORY,
      trafficClass: TrafficClass.INTERACTIVE,
      dropPrecedence: 1,
    });

    // Standard updates
    this.rules.push({
      match: (ctx) => ctx.contextType === ContextType.UPDATE,
      trafficClass: TrafficClass.ASSURED,
      dropPrecedence: 1,
    });

    // Background sync
    this.rules.push({
      match: (ctx) => ctx.contextType === ContextType.SYNC,
      trafficClass: TrafficClass.BEST_EFFORT,
      dropPrecedence: 2,
    });

    // Heartbeats - lowest priority
    this.rules.push({
      match: (ctx) => ctx.contextType === ContextType.HEARTBEAT,
      trafficClass: TrafficClass.BACKGROUND,
      dropPrecedence: 2,
    });
  }

  private containsEmergencyKeywords(ctx: Partial<QoSPacket>): boolean {
    const payload = JSON.stringify(ctx.payload || '').toLowerCase();
    const emergencyKeywords = [
      'emergency', 'urgent', 'critical', 'danger', 'halt',
      'stop', 'abort', 'safety', 'violation', 'breach'
    ];
    return emergencyKeywords.some(kw => payload.includes(kw));
  }

  addRule(rule: ClassificationRule): void {
    // Insert by priority (first match wins, so higher priority first)
    this.rules.unshift(rule);
  }

  classify(packet: Partial<QoSPacket>): QoSMarking {
    for (const rule of this.rules) {
      if (rule.match(packet)) {
        return {
          trafficClass: rule.trafficClass,
          dropPrecedence: rule.dropPrecedence,
          ecn: 'not-ect',
          ttl: this.getDefaultTTL(rule.trafficClass),
          timestamp: Date.now(),
        };
      }
    }

    // Default: best effort
    return {
      trafficClass: TrafficClass.BEST_EFFORT,
      dropPrecedence: 2,
      ecn: 'not-ect',
      ttl: 30000,
      timestamp: Date.now(),
    };
  }

  private getDefaultTTL(tc: TrafficClass): number {
    const ttls: Record<TrafficClass, number> = {
      [TrafficClass.EMERGENCY]: 1000,
      [TrafficClass.CRITICAL]: 5000,
      [TrafficClass.INTERACTIVE]: 10000,
      [TrafficClass.ASSURED]: 30000,
      [TrafficClass.BEST_EFFORT]: 60000,
      [TrafficClass.BACKGROUND]: 300000,
    };
    return ttls[tc];
  }
}

interface ClassificationRule {
  match: (ctx: Partial<QoSPacket>) => boolean;
  trafficClass: TrafficClass;
  dropPrecedence: 0 | 1 | 2;
}

// ============================================================================
// PRIORITY QUEUE
// ============================================================================

/**
 * Priority queue with weighted fair queuing
 */
export class PriorityQueue<T> extends EventEmitter {
  private queues: Map<TrafficClass, QueueEntry<T>[]> = new Map();
  private configs: Map<TrafficClass, QueueConfig> = new Map();
  private stats: Map<TrafficClass, QueueStats> = new Map();
  private deficitCounters: Map<TrafficClass, number> = new Map();

  constructor() {
    super();
    this.initializeQueues();
  }

  private initializeQueues(): void {
    const defaultConfigs: Record<TrafficClass, QueueConfig> = {
      [TrafficClass.EMERGENCY]: {
        maxDepth: 10,
        weight: 100,
        minBandwidth: 0.1,
        maxLatency: 100,
        enableRED: false,
        redThreshold: 0.8,
      },
      [TrafficClass.CRITICAL]: {
        maxDepth: 50,
        weight: 50,
        minBandwidth: 0.15,
        maxLatency: 500,
        enableRED: false,
        redThreshold: 0.7,
      },
      [TrafficClass.INTERACTIVE]: {
        maxDepth: 100,
        weight: 30,
        minBandwidth: 0.2,
        maxLatency: 1000,
        enableRED: true,
        redThreshold: 0.6,
      },
      [TrafficClass.ASSURED]: {
        maxDepth: 200,
        weight: 15,
        minBandwidth: 0.2,
        maxLatency: 5000,
        enableRED: true,
        redThreshold: 0.5,
      },
      [TrafficClass.BEST_EFFORT]: {
        maxDepth: 500,
        weight: 5,
        minBandwidth: 0.1,
        maxLatency: 30000,
        enableRED: true,
        redThreshold: 0.4,
      },
      [TrafficClass.BACKGROUND]: {
        maxDepth: 1000,
        weight: 1,
        minBandwidth: 0.05,
        maxLatency: 60000,
        enableRED: true,
        redThreshold: 0.3,
      },
    };

    for (const tc of Object.values(TrafficClass).filter(v => typeof v === 'number') as TrafficClass[]) {
      this.queues.set(tc, []);
      this.configs.set(tc, defaultConfigs[tc]);
      this.stats.set(tc, {
        enqueued: 0,
        dequeued: 0,
        dropped: 0,
        totalLatency: 0,
      });
      this.deficitCounters.set(tc, 0);
    }
  }

  /**
   * Enqueue a packet with QoS marking
   */
  enqueue(item: T, marking: QoSMarking): boolean {
    const tc = marking.trafficClass;
    const queue = this.queues.get(tc)!;
    const config = this.configs.get(tc)!;
    const stats = this.stats.get(tc)!;

    // Check if queue is full
    if (queue.length >= config.maxDepth) {
      stats.dropped++;
      this.emit('drop', { item, marking, reason: 'queue_full' });
      return false;
    }

    // Random Early Detection
    if (config.enableRED) {
      const fillRatio = queue.length / config.maxDepth;
      if (fillRatio > config.redThreshold) {
        const dropProbability = (fillRatio - config.redThreshold) / (1 - config.redThreshold);
        // Higher drop precedence = more likely to drop
        const adjustedProbability = dropProbability * (1 + marking.dropPrecedence * 0.3);
        
        if (Math.random() < adjustedProbability) {
          stats.dropped++;
          this.emit('drop', { item, marking, reason: 'red' });
          return false;
        }
      }
    }

    // Enqueue
    queue.push({
      item,
      marking,
      enqueueTime: Date.now(),
    });
    stats.enqueued++;

    this.emit('enqueue', { trafficClass: tc, depth: queue.length });
    return true;
  }

  /**
   * Dequeue using Weighted Fair Queuing (Deficit Round Robin)
   */
  dequeue(): { item: T; marking: QoSMarking; latency: number } | null {
    // Get all non-empty queues sorted by priority
    const nonEmpty = (Object.values(TrafficClass).filter(v => typeof v === 'number') as TrafficClass[])
      .filter(tc => (this.queues.get(tc)?.length ?? 0) > 0)
      .sort((a, b) => b - a); // Higher priority first

    if (nonEmpty.length === 0) return null;

    // Strict priority for EMERGENCY and CRITICAL
    if (nonEmpty[0] >= TrafficClass.CRITICAL) {
      return this.dequeueFrom(nonEmpty[0]);
    }

    // Weighted fair queuing for others
    for (const tc of nonEmpty) {
      const config = this.configs.get(tc)!;
      const deficit = this.deficitCounters.get(tc)!;
      
      // Add weight to deficit
      this.deficitCounters.set(tc, deficit + config.weight);
      
      // If enough deficit, dequeue
      if (this.deficitCounters.get(tc)! >= 10) {
        this.deficitCounters.set(tc, this.deficitCounters.get(tc)! - 10);
        const result = this.dequeueFrom(tc);
        if (result) return result;
      }
    }

    // Fallback: just dequeue from highest priority non-empty
    return this.dequeueFrom(nonEmpty[0]);
  }

  private dequeueFrom(tc: TrafficClass): { item: T; marking: QoSMarking; latency: number } | null {
    const queue = this.queues.get(tc)!;
    const stats = this.stats.get(tc)!;

    if (queue.length === 0) return null;

    const entry = queue.shift()!;
    const latency = Date.now() - entry.enqueueTime;
    
    stats.dequeued++;
    stats.totalLatency += latency;

    this.emit('dequeue', { trafficClass: tc, latency, depth: queue.length });

    return {
      item: entry.item,
      marking: entry.marking,
      latency,
    };
  }

  /**
   * Peek at next item without removing
   */
  peek(): { item: T; marking: QoSMarking } | null {
    const nonEmpty = (Object.values(TrafficClass).filter(v => typeof v === 'number') as TrafficClass[])
      .filter(tc => (this.queues.get(tc)?.length ?? 0) > 0)
      .sort((a, b) => b - a);

    if (nonEmpty.length === 0) return null;

    const queue = this.queues.get(nonEmpty[0])!;
    const entry = queue[0];
    return { item: entry.item, marking: entry.marking };
  }

  /**
   * Get current queue depths
   */
  getDepths(): Map<TrafficClass, number> {
    const depths = new Map<TrafficClass, number>();
    for (const [tc, queue] of this.queues) {
      depths.set(tc, queue.length);
    }
    return depths;
  }

  /**
   * Get queue statistics
   */
  getStats(): Map<TrafficClass, QueueStats> {
    return new Map(this.stats);
  }

  /**
   * Update queue configuration
   */
  updateConfig(tc: TrafficClass, config: Partial<QueueConfig>): void {
    const current = this.configs.get(tc)!;
    this.configs.set(tc, { ...current, ...config });
  }

  /**
   * Clear all queues
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
  }

  /**
   * Get total size across all queues
   */
  get size(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }
}

interface QueueEntry<T> {
  item: T;
  marking: QoSMarking;
  enqueueTime: number;
}

interface QueueStats {
  enqueued: number;
  dequeued: number;
  dropped: number;
  totalLatency: number;
}

// ============================================================================
// TRAFFIC SHAPER
// ============================================================================

/**
 * Token bucket traffic shaper for rate limiting
 */
export class TrafficShaper extends EventEmitter {
  private policies: Map<TrafficClass, TrafficPolicy> = new Map();
  private buckets: Map<TrafficClass, TokenBucket> = new Map();

  constructor() {
    super();
    this.initializePolicies();
  }

  private initializePolicies(): void {
    const defaultPolicies: Record<TrafficClass, TrafficPolicy> = {
      [TrafficClass.EMERGENCY]: {
        rate: 100,
        burst: 50,
        peakRate: 200,
        exceedAction: 'queue',
      },
      [TrafficClass.CRITICAL]: {
        rate: 50,
        burst: 25,
        peakRate: 100,
        exceedAction: 'queue',
      },
      [TrafficClass.INTERACTIVE]: {
        rate: 30,
        burst: 15,
        peakRate: 60,
        exceedAction: 'queue',
      },
      [TrafficClass.ASSURED]: {
        rate: 20,
        burst: 10,
        peakRate: 40,
        exceedAction: 'remark',
        remarkTo: TrafficClass.BEST_EFFORT,
      },
      [TrafficClass.BEST_EFFORT]: {
        rate: 10,
        burst: 5,
        peakRate: 20,
        exceedAction: 'remark',
        remarkTo: TrafficClass.BACKGROUND,
      },
      [TrafficClass.BACKGROUND]: {
        rate: 5,
        burst: 10,
        peakRate: 10,
        exceedAction: 'drop',
      },
    };

    for (const tc of Object.values(TrafficClass).filter(v => typeof v === 'number') as TrafficClass[]) {
      const policy = defaultPolicies[tc];
      this.policies.set(tc, policy);
      this.buckets.set(tc, new TokenBucket(policy.rate, policy.burst));
    }
  }

  /**
   * Shape a packet - returns action to take
   */
  shape(marking: QoSMarking): ShapeResult {
    const bucket = this.buckets.get(marking.trafficClass)!;
    const policy = this.policies.get(marking.trafficClass)!;

    // Try to consume a token
    if (bucket.consume(1)) {
      return { action: 'pass', marking };
    }

    // Exceeded rate - apply policy
    switch (policy.exceedAction) {
      case 'drop':
        this.emit('shaped', { action: 'drop', trafficClass: marking.trafficClass });
        return { action: 'drop', marking };

      case 'remark':
        const newMarking: QoSMarking = {
          ...marking,
          trafficClass: policy.remarkTo!,
          dropPrecedence: Math.min(2, marking.dropPrecedence + 1) as 0 | 1 | 2,
        };
        this.emit('shaped', { action: 'remark', from: marking.trafficClass, to: policy.remarkTo });
        return { action: 'remark', marking: newMarking };

      case 'queue':
      default:
        this.emit('shaped', { action: 'queue', trafficClass: marking.trafficClass });
        return { action: 'queue', marking };
    }
  }

  /**
   * Update policy for a traffic class
   */
  updatePolicy(tc: TrafficClass, policy: Partial<TrafficPolicy>): void {
    const current = this.policies.get(tc)!;
    const updated = { ...current, ...policy };
    this.policies.set(tc, updated);
    this.buckets.set(tc, new TokenBucket(updated.rate, updated.burst));
  }

  /**
   * Get current token levels
   */
  getTokenLevels(): Map<TrafficClass, number> {
    const levels = new Map<TrafficClass, number>();
    for (const [tc, bucket] of this.buckets) {
      levels.set(tc, bucket.tokens);
    }
    return levels;
  }
}

interface ShapeResult {
  action: 'pass' | 'drop' | 'remark' | 'queue';
  marking: QoSMarking;
}

/**
 * Token bucket for rate limiting
 */
class TokenBucket {
  tokens: number;
  private lastRefill: number;

  constructor(
    private rate: number,
    private capacity: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(count: number): boolean {
    this.refill();
    
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const newTokens = elapsed * this.rate;
    
    this.tokens = Math.min(this.capacity, this.tokens + newTokens);
    this.lastRefill = now;
  }
}

// ============================================================================
// SLA MONITOR
// ============================================================================

/**
 * Monitors and enforces Service Level Agreements
 */
export class SLAMonitor extends EventEmitter {
  private slas: Map<TrafficClass, SLA> = new Map();
  private metrics: Map<TrafficClass, SLAMetrics> = new Map();
  private violations: SLAViolation[] = [];
  private windowMs: number = 60000; // 1 minute window

  constructor() {
    super();
    this.initializeSLAs();
  }

  private initializeSLAs(): void {
    const defaultSLAs: Record<TrafficClass, SLA> = {
      [TrafficClass.EMERGENCY]: {
        maxLatency: 100,
        maxJitter: 20,
        minThroughput: 50,
        maxLoss: 0,
        availability: 0.9999,
      },
      [TrafficClass.CRITICAL]: {
        maxLatency: 500,
        maxJitter: 100,
        minThroughput: 30,
        maxLoss: 0.001,
        availability: 0.999,
      },
      [TrafficClass.INTERACTIVE]: {
        maxLatency: 1000,
        maxJitter: 200,
        minThroughput: 20,
        maxLoss: 0.01,
        availability: 0.99,
      },
      [TrafficClass.ASSURED]: {
        maxLatency: 5000,
        maxJitter: 1000,
        minThroughput: 10,
        maxLoss: 0.05,
        availability: 0.95,
      },
      [TrafficClass.BEST_EFFORT]: {
        maxLatency: 30000,
        maxJitter: 5000,
        minThroughput: 5,
        maxLoss: 0.1,
        availability: 0.9,
      },
      [TrafficClass.BACKGROUND]: {
        maxLatency: 60000,
        maxJitter: 10000,
        minThroughput: 1,
        maxLoss: 0.2,
        availability: 0.8,
      },
    };

    for (const tc of Object.values(TrafficClass).filter(v => typeof v === 'number') as TrafficClass[]) {
      this.slas.set(tc, defaultSLAs[tc]);
      this.metrics.set(tc, {
        latencies: [],
        processed: 0,
        dropped: 0,
        lastUpdate: Date.now(),
      });
    }
  }

  /**
   * Record a processed packet
   */
  recordPacket(tc: TrafficClass, latency: number, dropped: boolean = false): void {
    const metrics = this.metrics.get(tc)!;
    const now = Date.now();

    // Clean old entries
    metrics.latencies = metrics.latencies.filter(l => now - l.time < this.windowMs);

    if (dropped) {
      metrics.dropped++;
    } else {
      metrics.latencies.push({ value: latency, time: now });
      metrics.processed++;
    }
    metrics.lastUpdate = now;

    // Check SLA
    this.checkSLA(tc);
  }

  private checkSLA(tc: TrafficClass): void {
    const sla = this.slas.get(tc)!;
    const metrics = this.metrics.get(tc)!;

    if (metrics.latencies.length === 0) return;

    // Calculate current metrics
    const latencies = metrics.latencies.map(l => l.value);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const jitter = this.calculateJitter(latencies);
    const throughput = metrics.processed / (this.windowMs / 1000);
    const lossRate = metrics.dropped / (metrics.processed + metrics.dropped);

    // Check violations
    if (avgLatency > sla.maxLatency) {
      this.recordViolation(tc, 'latency', sla.maxLatency, avgLatency);
    }
    if (jitter > sla.maxJitter) {
      this.recordViolation(tc, 'jitter', sla.maxJitter, jitter);
    }
    if (throughput < sla.minThroughput) {
      this.recordViolation(tc, 'throughput', sla.minThroughput, throughput);
    }
    if (lossRate > sla.maxLoss) {
      this.recordViolation(tc, 'loss', sla.maxLoss, lossRate);
    }
  }

  private calculateJitter(latencies: number[]): number {
    if (latencies.length < 2) return 0;
    
    let totalVariation = 0;
    for (let i = 1; i < latencies.length; i++) {
      totalVariation += Math.abs(latencies[i] - latencies[i - 1]);
    }
    return totalVariation / (latencies.length - 1);
  }

  private recordViolation(
    tc: TrafficClass,
    metric: 'latency' | 'jitter' | 'throughput' | 'loss',
    expected: number,
    actual: number
  ): void {
    const violation: SLAViolation = {
      trafficClass: tc,
      metric,
      expected,
      actual,
      timestamp: Date.now(),
    };
    
    this.violations.push(violation);
    this.emit('violation', violation);

    // Keep only recent violations
    const cutoff = Date.now() - 3600000; // 1 hour
    this.violations = this.violations.filter(v => v.timestamp > cutoff);
  }

  /**
   * Get current SLA compliance status
   */
  getComplianceStatus(): Map<TrafficClass, ComplianceStatus> {
    const status = new Map<TrafficClass, ComplianceStatus>();
    const now = Date.now();
    const recentWindow = 300000; // 5 minutes

    for (const tc of Object.values(TrafficClass).filter(v => typeof v === 'number') as TrafficClass[]) {
      const recentViolations = this.violations.filter(
        v => v.trafficClass === tc && now - v.timestamp < recentWindow
      );

      const metrics = this.metrics.get(tc)!;
      const latencies = metrics.latencies.map(l => l.value);
      
      status.set(tc, {
        compliant: recentViolations.length === 0,
        violationCount: recentViolations.length,
        currentLatency: latencies.length > 0 
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
          : 0,
        currentThroughput: metrics.processed / (this.windowMs / 1000),
        currentLossRate: metrics.dropped / Math.max(1, metrics.processed + metrics.dropped),
      });
    }

    return status;
  }

  /**
   * Update SLA for a traffic class
   */
  updateSLA(tc: TrafficClass, sla: Partial<SLA>): void {
    const current = this.slas.get(tc)!;
    this.slas.set(tc, { ...current, ...sla });
  }

  /**
   * Get recent violations
   */
  getViolations(since?: number): SLAViolation[] {
    if (since) {
      return this.violations.filter(v => v.timestamp > since);
    }
    return [...this.violations];
  }
}

interface SLAMetrics {
  latencies: { value: number; time: number }[];
  processed: number;
  dropped: number;
  lastUpdate: number;
}

interface ComplianceStatus {
  compliant: boolean;
  violationCount: number;
  currentLatency: number;
  currentThroughput: number;
  currentLossRate: number;
}

// ============================================================================
// QOS MANAGER (Main Entry Point)
// ============================================================================

/**
 * Unified QoS Manager for Context Handshake Protocol
 */
export class QoSManager extends EventEmitter {
  private classifier: ContextClassifier;
  private queue: PriorityQueue<QoSPacket>;
  private shaper: TrafficShaper;
  private slaMonitor: SLAMonitor;
  private enabled: boolean = true;
  private seqCounter: number = 0;

  constructor() {
    super();
    this.classifier = new ContextClassifier();
    this.queue = new PriorityQueue();
    this.shaper = new TrafficShaper();
    this.slaMonitor = new SLAMonitor();

    this.wireEvents();
  }

  private wireEvents(): void {
    this.queue.on('drop', (data) => {
      this.emit('packet:dropped', data);
      this.slaMonitor.recordPacket(data.marking.trafficClass, 0, true);
    });

    this.queue.on('dequeue', (data) => {
      this.slaMonitor.recordPacket(data.trafficClass, data.latency);
    });

    this.slaMonitor.on('violation', (violation) => {
      this.emit('sla:violation', violation);
    });
  }

  /**
   * Submit context for transmission
   */
  submit<T>(
    payload: T,
    contextType: ContextType,
    source: string,
    destination: string,
    explicitMarking?: Partial<QoSMarking>
  ): boolean {
    if (!this.enabled) {
      // Bypass QoS
      this.emit('packet:bypass', { payload, contextType });
      return true;
    }

    // Create packet
    const packet: QoSPacket<T> = {
      id: `pkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      payload,
      marking: {
        ...this.classifier.classify({ payload, contextType }),
        ...explicitMarking,
      },
      seq: this.seqCounter++,
      source,
      destination,
      contextType,
    };

    // Shape traffic
    const shapeResult = this.shaper.shape(packet.marking);
    
    if (shapeResult.action === 'drop') {
      this.emit('packet:dropped', { packet, reason: 'shaped' });
      return false;
    }

    // Apply remarking if needed
    if (shapeResult.action === 'remark') {
      packet.marking = shapeResult.marking;
    }

    // Enqueue
    return this.queue.enqueue(packet, packet.marking);
  }

  /**
   * Get next packet for transmission
   */
  getNext<T = unknown>(): { packet: QoSPacket<T>; latency: number } | null {
    const result = this.queue.dequeue();
    if (!result) return null;

    return {
      packet: result.item as QoSPacket<T>,
      latency: result.latency,
    };
  }

  /**
   * Process packets in batch
   */
  processBatch<T = unknown>(maxCount: number): Array<{ packet: QoSPacket<T>; latency: number }> {
    const results: Array<{ packet: QoSPacket<T>; latency: number }> = [];
    
    while (results.length < maxCount) {
      const next = this.getNext<T>();
      if (!next) break;
      results.push(next);
    }

    return results;
  }

  /**
   * Get comprehensive QoS statistics
   */
  getStats(): QoSStats {
    const queueStats = this.queue.getStats();
    const depths = this.queue.getDepths();
    const compliance = this.slaMonitor.getComplianceStatus();

    const packetsProcessed = new Map<TrafficClass, number>();
    const packetsDropped = new Map<TrafficClass, number>();
    const averageLatency = new Map<TrafficClass, number>();
    const bandwidthUsage = new Map<TrafficClass, number>();

    for (const tc of Object.values(TrafficClass).filter(v => typeof v === 'number') as TrafficClass[]) {
      const stats = queueStats.get(tc);
      const status = compliance.get(tc);

      packetsProcessed.set(tc, stats?.dequeued ?? 0);
      packetsDropped.set(tc, stats?.dropped ?? 0);
      averageLatency.set(tc, stats && stats.dequeued > 0 
        ? stats.totalLatency / stats.dequeued 
        : 0);
      bandwidthUsage.set(tc, status?.currentThroughput ?? 0);
    }

    return {
      packetsProcessed,
      packetsDropped,
      averageLatency,
      queueDepths: depths,
      bandwidthUsage,
      slaViolations: this.slaMonitor.getViolations(Date.now() - 300000),
      timestamp: Date.now(),
    };
  }

  /**
   * Get SLA compliance status
   */
  getCompliance(): Map<TrafficClass, ComplianceStatus> {
    return this.slaMonitor.getComplianceStatus();
  }

  /**
   * Add custom classification rule
   */
  addClassificationRule(rule: ClassificationRule): void {
    this.classifier.addRule(rule);
  }

  /**
   * Update traffic policy
   */
  updateTrafficPolicy(tc: TrafficClass, policy: Partial<TrafficPolicy>): void {
    this.shaper.updatePolicy(tc, policy);
  }

  /**
   * Update SLA
   */
  updateSLA(tc: TrafficClass, sla: Partial<SLA>): void {
    this.slaMonitor.updateSLA(tc, sla);
  }

  /**
   * Update queue configuration
   */
  updateQueueConfig(tc: TrafficClass, config: Partial<QueueConfig>): void {
    this.queue.updateConfig(tc, config);
  }

  /**
   * Enable/disable QoS
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.emit('enabled', enabled);
  }

  /**
   * Check if QoS is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queue.clear();
    this.emit('cleared');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  ContextClassifier,
  PriorityQueue,
  TrafficShaper,
  SLAMonitor,
  QoSManager,
};

export default QoSManager;
