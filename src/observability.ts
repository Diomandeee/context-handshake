/**
 * Context Observability - OpenTelemetry-style tracing, metrics, and debugging
 * 
 * HEF Evolution Task: task_20260202074111_bb502e
 * Instance: 28 | Generation: 6 | Priority: 1
 * 
 * Every complex protocol needs observability. This module provides:
 * - Distributed tracing for handshake flows
 * - Metrics collection (latency, bandwidth, alignment scores)
 * - Event logs with structured data
 * - Health checks and alerting
 * - Dashboard data export
 * 
 * Techniques: G11 (Perspective Shift), R06 (Simplify), S03 (Systems Thinking)
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// ============================================================================
// TRACING - Follow handshakes across distributed systems
// ============================================================================

/**
 * A trace represents a complete handshake flow across multiple agents
 */
export interface Trace {
  traceId: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'failed' | 'timeout';
  rootSpan: Span;
  spanCount: number;
  totalDurationMs?: number;
  participants: string[];
  metadata: Record<string, unknown>;
}

/**
 * A span represents a single operation within a trace
 */
export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: SpanStatus;
  agentId: string;
  attributes: Record<string, SpanAttributeValue>;
  events: SpanEvent[];
  links: SpanLink[];
  children: Span[];
}

export type SpanKind = 'internal' | 'client' | 'server' | 'producer' | 'consumer';

export interface SpanStatus {
  code: 'unset' | 'ok' | 'error';
  message?: string;
}

export type SpanAttributeValue = string | number | boolean | string[] | number[] | boolean[];

export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes: Record<string, SpanAttributeValue>;
}

export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes: Record<string, SpanAttributeValue>;
}

/**
 * Context propagation for distributed tracing
 */
export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
}

/**
 * Tracer - Creates and manages spans for handshake operations
 */
export class Tracer extends EventEmitter {
  private traces: Map<string, Trace> = new Map();
  private spans: Map<string, Span> = new Map();
  private activeSpanStack: Map<string, string[]> = new Map(); // agentId -> spanId stack
  
  constructor(
    private readonly agentId: string,
    private readonly options: TracerOptions = {}
  ) {
    super();
    this.options.maxTraces = options.maxTraces ?? 1000;
    this.options.maxSpansPerTrace = options.maxSpansPerTrace ?? 100;
    this.options.spanTimeoutMs = options.spanTimeoutMs ?? 60000;
  }
  
  /**
   * Start a new trace (begins a handshake flow)
   */
  startTrace(name: string, metadata: Record<string, unknown> = {}): Trace {
    const traceId = uuidv4();
    const rootSpan = this.createSpan(traceId, name, 'internal');
    
    const trace: Trace = {
      traceId,
      name,
      startTime: new Date(),
      status: 'active',
      rootSpan,
      spanCount: 1,
      participants: [this.agentId],
      metadata
    };
    
    this.traces.set(traceId, trace);
    this.enforceTraceLimits();
    
    this.emit('trace:start', trace);
    return trace;
  }
  
  /**
   * Create a new span within a trace
   */
  startSpan(
    traceId: string,
    name: string,
    kind: SpanKind = 'internal',
    parentSpanId?: string
  ): Span {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }
    
    // Auto-parent to current active span if not specified
    const resolvedParentId = parentSpanId ?? this.getActiveSpan(traceId)?.spanId;
    
    const span = this.createSpan(traceId, name, kind, resolvedParentId);
    trace.spanCount++;
    
    // Add to parent's children
    if (resolvedParentId) {
      const parent = this.spans.get(resolvedParentId);
      if (parent) {
        parent.children.push(span);
      }
    }
    
    // Push to active stack
    this.pushActiveSpan(traceId, span.spanId);
    
