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
import { EventEmitter } from 'events';
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
export declare class Tracer extends EventEmitter {
    private readonly agentId;
    private readonly options;
    private traces;
    private spans;
    private activeSpanStack;
    constructor(agentId: string, options?: TracerOptions);
    /**
     * Start a new trace (begins a handshake flow)
     */
    startTrace(name: string, metadata?: Record<string, unknown>): Trace;
    /**
     * Create a new span within a trace
     */
    startSpan(traceId: string, name: string, kind?: SpanKind, parentSpanId?: string): Span;
    /**
     * End a span
     */
    endSpan(spanId: string, status?: SpanStatus): Span;
    /**
     * End a trace
     */
    endTrace(traceId: string, status?: 'completed' | 'failed' | 'timeout'): Trace;
    /**
     * Add an event to a span
     */
    addSpanEvent(spanId: string, name: string, attributes?: Record<string, SpanAttributeValue>): void;
    /**
     * Set span attributes
     */
    setSpanAttributes(spanId: string, attributes: Record<string, SpanAttributeValue>): void;
    /**
     * Link spans across traces (for multi-party handshakes)
     */
    linkSpans(spanId: string, linkedTraceId: string, linkedSpanId: string, attributes?: Record<string, SpanAttributeValue>): void;
    /**
     * Add a participant to a trace
     */
    addParticipant(traceId: string, agentId: string): void;
    /**
     * Get trace context for propagation
     */
    getTraceContext(spanId: string): TraceContext | null;
    /**
     * Continue trace from propagated context
     */
    continueTrace(context: TraceContext, name: string): Span;
    /**
     * Get current active span for a trace
     */
    getActiveSpan(traceId: string): Span | null;
    /**
     * Get a trace by ID
     */
    getTrace(traceId: string): Trace | null;
    /**
     * Get all traces (for debugging)
     */
    getAllTraces(): Trace[];
    /**
     * Export traces in a visualization-friendly format
     */
    exportTraces(): TraceExport[];
    private createSpan;
    private pushActiveSpan;
    private popActiveSpan;
    private enforceTraceLimits;
    private exportSpanTree;
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
    le: number;
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
export declare class MetricsRegistry extends EventEmitter {
    private readonly agentId;
    private metrics;
    private counters;
    private gauges;
    private histograms;
    private histogramBuckets;
    constructor(agentId: string);
    /**
     * Register default handshake metrics
     */
    private registerDefaultMetrics;
    /**
     * Register a new metric
     */
    registerMetric(metric: Metric, buckets?: number[]): void;
    /**
     * Increment a counter
     */
    incCounter(name: string, labels?: Record<string, string>, value?: number): void;
    /**
     * Set a gauge value
     */
    setGauge(name: string, value: number, labels?: Record<string, string>): void;
    /**
     * Increment a gauge
     */
    incGauge(name: string, labels?: Record<string, string>, value?: number): void;
    /**
     * Decrement a gauge
     */
    decGauge(name: string, labels?: Record<string, string>, value?: number): void;
    /**
     * Observe a histogram value
     */
    observeHistogram(name: string, value: number, labels?: Record<string, string>): void;
    /**
     * Time a function and record as histogram
     */
    timeHistogram<T>(name: string, fn: () => Promise<T>, labels?: Record<string, string>): Promise<T>;
    /**
     * Get all metric values in Prometheus exposition format
     */
    exportPrometheus(): string;
    /**
     * Export metrics as JSON
     */
    exportJSON(): MetricsExport;
    /**
     * Get summary statistics
     */
    getSummary(): MetricsSummary;
    private labelsKey;
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
export declare class HandshakeLogger extends EventEmitter {
    private readonly agentId;
    private logs;
    private readonly maxLogs;
    constructor(agentId: string, options?: {
        maxLogs?: number;
    });
    /**
     * Log a debug message
     */
    debug(category: string, message: string, data?: LogData): void;
    /**
     * Log an info message
     */
    info(category: string, message: string, data?: LogData): void;
    /**
     * Log a warning
     */
    warn(category: string, message: string, data?: LogData): void;
    /**
     * Log an error
     */
    error(category: string, message: string, data?: LogData): void;
    /**
     * Create a child logger with bound context
     */
    child(context: {
        traceId?: string;
        spanId?: string;
        peerId?: string;
    }): BoundLogger;
    /**
     * Query logs
     */
    query(filter: LogFilter): LogEntry[];
    /**
     * Get recent logs
     */
    recent(count?: number): LogEntry[];
    /**
     * Get logs for a specific trace
     */
    forTrace(traceId: string): LogEntry[];
    /**
     * Export logs
     */
    export(): LogEntry[];
    /**
     * Clear logs
     */
    clear(): void;
    private log;
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
    checks: Record<string, HealthStatus & {
        critical: boolean;
    }>;
    uptime: number;
}
/**
 * Health monitor for handshake infrastructure
 */
export declare class HealthMonitor extends EventEmitter {
    private readonly agentId;
    private checks;
    private lastReport?;
    private startTime;
    constructor(agentId: string);
    /**
     * Register a health check
     */
    registerCheck(name: string, check: () => Promise<HealthStatus>, critical?: boolean): void;
    /**
     * Run all health checks
     */
    runChecks(): Promise<HealthReport>;
    /**
     * Get last health report
     */
    getLastReport(): HealthReport | undefined;
    /**
     * Start periodic health checks
     */
    startPeriodicChecks(intervalMs?: number): NodeJS.Timeout;
}
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
export declare class AlertManager extends EventEmitter {
    private readonly agentId;
    private alerts;
    private rules;
    private lastAlertTime;
    constructor(agentId: string);
    /**
     * Register default alert rules
     */
    private registerDefaultRules;
    /**
     * Register an alert rule
     */
    registerRule(rule: AlertRule): void;
    /**
     * Evaluate metrics against rules
     */
    evaluateMetrics(metrics: MetricsExport): Alert[];
    /**
     * Create an alert manually
     */
    createAlert(severity: Alert['severity'], category: string, message: string, data?: Record<string, unknown>): Alert;
    /**
     * Resolve an alert
     */
    resolveAlert(alertId: string): void;
    /**
     * Get active alerts
     */
    getActiveAlerts(): Alert[];
    /**
     * Get all alerts
     */
    getAllAlerts(limit?: number): Alert[];
}
/**
 * Complete observability stack for context handshakes
 */
export declare class HandshakeObservability {
    readonly tracer: Tracer;
    readonly metrics: MetricsRegistry;
    readonly logger: HandshakeLogger;
    readonly health: HealthMonitor;
    readonly alerts: AlertManager;
    constructor(agentId: string, options?: ObservabilityOptions);
    /**
     * Start observing a handshake
     */
    startHandshake(type: string, peerId: string, metadata?: Record<string, unknown>): HandshakeObserver;
    /**
     * Get a dashboard-ready summary
     */
    getDashboard(): DashboardData;
    /**
     * Export all observability data
     */
    export(): ObservabilityExport;
    private setupIntegrations;
    private evaluateAlertsTimeout?;
    private evaluateAlertsDebounced;
    private registerDefaultHealthChecks;
}
/**
 * Observer for a single handshake operation
 */
export declare class HandshakeObserver {
    private readonly obs;
    private readonly trace;
    private readonly log;
    private readonly type;
    private readonly peerId;
    private currentSpan;
    constructor(obs: HandshakeObservability, trace: Trace, log: BoundLogger, type: string, peerId: string);
    get traceId(): string;
    get spanId(): string;
    /**
     * Start a new span for a sub-operation
     */
    span(name: string, kind?: SpanKind): SpanHandle;
    /**
     * Log a handshake event
     */
    event(name: string, data?: Record<string, unknown>): void;
    /**
     * Record a message sent
     */
    messageSent(messageType: string, sizeBytes: number): void;
    /**
     * Record a message received
     */
    messageReceived(messageType: string, sizeBytes: number): void;
    /**
     * Record alignment score
     */
    recordAlignment(score: number): void;
    /**
     * Record trust level
     */
    recordTrust(level: number): void;
    /**
     * Record context size
     */
    recordContextSize(bytes: number): void;
    /**
     * Complete the handshake successfully
     */
    complete(): void;
    /**
     * Mark handshake as failed
     */
    fail(error: Error | string): void;
    /**
     * Get trace context for propagation
     */
    getContext(): TraceContext | null;
}
/**
 * Handle for managing a single span
 */
export declare class SpanHandle {
    private readonly tracer;
    private readonly span;
    constructor(tracer: Tracer, span: Span);
    /**
     * Add attributes to the span
     */
    setAttribute(key: string, value: SpanAttributeValue): this;
    /**
     * Add an event to the span
     */
    addEvent(name: string, attributes?: Record<string, SpanAttributeValue>): this;
    /**
     * End the span successfully
     */
    end(): void;
    /**
     * End the span with an error
     */
    error(message: string): void;
}
export interface ObservabilityOptions {
    tracer?: TracerOptions;
    logger?: {
        maxLogs?: number;
    };
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
/**
 * Create a new observability stack
 */
export declare function createObservability(agentId: string, options?: ObservabilityOptions): HandshakeObservability;
/**
 * Format duration for display
 */
export declare function formatDuration(ms: number): string;
/**
 * Format bytes for display
 */
export declare function formatBytes(bytes: number): string;
export {};