    this.emit('span:start', span, trace);
    return span;
  }
  
  /**
   * End a span
   */
  endSpan(spanId: string, status?: SpanStatus): Span {
    const span = this.spans.get(spanId);
    if (!span) {
      throw new Error(`Span ${spanId} not found`);
    }
    
    span.endTime = new Date();
    span.durationMs = span.endTime.getTime() - span.startTime.getTime();
    span.status = status ?? { code: 'ok' };
    
    // Pop from active stack
    this.popActiveSpan(span.traceId, spanId);
    
    this.emit('span:end', span);
    return span;
  }
  
  /**
   * End a trace
   */
  endTrace(traceId: string, status: 'completed' | 'failed' | 'timeout' = 'completed'): Trace {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }
    
    trace.endTime = new Date();
    trace.status = status;
    trace.totalDurationMs = trace.endTime.getTime() - trace.startTime.getTime();
    
    // End any still-active spans
    this.activeSpanStack.get(traceId)?.forEach(spanId => {
      this.endSpan(spanId, { code: status === 'completed' ? 'ok' : 'error' });
    });
    
    this.emit('trace:end', trace);
    return trace;
  }
  
  /**
   * Add an event to a span
   */
  addSpanEvent(spanId: string, name: string, attributes: Record<string, SpanAttributeValue> = {}): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    
    span.events.push({
      name,
      timestamp: new Date(),
      attributes
    });
    
    this.emit('span:event', span, name, attributes);
  }
  
  /**
   * Set span attributes
   */
  setSpanAttributes(spanId: string, attributes: Record<string, SpanAttributeValue>): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    
    Object.assign(span.attributes, attributes);
  }
  
  /**
   * Link spans across traces (for multi-party handshakes)
   */
  linkSpans(spanId: string, linkedTraceId: string, linkedSpanId: string, attributes: Record<string, SpanAttributeValue> = {}): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    
    span.links.push({
      traceId: linkedTraceId,
      spanId: linkedSpanId,
      attributes
    });
  }
  
  /**
   * Add a participant to a trace
   */
  addParticipant(traceId: string, agentId: string): void {
    const trace = this.traces.get(traceId);
    if (trace && !trace.participants.includes(agentId)) {
      trace.participants.push(agentId);
    }
  }
  
  /**
   * Get trace context for propagation
   */
  getTraceContext(spanId: string): TraceContext | null {
    const span = this.spans.get(spanId);
    if (!span) return null;
    
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      traceFlags: 1, // Sampled
      traceState: `agent=${this.agentId}`
    };
  }
  
  /**
   * Continue trace from propagated context
   */
  continueTrace(context: TraceContext, name: string): Span {
    let trace = this.traces.get(context.traceId);
    
    if (!trace) {
      // Create local representation of remote trace
      trace = {
        traceId: context.traceId,
        name,
        startTime: new Date(),
        status: 'active',
        rootSpan: null!,
        spanCount: 0,
        participants: [this.agentId],
        metadata: { continued: true }
      };
      this.traces.set(context.traceId, trace);
    }
    
    this.addParticipant(context.traceId, this.agentId);
    
    const span = this.createSpan(context.traceId, name, 'server', context.spanId);
    if (!trace.rootSpan) {
      trace.rootSpan = span;
    }
    trace.spanCount++;
    
    this.pushActiveSpan(context.traceId, span.spanId);
    
    return span;
  }
  
  /**
   * Get current active span for a trace
   */
  getActiveSpan(traceId: string): Span | null {
    const stack = this.activeSpanStack.get(traceId);
    if (!stack || stack.length === 0) return null;
    return this.spans.get(stack[stack.length - 1]) ?? null;
  }
  
  /**
   * Get a trace by ID
   */
  getTrace(traceId: string): Trace | null {
    return this.traces.get(traceId) ?? null;
  }
  
  /**
   * Get all traces (for debugging)
   */
  getAllTraces(): Trace[] {
    return Array.from(this.traces.values());
  }
  
  /**
   * Export traces in a visualization-friendly format
   */
  exportTraces(): TraceExport[] {
    return Array.from(this.traces.values()).map(trace => ({
      traceId: trace.traceId,
      name: trace.name,
      startTime: trace.startTime.toISOString(),
      endTime: trace.endTime?.toISOString(),
      status: trace.status,
      durationMs: trace.totalDurationMs,
      spanCount: trace.spanCount,
      participants: trace.participants,
      spans: this.exportSpanTree(trace.rootSpan)
    }));
  }
  
  // Private helpers
  
  private createSpan(traceId: string, name: string, kind: SpanKind, parentSpanId?: string): Span {
    const span: Span = {
      spanId: uuidv4(),
      traceId,
      parentSpanId,
      name,
      kind,
      startTime: new Date(),
      status: { code: 'unset' },
      agentId: this.agentId,
      attributes: {},
      events: [],
      links: [],
      children: []
    };
    
    this.spans.set(span.spanId, span);
    return span;
  }
  
  private pushActiveSpan(traceId: string, spanId: string): void {
    if (!this.activeSpanStack.has(traceId)) {
      this.activeSpanStack.set(traceId, []);
    }
    this.activeSpanStack.get(traceId)!.push(spanId);
  }
  
  private popActiveSpan(traceId: string, spanId: string): void {
    const stack = this.activeSpanStack.get(traceId);
    if (stack) {
      const index = stack.lastIndexOf(spanId);
      if (index !== -1) {
        stack.splice(index, 1);
      }
    }
  }
  
  private enforceTraceLimits(): void {
    if (this.traces.size > this.options.maxTraces!) {
      // Remove oldest completed traces
      const sorted = Array.from(this.traces.entries())
        .filter(([, t]) => t.status !== 'active')
        .sort(([, a], [, b]) => a.startTime.getTime() - b.startTime.getTime());
      
      const toRemove = sorted.slice(0, Math.floor(this.options.maxTraces! * 0.2));
      toRemove.forEach(([id]) => {
        this.traces.delete(id);
        // Clean up related spans
        Array.from(this.spans.entries())
          .filter(([, s]) => s.traceId === id)
          .forEach(([spanId]) => this.spans.delete(spanId));
      });
    }
  }
  
  private exportSpanTree(span: Span): SpanExport {
    return {
      spanId: span.spanId,
      name: span.name,
      kind: span.kind,
      startTime: span.startTime.toISOString(),
      endTime: span.endTime?.toISOString(),
      durationMs: span.durationMs,
      status: span.status,
      agentId: span.agentId,
      attributes: span.attributes,
      events: span.events.map(e => ({
        name: e.name,
        timestamp: e.timestamp.toISOString(),
        attributes: e.attributes
      })),
      children: span.children.map(c => this.exportSpanTree(c))
    };
  }
}

export interface TracerOptions {
  maxTraces?: number;
  maxSpansPerTrace?: number;
  spanTimeoutMs?: number;
}

export interface TraceExport {
  traceId: string;
  name: string;
  startTime: string;
  endTime?: string;
  status: string;
  durationMs?: number;
  spanCount: number;
  participants: string[];
  spans: SpanExport;
}

export interface SpanExport {
  spanId: string;
  name: string;
  kind: SpanKind;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  status: SpanStatus;
  agentId: string;
  attributes: Record<string, SpanAttributeValue>;
  events: Array<{
    name: string;
    timestamp: string;
    attributes: Record<string, SpanAttributeValue>;
  }>;
  children: SpanExport[];
}

// ============================================================================
// METRICS - Quantify handshake performance
// ============================================================================

/**
 * Metric types
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface Metric {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;
  labels: string[];
}

export interface MetricPoint {
  metric: string;
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
}

export interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

export interface HistogramValue {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

/**
 * Metrics Registry - Collect and export handshake metrics
 */
export class MetricsRegistry extends EventEmitter {
  private metrics: Map<string, Metric> = new Map();
  private counters: Map<string, Map<string, number>> = new Map();
  private gauges: Map<string, Map<string, number>> = new Map();
  private histograms: Map<string, Map<string, HistogramValue>> = new Map();
  private histogramBuckets: Map<string, number[]> = new Map();
  
  constructor(private readonly agentId: string) {
    super();
    this.registerDefaultMetrics();
  }
  
  /**
   * Register default handshake metrics
   */
  private registerDefaultMetrics(): void {
    // Counters
    this.registerMetric({
      name: 'handshake_total',
      type: 'counter',
      description: 'Total number of handshakes',
      labels: ['status', 'type']
    });
    
    this.registerMetric({
      name: 'handshake_messages_total',
      type: 'counter',
      description: 'Total handshake messages sent/received',
      labels: ['direction', 'message_type']
    });
    
    this.registerMetric({
      name: 'sync_errors_total',
      type: 'counter',
      description: 'Total sync errors by type',
      labels: ['error_type']
    });
    
    // Gauges
    this.registerMetric({
      name: 'active_sessions',
      type: 'gauge',
      description: 'Currently active handshake sessions',
      labels: []
    });
    
    this.registerMetric({
      name: 'context_size_bytes',
      type: 'gauge',
      description: 'Current context size in bytes',
      labels: ['agent_id']
    });
    
    this.registerMetric({
      name: 'trust_level',
      type: 'gauge',
      description: 'Current trust level with peer',
      labels: ['peer_id']
    });
    
    this.registerMetric({
      name: 'alignment_score',
      type: 'gauge',
      description: 'Latest alignment score with peer',
      labels: ['peer_id']
    });
    
    // Histograms
    this.registerMetric({
      name: 'handshake_duration_ms',
      type: 'histogram',
      description: 'Handshake duration in milliseconds',
      unit: 'ms',
      labels: ['type']
    }, [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]);
    
    this.registerMetric({
      name: 'sync_bandwidth_bytes',
      type: 'histogram',
      description: 'Bytes transferred during sync',
      unit: 'bytes',
      labels: ['direction', 'compressed']
    }, [100, 500, 1000, 5000, 10000, 50000, 100000, 500000]);
    
    this.registerMetric({
      name: 'context_diff_concepts',
      type: 'histogram',
      description: 'Number of concepts differing between agents',
      labels: ['peer_id']
    }, [0, 1, 5, 10, 25, 50, 100, 250, 500]);
    
    this.registerMetric({
      name: 'fingerprint_comparison_ms',
      type: 'histogram',
      description: 'Time to compare fingerprints',
      unit: 'ms',
      labels: []
    }, [1, 5, 10, 25, 50, 100, 250]);
  }
  
  /**
   * Register a new metric
   */
  registerMetric(metric: Metric, buckets?: number[]): void {
    this.metrics.set(metric.name, metric);
    
    switch (metric.type) {
      case 'counter':
        this.counters.set(metric.name, new Map());
        break;
      case 'gauge':
        this.gauges.set(metric.name, new Map());
        break;
      case 'histogram':
        this.histograms.set(metric.name, new Map());
        this.histogramBuckets.set(metric.name, buckets ?? [10, 50, 100, 500, 1000]);
        break;
    }
  }
  
  /**
   * Increment a counter
   */
  incCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const counter = this.counters.get(name);
    if (!counter) return;
    
    const key = this.labelsKey(labels);
    counter.set(key, (counter.get(key) ?? 0) + value);
    
    this.emit('metric', { metric: name, value, labels, timestamp: new Date() });
  }
  
  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const gauge = this.gauges.get(name);
    if (!gauge) return;
    
    const key = this.labelsKey(labels);
    gauge.set(key, value);
    
    this.emit('metric', { metric: name, value, labels, timestamp: new Date() });
  }
  
  /**
   * Increment a gauge
   */
  incGauge(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const gauge = this.gauges.get(name);
    if (!gauge) return;
    
    const key = this.labelsKey(labels);
    gauge.set(key, (gauge.get(key) ?? 0) + value);
  }
  
  /**
   * Decrement a gauge
   */
  decGauge(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    this.incGauge(name, labels, -value);
  }
  
  /**
   * Observe a histogram value
   */
  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const histogram = this.histograms.get(name);
    const buckets = this.histogramBuckets.get(name);
    if (!histogram || !buckets) return;
    
    const key = this.labelsKey(labels);
    let histValue = histogram.get(key);
    
    if (!histValue) {
      histValue = {
        buckets: buckets.map(le => ({ le, count: 0 })),
        sum: 0,
        count: 0
      };
      histogram.set(key, histValue);
    }
    
    histValue.sum += value;
    histValue.count++;
    
    for (const bucket of histValue.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
    
    this.emit('metric', { metric: name, value, labels, timestamp: new Date() });
  }
  
  /**
   * Time a function and record as histogram
   */
  async timeHistogram<T>(
    name: string,
    fn: () => Promise<T>,
    labels: Record<string, string> = {}
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.observeHistogram(name, duration, labels);
    }
  }
  
  /**
   * Get all metric values in Prometheus exposition format
   */
  exportPrometheus(): string {
    const lines: string[] = [];
    
    for (const [name, metric] of this.metrics) {
      lines.push(`# HELP ${name} ${metric.description}`);
      lines.push(`# TYPE ${name} ${metric.type}`);
      
      switch (metric.type) {
        case 'counter': {
          const counter = this.counters.get(name)!;
          for (const [labelsKey, value] of counter) {
            const labels = labelsKey ? `{${labelsKey}}` : '';
            lines.push(`${name}${labels} ${value}`);
          }
          break;
        }
        case 'gauge': {
          const gauge = this.gauges.get(name)!;
          for (const [labelsKey, value] of gauge) {
            const labels = labelsKey ? `{${labelsKey}}` : '';
            lines.push(`${name}${labels} ${value}`);
          }
          break;
        }
        case 'histogram': {
          const histogram = this.histograms.get(name)!;
          for (const [labelsKey, histValue] of histogram) {
            const baseLabels = labelsKey ? `${labelsKey},` : '';
            for (const bucket of histValue.buckets) {
              lines.push(`${name}_bucket{${baseLabels}le="${bucket.le}"} ${bucket.count}`);
            }
            lines.push(`${name}_bucket{${baseLabels}le="+Inf"} ${histValue.count}`);
            lines.push(`${name}_sum{${labelsKey || ''}} ${histValue.sum}`);
            lines.push(`${name}_count{${labelsKey || ''}} ${histValue.count}`);
          }
          break;
        }
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Export metrics as JSON
   */
  exportJSON(): MetricsExport {
    const result: MetricsExport = {
      agentId: this.agentId,
      timestamp: new Date().toISOString(),
      counters: {},
      gauges: {},
      histograms: {}
    };
    
    for (const [name, counter] of this.counters) {
      result.counters[name] = Object.fromEntries(
        Array.from(counter.entries()).map(([k, v]) => [k || '_total', v])
      );
    }
    
    for (const [name, gauge] of this.gauges) {
      result.gauges[name] = Object.fromEntries(
        Array.from(gauge.entries()).map(([k, v]) => [k || '_value', v])
      );
    }
    
    for (const [name, histogram] of this.histograms) {
      result.histograms[name] = Object.fromEntries(
        Array.from(histogram.entries()).map(([k, v]) => [k || '_default', {
          buckets: v.buckets,
          sum: v.sum,
          count: v.count,
          avg: v.count > 0 ? v.sum / v.count : 0
        }])
      );
    }
    
    return result;
  }
  
  /**
   * Get summary statistics
   */
  getSummary(): MetricsSummary {
    const handshakes = this.counters.get('handshake_total') ?? new Map();
    const durations = this.histograms.get('handshake_duration_ms') ?? new Map();
    
    let totalHandshakes = 0;
    let successfulHandshakes = 0;
    let failedHandshakes = 0;
    
    for (const [key, value] of handshakes) {
      totalHandshakes += value;
      if (key.includes('status="success"')) successfulHandshakes += value;
      if (key.includes('status="failed"')) failedHandshakes += value;
    }
    
    let totalDuration = 0;
    let durationCount = 0;
    for (const [, hist] of durations) {
      totalDuration += hist.sum;
      durationCount += hist.count;
    }
    
    return {
      totalHandshakes,
      successfulHandshakes,
      failedHandshakes,
      successRate: totalHandshakes > 0 ? successfulHandshakes / totalHandshakes : 0,
      avgDurationMs: durationCount > 0 ? totalDuration / durationCount : 0,
      activeSessions: this.gauges.get('active_sessions')?.get('') ?? 0
    };
  }
  
  private labelsKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}

export interface MetricsExport {
  agentId: string;
  timestamp: string;
  counters: Record<string, Record<string, number>>;
  gauges: Record<string, Record<string, number>>;
  histograms: Record<string, Record<string, {
    buckets: HistogramBucket[];
    sum: number;
    count: number;
    avg: number;
  }>>;
}

export interface MetricsSummary {
  totalHandshakes: number;
  successfulHandshakes: number;
  failedHandshakes: number;
  successRate: number;
  avgDurationMs: number;
  activeSessions: number;
}

// ============================================================================
// EVENT LOGGING - Structured logs for debugging
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  traceId?: string;
  spanId?: string;
  agentId: string;
  peerId?: string;
  data?: Record<string, unknown>;
}

/**
 * Structured logger for handshake debugging
 */
export class HandshakeLogger extends EventEmitter {
  private logs: LogEntry[] = [];
  private readonly maxLogs: number;
  
  constructor(
    private readonly agentId: string,
    options: { maxLogs?: number } = {}
  ) {
    super();
    this.maxLogs = options.maxLogs ?? 10000;
  }
  
  /**
   * Log a debug message
   */
  debug(category: string, message: string, data?: LogData): void {
    this.log('debug', category, message, data);
  }
  
  /**
   * Log an info message
   */
  info(category: string, message: string, data?: LogData): void {
    this.log('info', category, message, data);
  }
  
  /**
   * Log a warning
   */
  warn(category: string, message: string, data?: LogData): void {
    this.log('warn', category, message, data);
  }
  
  /**
   * Log an error
   */
  error(category: string, message: string, data?: LogData): void {
    this.log('error', category, message, data);
  }
  
  /**
   * Create a child logger with bound context
   */
  child(context: { traceId?: string; spanId?: string; peerId?: string }): BoundLogger {
    return {
      debug: (category, message, data) => this.log('debug', category, message, { ...data, ...context }),
      info: (category, message, data) => this.log('info', category, message, { ...data, ...context }),
      warn: (category, message, data) => this.log('warn', category, message, { ...data, ...context }),
      error: (category, message, data) => this.log('error', category, message, { ...data, ...context })
    };
  }
  
  /**
   * Query logs
   */
  query(filter: LogFilter): LogEntry[] {
    return this.logs.filter(entry => {
      if (filter.level && entry.level !== filter.level) return false;
      if (filter.category && !entry.category.includes(filter.category)) return false;
      if (filter.traceId && entry.traceId !== filter.traceId) return false;
      if (filter.peerId && entry.peerId !== filter.peerId) return false;
      if (filter.since && entry.timestamp < filter.since) return false;
      if (filter.until && entry.timestamp > filter.until) return false;
      if (filter.search && !entry.message.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  }
  
  /**
   * Get recent logs
   */
  recent(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }
  
  /**
   * Get logs for a specific trace
   */
  forTrace(traceId: string): LogEntry[] {
    return this.logs.filter(e => e.traceId === traceId);
  }
  
  /**
   * Export logs
   */
  export(): LogEntry[] {
    return [...this.logs];
  }
  
  /**
   * Clear logs
   */
  clear(): void {
    this.logs = [];
  }
  
  private log(level: LogLevel, category: string, message: string, data?: LogData): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      agentId: this.agentId,
      traceId: data?.traceId,
      spanId: data?.spanId,
      peerId: data?.peerId,
      data: data ? Object.fromEntries(
        Object.entries(data).filter(([k]) => !['traceId', 'spanId', 'peerId'].includes(k))
      ) : undefined
    };
    
    this.logs.push(entry);
    
    // Enforce log limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-Math.floor(this.maxLogs * 0.8));
    }
    
    this.emit('log', entry);
  }
}

interface LogData extends Record<string, unknown> {
  traceId?: string;
  spanId?: string;
  peerId?: string;
}

export interface LogFilter {
  level?: LogLevel;
  category?: string;
  traceId?: string;
  peerId?: string;
  since?: Date;
  until?: Date;
  search?: string;
}

export interface BoundLogger {
  debug(category: string, message: string, data?: Record<string, unknown>): void;
  info(category: string, message: string, data?: Record<string, unknown>): void;
  warn(category: string, message: string, data?: Record<string, unknown>): void;
  error(category: string, message: string, data?: Record<string, unknown>): void;
}

// ============================================================================
// HEALTH CHECKS - Monitor handshake system health
// ============================================================================

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthStatus>;
  critical: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  timestamp: Date;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthStatus & { critical: boolean }>;
  uptime: number;
}

/**
 * Health monitor for handshake infrastructure
 */
export class HealthMonitor extends EventEmitter {
  private checks: Map<string, HealthCheck> = new Map();
  private lastReport?: HealthReport;
  private startTime: Date = new Date();
  
  constructor(private readonly agentId: string) {
    super();
  }
  
  /**
   * Register a health check
   */
  registerCheck(name: string, check: () => Promise<HealthStatus>, critical: boolean = false): void {
    this.checks.set(name, { name, check, critical });
  }
  
  /**
   * Run all health checks
   */
  async runChecks(): Promise<HealthReport> {
    const checkResults: Record<string, HealthStatus & { critical: boolean }> = {};
    let hasUnhealthy = false;
    let hasCriticalUnhealthy = false;
    
    for (const [name, healthCheck] of this.checks) {
      try {
        const status = await healthCheck.check();
        checkResults[name] = { ...status, critical: healthCheck.critical };
        
        if (!status.healthy) {
          hasUnhealthy = true;
          if (healthCheck.critical) {
            hasCriticalUnhealthy = true;
          }
        }
      } catch (error) {
        checkResults[name] = {
          healthy: false,
          message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          critical: healthCheck.critical
        };
        hasUnhealthy = true;
        if (healthCheck.critical) {
          hasCriticalUnhealthy = true;
        }
      }
    }
    
    const report: HealthReport = {
      timestamp: new Date(),
      overall: hasCriticalUnhealthy ? 'unhealthy' : hasUnhealthy ? 'degraded' : 'healthy',
      checks: checkResults,
      uptime: Date.now() - this.startTime.getTime()
    };
    
    this.lastReport = report;
    this.emit('health', report);
    
    return report;
  }
  
  /**
   * Get last health report
   */
  getLastReport(): HealthReport | undefined {
    return this.lastReport;
  }
  
  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(() => this.runChecks(), intervalMs);
  }
}

// ============================================================================
// ALERTING - Notify on issues
// ============================================================================

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  data?: Record<string, unknown>;
}

export interface AlertRule {
  name: string;
  condition: (metrics: MetricsExport) => boolean;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  cooldownMs: number;
}

/**
 * Alert manager for handshake issues
 */
export class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  
  constructor(private readonly agentId: string) {
    super();
    this.registerDefaultRules();
  }
  
  /**
   * Register default alert rules
   */
  private registerDefaultRules(): void {
    this.registerRule({
      name: 'high_failure_rate',
      condition: (metrics) => {
        const counters = metrics.counters['handshake_total'] || {};
        const total = Object.values(counters).reduce((a, b) => a + b, 0);
        const failed = Object.entries(counters)
          .filter(([k]) => k.includes('status="failed"'))
          .reduce((a, [, v]) => a + v, 0);
        return total > 10 && failed / total > 0.3;
      },
      severity: 'warning',
      message: 'Handshake failure rate above 30%',
      cooldownMs: 300000 // 5 minutes
    });
    
    this.registerRule({
      name: 'slow_handshakes',
      condition: (metrics) => {
        const hist = Object.values(metrics.histograms['handshake_duration_ms'] || {})[0];
        return hist && hist.avg > 5000;
      },
      severity: 'warning',
      message: 'Average handshake duration above 5 seconds',
      cooldownMs: 600000 // 10 minutes
    });
    
    this.registerRule({
      name: 'low_trust',
      condition: (metrics) => {
        const trusts = Object.values(metrics.gauges['trust_level'] || {});
        return trusts.length > 0 && Math.min(...trusts) < 0.2;
      },
      severity: 'info',
      message: 'Trust level with a peer below 20%',
      cooldownMs: 3600000 // 1 hour
    });
  }
  
  /**
   * Register an alert rule
   */
  registerRule(rule: AlertRule): void {
    this.rules.set(rule.name, rule);
  }
  
  /**
   * Evaluate metrics against rules
   */
  evaluateMetrics(metrics: MetricsExport): Alert[] {
    const newAlerts: Alert[] = [];
    const now = Date.now();
    
    for (const [name, rule] of this.rules) {
      const lastAlert = this.lastAlertTime.get(name) ?? 0;
      
      if (now - lastAlert < rule.cooldownMs) {
        continue; // Still in cooldown
      }
      
      try {
        if (rule.condition(metrics)) {
          const alert = this.createAlert(rule.severity, name, rule.message);
          newAlerts.push(alert);
          this.lastAlertTime.set(name, now);
        }
      } catch {
        // Rule evaluation failed, skip
      }
    }
    
    return newAlerts;
  }
  
  /**
   * Create an alert manually
   */
  createAlert(
    severity: Alert['severity'],
    category: string,
    message: string,
    data?: Record<string, unknown>
  ): Alert {
    const alert: Alert = {
      id: uuidv4(),
      severity,
      category,
      message,
      timestamp: new Date(),
      resolved: false,
      data
    };
    
    this.alerts.set(alert.id, alert);
    this.emit('alert', alert);
    
    return alert;
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alert:resolved', alert);
    }
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }
  
  /**
   * Get all alerts
   */
  getAllAlerts(limit: number = 100): Alert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}

// ============================================================================
// UNIFIED OBSERVABILITY - Combine all components
// ============================================================================

/**
 * Complete observability stack for context handshakes
 */
export class HandshakeObservability {
  public readonly tracer: Tracer;
  public readonly metrics: MetricsRegistry;
  public readonly logger: HandshakeLogger;
  public readonly health: HealthMonitor;
  public readonly alerts: AlertManager;
  
  constructor(agentId: string, options: ObservabilityOptions = {}) {
    this.tracer = new Tracer(agentId, options.tracer);
    this.metrics = new MetricsRegistry(agentId);
    this.logger = new HandshakeLogger(agentId, options.logger);
    this.health = new HealthMonitor(agentId);
    this.alerts = new AlertManager(agentId);
    
    // Wire up cross-component integrations
    this.setupIntegrations();
    
    // Register default health checks
    this.registerDefaultHealthChecks();
  }
  
  /**
   * Start observing a handshake
   */
  startHandshake(
    type: string,
    peerId: string,
    metadata?: Record<string, unknown>
  ): HandshakeObserver {
    // Create trace
    const trace = this.tracer.startTrace(`handshake:${type}`, { peerId, ...metadata });
    
    // Set span attributes
    this.tracer.setSpanAttributes(trace.rootSpan.spanId, {
      'handshake.type': type,
      'peer.id': peerId
    });
    
    // Create bound logger
    const log = this.logger.child({ traceId: trace.traceId, peerId });
    
    // Update metrics
    this.metrics.incGauge('active_sessions');
    
    // Log start
    log.info('handshake', `Starting ${type} handshake with ${peerId}`);
    
    return new HandshakeObserver(this, trace, log, type, peerId);
  }
  
  /**
   * Get a dashboard-ready summary
   */
  getDashboard(): DashboardData {
    return {
      summary: this.metrics.getSummary(),
      health: this.health.getLastReport(),
      activeAlerts: this.alerts.getActiveAlerts(),
      recentTraces: this.tracer.exportTraces().slice(-20),
      recentLogs: this.logger.recent(50).map(l => ({
        timestamp: l.timestamp.toISOString(),
        level: l.level,
        category: l.category,
        message: l.message
      }))
    };
  }
  
  /**
   * Export all observability data
   */
  export(): ObservabilityExport {
    return {
      timestamp: new Date().toISOString(),
      traces: this.tracer.exportTraces(),
      metrics: this.metrics.exportJSON(),
      logs: this.logger.export(),
      health: this.health.getLastReport(),
      alerts: this.alerts.getAllAlerts()
    };
  }
  
  private setupIntegrations(): void {
    // Log all alerts
    this.alerts.on('alert', (alert: Alert) => {
      this.logger.warn('alert', alert.message, {
        alertId: alert.id,
        severity: alert.severity,
        category: alert.category
      });
    });
    
    // Log trace completions
    this.tracer.on('trace:end', (trace: Trace) => {
      this.logger.info('trace', `Trace ${trace.name} completed`, {
        traceId: trace.traceId,
        status: trace.status,
        durationMs: trace.totalDurationMs
      });
    });
    
    // Log health changes
    this.health.on('health', (report: HealthReport) => {
      if (report.overall !== 'healthy') {
        this.logger.warn('health', `System health: ${report.overall}`, {
          checks: report.checks
        });
      }
    });
    
    // Evaluate alerts on metrics updates
    this.metrics.on('metric', () => {
      // Throttle alert evaluation
      this.evaluateAlertsDebounced();
    });
  }
  
  private evaluateAlertsTimeout?: NodeJS.Timeout;
  private evaluateAlertsDebounced(): void {
    if (this.evaluateAlertsTimeout) return;
    this.evaluateAlertsTimeout = setTimeout(() => {
      this.alerts.evaluateMetrics(this.metrics.exportJSON());
      this.evaluateAlertsTimeout = undefined;
    }, 1000);
  }
  
  private registerDefaultHealthChecks(): void {
    // Memory usage check
    this.health.registerCheck('memory', async () => {
      const used = process.memoryUsage();
      const heapPercent = used.heapUsed / used.heapTotal;
      return {
        healthy: heapPercent < 0.9,
        message: heapPercent < 0.9 
          ? `Heap usage: ${Math.round(heapPercent * 100)}%`
          : `High heap usage: ${Math.round(heapPercent * 100)}%`,
        details: {
          heapUsed: used.heapUsed,
          heapTotal: used.heapTotal,
          rss: used.rss
        }
      };
    }, false);
    
    // Metrics collection check
    this.health.registerCheck('metrics', async () => {
      const summary = this.metrics.getSummary();
      return {
        healthy: true,
        message: `Tracking ${summary.totalHandshakes} handshakes`,
        details: summary
      };
    }, false);
  }
}

/**
 * Observer for a single handshake operation
 */
export class HandshakeObserver {
  private currentSpan: Span;
  
  constructor(
    private readonly obs: HandshakeObservability,
    private readonly trace: Trace,
    private readonly log: BoundLogger,
    private readonly type: string,
    private readonly peerId: string
  ) {
    this.currentSpan = trace.rootSpan;
  }
  
  get traceId(): string {
    return this.trace.traceId;
  }
  
  get spanId(): string {
    return this.currentSpan.spanId;
  }
  
  /**
   * Start a new span for a sub-operation
   */
  span(name: string, kind: SpanKind = 'internal'): SpanHandle {
    const span = this.obs.tracer.startSpan(this.trace.traceId, name, kind);
    this.currentSpan = span;
    return new SpanHandle(this.obs.tracer, span);
  }
  
  /**
   * Log a handshake event
   */
  event(name: string, data?: Record<string, unknown>): void {
    this.obs.tracer.addSpanEvent(
      this.currentSpan.spanId,
      name,
      data ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ) : {}
    );
    this.log.debug('event', name, data);
  }
  
  /**
   * Record a message sent
   */
  messageSent(messageType: string, sizeBytes: number): void {
    this.obs.metrics.incCounter('handshake_messages_total', {
      direction: 'sent',
      message_type: messageType
    });
    this.obs.metrics.observeHistogram('sync_bandwidth_bytes', sizeBytes, {
      direction: 'sent',
      compressed: 'false'
    });
    this.log.debug('message', `Sent ${messageType} (${sizeBytes} bytes)`);
  }
  
  /**
   * Record a message received
   */
  messageReceived(messageType: string, sizeBytes: number): void {
    this.obs.metrics.incCounter('handshake_messages_total', {
      direction: 'received',
      message_type: messageType
    });
    this.obs.metrics.observeHistogram('sync_bandwidth_bytes', sizeBytes, {
      direction: 'received',
      compressed: 'false'
    });
    this.log.debug('message', `Received ${messageType} (${sizeBytes} bytes)`);
  }
  
  /**
   * Record alignment score
   */
  recordAlignment(score: number): void {
    this.obs.metrics.setGauge('alignment_score', score, { peer_id: this.peerId });
    this.obs.tracer.setSpanAttributes(this.currentSpan.spanId, {
      'alignment.score': score
    });
    this.log.info('alignment', `Alignment with ${this.peerId}: ${(score * 100).toFixed(1)}%`);
  }
  
  /**
   * Record trust level
   */
  recordTrust(level: number): void {
    this.obs.metrics.setGauge('trust_level', level, { peer_id: this.peerId });
    this.log.info('trust', `Trust with ${this.peerId}: ${(level * 100).toFixed(1)}%`);
  }
  
  /**
   * Record context size
   */
  recordContextSize(bytes: number): void {
    this.obs.metrics.setGauge('context_size_bytes', bytes, { agent_id: this.peerId });
  }
  
  /**
   * Complete the handshake successfully
   */
  complete(): void {
    this.obs.tracer.endTrace(this.trace.traceId, 'completed');
    this.obs.metrics.incCounter('handshake_total', { status: 'success', type: this.type });
    this.obs.metrics.decGauge('active_sessions');
    this.obs.metrics.observeHistogram(
      'handshake_duration_ms',
      Date.now() - this.trace.startTime.getTime(),
      { type: this.type }
    );
    this.log.info('handshake', `Handshake completed with ${this.peerId}`);
  }
  
  /**
   * Mark handshake as failed
   */
  fail(error: Error | string): void {
    const message = error instanceof Error ? error.message : error;
    this.obs.tracer.endTrace(this.trace.traceId, 'failed');
    this.obs.metrics.incCounter('handshake_total', { status: 'failed', type: this.type });
    this.obs.metrics.incCounter('sync_errors_total', { error_type: 'handshake_failed' });
    this.obs.metrics.decGauge('active_sessions');
    this.log.error('handshake', `Handshake failed with ${this.peerId}: ${message}`);
  }
  
  /**
   * Get trace context for propagation
   */
  getContext(): TraceContext | null {
    return this.obs.tracer.getTraceContext(this.currentSpan.spanId);
  }
}

/**
 * Handle for managing a single span
 */
export class SpanHandle {
  constructor(
    private readonly tracer: Tracer,
    private readonly span: Span
  ) {}
  
  /**
   * Add attributes to the span
   */
  setAttribute(key: string, value: SpanAttributeValue): this {
    this.tracer.setSpanAttributes(this.span.spanId, { [key]: value });
    return this;
  }
  
  /**
   * Add an event to the span
   */
  addEvent(name: string, attributes?: Record<string, SpanAttributeValue>): this {
    this.tracer.addSpanEvent(this.span.spanId, name, attributes ?? {});
    return this;
  }
  
  /**
   * End the span successfully
   */
  end(): void {
    this.tracer.endSpan(this.span.spanId, { code: 'ok' });
  }
  
  /**
   * End the span with an error
   */
  error(message: string): void {
    this.tracer.endSpan(this.span.spanId, { code: 'error', message });
  }
}

export interface ObservabilityOptions {
  tracer?: TracerOptions;
  logger?: { maxLogs?: number };
}

export interface DashboardData {
  summary: MetricsSummary;
  health?: HealthReport;
  activeAlerts: Alert[];
  recentTraces: TraceExport[];
  recentLogs: Array<{
    timestamp: string;
    level: LogLevel;
    category: string;
    message: string;
  }>;
}

export interface ObservabilityExport {
  timestamp: string;
  traces: TraceExport[];
  metrics: MetricsExport;
  logs: LogEntry[];
  health?: HealthReport;
  alerts: Alert[];
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a new observability stack
 */
export function createObservability(agentId: string, options?: ObservabilityOptions): HandshakeObservability {
  return new HandshakeObservability(agentId, options);
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}
