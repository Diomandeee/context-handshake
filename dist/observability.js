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
/**
 * Tracer - Creates and manages spans for handshake operations
 */
export class Tracer extends EventEmitter {
    agentId;
    options;
    traces = new Map();
    spans = new Map();
    activeSpanStack = new Map(); // agentId -> spanId stack
    constructor(agentId, options = {}) {
        super();
        this.agentId = agentId;
        this.options = options;
        this.options.maxTraces = options.maxTraces ?? 1000;
        this.options.maxSpansPerTrace = options.maxSpansPerTrace ?? 100;
        this.options.spanTimeoutMs = options.spanTimeoutMs ?? 60000;
    }
    /**
     * Start a new trace (begins a handshake flow)
     */
    startTrace(name, metadata = {}) {
        const traceId = uuidv4();
        const rootSpan = this.createSpan(traceId, name, 'internal');
        const trace = {
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
    startSpan(traceId, name, kind = 'internal', parentSpanId) {
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
    endSpan(spanId, status) {
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
    endTrace(traceId, status = 'completed') {
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
    addSpanEvent(spanId, name, attributes = {}) {
        const span = this.spans.get(spanId);
        if (!span)
            return;
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
    setSpanAttributes(spanId, attributes) {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        Object.assign(span.attributes, attributes);
    }
    /**
     * Link spans across traces (for multi-party handshakes)
     */
    linkSpans(spanId, linkedTraceId, linkedSpanId, attributes = {}) {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        span.links.push({
            traceId: linkedTraceId,
            spanId: linkedSpanId,
            attributes
        });
    }
    /**
     * Add a participant to a trace
     */
    addParticipant(traceId, agentId) {
        const trace = this.traces.get(traceId);
        if (trace && !trace.participants.includes(agentId)) {
            trace.participants.push(agentId);
        }
    }
    /**
     * Get trace context for propagation
     */
    getTraceContext(spanId) {
        const span = this.spans.get(spanId);
        if (!span)
            return null;
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
    continueTrace(context, name) {
        let trace = this.traces.get(context.traceId);
        if (!trace) {
            // Create local representation of remote trace
            trace = {
                traceId: context.traceId,
                name,
                startTime: new Date(),
                status: 'active',
                rootSpan: null,
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
    getActiveSpan(traceId) {
        const stack = this.activeSpanStack.get(traceId);
        if (!stack || stack.length === 0)
            return null;
        return this.spans.get(stack[stack.length - 1]) ?? null;
    }
    /**
     * Get a trace by ID
     */
    getTrace(traceId) {
        return this.traces.get(traceId) ?? null;
    }
    /**
     * Get all traces (for debugging)
     */
    getAllTraces() {
        return Array.from(this.traces.values());
    }
    /**
     * Export traces in a visualization-friendly format
     */
    exportTraces() {
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
    createSpan(traceId, name, kind, parentSpanId) {
        const span = {
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
    pushActiveSpan(traceId, spanId) {
        if (!this.activeSpanStack.has(traceId)) {
            this.activeSpanStack.set(traceId, []);
        }
        this.activeSpanStack.get(traceId).push(spanId);
    }
    popActiveSpan(traceId, spanId) {
        const stack = this.activeSpanStack.get(traceId);
        if (stack) {
            const index = stack.lastIndexOf(spanId);
            if (index !== -1) {
                stack.splice(index, 1);
            }
        }
    }
    enforceTraceLimits() {
        if (this.traces.size > this.options.maxTraces) {
            // Remove oldest completed traces
            const sorted = Array.from(this.traces.entries())
                .filter(([, t]) => t.status !== 'active')
                .sort(([, a], [, b]) => a.startTime.getTime() - b.startTime.getTime());
            const toRemove = sorted.slice(0, Math.floor(this.options.maxTraces * 0.2));
            toRemove.forEach(([id]) => {
                this.traces.delete(id);
                // Clean up related spans
                Array.from(this.spans.entries())
                    .filter(([, s]) => s.traceId === id)
                    .forEach(([spanId]) => this.spans.delete(spanId));
            });
        }
    }
    exportSpanTree(span) {
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
/**
 * Metrics Registry - Collect and export handshake metrics
 */
export class MetricsRegistry extends EventEmitter {
    agentId;
    metrics = new Map();
    counters = new Map();
    gauges = new Map();
    histograms = new Map();
    histogramBuckets = new Map();
    constructor(agentId) {
        super();
        this.agentId = agentId;
        this.registerDefaultMetrics();
    }
    /**
     * Register default handshake metrics
     */
    registerDefaultMetrics() {
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
    registerMetric(metric, buckets) {
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
    incCounter(name, labels = {}, value = 1) {
        const counter = this.counters.get(name);
        if (!counter)
            return;
        const key = this.labelsKey(labels);
        counter.set(key, (counter.get(key) ?? 0) + value);
        this.emit('metric', { metric: name, value, labels, timestamp: new Date() });
    }
    /**
     * Set a gauge value
     */
    setGauge(name, value, labels = {}) {
        const gauge = this.gauges.get(name);
        if (!gauge)
            return;
        const key = this.labelsKey(labels);
        gauge.set(key, value);
        this.emit('metric', { metric: name, value, labels, timestamp: new Date() });
    }
    /**
     * Increment a gauge
     */
    incGauge(name, labels = {}, value = 1) {
        const gauge = this.gauges.get(name);
        if (!gauge)
            return;
        const key = this.labelsKey(labels);
        gauge.set(key, (gauge.get(key) ?? 0) + value);
    }
    /**
     * Decrement a gauge
     */
    decGauge(name, labels = {}, value = 1) {
        this.incGauge(name, labels, -value);
    }
    /**
     * Observe a histogram value
     */
    observeHistogram(name, value, labels = {}) {
        const histogram = this.histograms.get(name);
        const buckets = this.histogramBuckets.get(name);
        if (!histogram || !buckets)
            return;
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
    async timeHistogram(name, fn, labels = {}) {
        const start = performance.now();
        try {
            return await fn();
        }
        finally {
            const duration = performance.now() - start;
            this.observeHistogram(name, duration, labels);
        }
    }
    /**
     * Get all metric values in Prometheus exposition format
     */
    exportPrometheus() {
        const lines = [];
        for (const [name, metric] of this.metrics) {
            lines.push(`# HELP ${name} ${metric.description}`);
            lines.push(`# TYPE ${name} ${metric.type}`);
            switch (metric.type) {
                case 'counter': {
                    const counter = this.counters.get(name);
                    for (const [labelsKey, value] of counter) {
                        const labels = labelsKey ? `{${labelsKey}}` : '';
                        lines.push(`${name}${labels} ${value}`);
                    }
                    break;
                }
                case 'gauge': {
                    const gauge = this.gauges.get(name);
                    for (const [labelsKey, value] of gauge) {
                        const labels = labelsKey ? `{${labelsKey}}` : '';
                        lines.push(`${name}${labels} ${value}`);
                    }
                    break;
                }
                case 'histogram': {
                    const histogram = this.histograms.get(name);
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
    exportJSON() {
        const result = {
            agentId: this.agentId,
            timestamp: new Date().toISOString(),
            counters: {},
            gauges: {},
            histograms: {}
        };
        for (const [name, counter] of this.counters) {
            result.counters[name] = Object.fromEntries(Array.from(counter.entries()).map(([k, v]) => [k || '_total', v]));
        }
        for (const [name, gauge] of this.gauges) {
            result.gauges[name] = Object.fromEntries(Array.from(gauge.entries()).map(([k, v]) => [k || '_value', v]));
        }
        for (const [name, histogram] of this.histograms) {
            result.histograms[name] = Object.fromEntries(Array.from(histogram.entries()).map(([k, v]) => [k || '_default', {
                    buckets: v.buckets,
                    sum: v.sum,
                    count: v.count,
                    avg: v.count > 0 ? v.sum / v.count : 0
                }]));
        }
        return result;
    }
    /**
     * Get summary statistics
     */
    getSummary() {
        const handshakes = this.counters.get('handshake_total') ?? new Map();
        const durations = this.histograms.get('handshake_duration_ms') ?? new Map();
        let totalHandshakes = 0;
        let successfulHandshakes = 0;
        let failedHandshakes = 0;
        for (const [key, value] of handshakes) {
            totalHandshakes += value;
            if (key.includes('status="success"'))
                successfulHandshakes += value;
            if (key.includes('status="failed"'))
                failedHandshakes += value;
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
    labelsKey(labels) {
        return Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
    }
}
/**
 * Structured logger for handshake debugging
 */
export class HandshakeLogger extends EventEmitter {
    agentId;
    logs = [];
    maxLogs;
    constructor(agentId, options = {}) {
        super();
        this.agentId = agentId;
        this.maxLogs = options.maxLogs ?? 10000;
    }
    /**
     * Log a debug message
     */
    debug(category, message, data) {
        this.log('debug', category, message, data);
    }
    /**
     * Log an info message
     */
    info(category, message, data) {
        this.log('info', category, message, data);
    }
    /**
     * Log a warning
     */
    warn(category, message, data) {
        this.log('warn', category, message, data);
    }
    /**
     * Log an error
     */
    error(category, message, data) {
        this.log('error', category, message, data);
    }
    /**
     * Create a child logger with bound context
     */
    child(context) {
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
    query(filter) {
        return this.logs.filter(entry => {
            if (filter.level && entry.level !== filter.level)
                return false;
            if (filter.category && !entry.category.includes(filter.category))
                return false;
            if (filter.traceId && entry.traceId !== filter.traceId)
                return false;
            if (filter.peerId && entry.peerId !== filter.peerId)
                return false;
            if (filter.since && entry.timestamp < filter.since)
                return false;
            if (filter.until && entry.timestamp > filter.until)
                return false;
            if (filter.search && !entry.message.toLowerCase().includes(filter.search.toLowerCase()))
                return false;
            return true;
        });
    }
    /**
     * Get recent logs
     */
    recent(count = 100) {
        return this.logs.slice(-count);
    }
    /**
     * Get logs for a specific trace
     */
    forTrace(traceId) {
        return this.logs.filter(e => e.traceId === traceId);
    }
    /**
     * Export logs
     */
    export() {
        return [...this.logs];
    }
    /**
     * Clear logs
     */
    clear() {
        this.logs = [];
    }
    log(level, category, message, data) {
        const entry = {
            timestamp: new Date(),
            level,
            category,
            message,
            agentId: this.agentId,
            traceId: data?.traceId,
            spanId: data?.spanId,
            peerId: data?.peerId,
            data: data ? Object.fromEntries(Object.entries(data).filter(([k]) => !['traceId', 'spanId', 'peerId'].includes(k))) : undefined
        };
        this.logs.push(entry);
        // Enforce log limit
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-Math.floor(this.maxLogs * 0.8));
        }
        this.emit('log', entry);
    }
}
/**
 * Health monitor for handshake infrastructure
 */
export class HealthMonitor extends EventEmitter {
    agentId;
    checks = new Map();
    lastReport;
    startTime = new Date();
    constructor(agentId) {
        super();
        this.agentId = agentId;
    }
    /**
     * Register a health check
     */
    registerCheck(name, check, critical = false) {
        this.checks.set(name, { name, check, critical });
    }
    /**
     * Run all health checks
     */
    async runChecks() {
        const checkResults = {};
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
            }
            catch (error) {
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
        const report = {
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
    getLastReport() {
        return this.lastReport;
    }
    /**
     * Start periodic health checks
     */
    startPeriodicChecks(intervalMs = 30000) {
        return setInterval(() => this.runChecks(), intervalMs);
    }
}
/**
 * Alert manager for handshake issues
 */
export class AlertManager extends EventEmitter {
    agentId;
    alerts = new Map();
    rules = new Map();
    lastAlertTime = new Map();
    constructor(agentId) {
        super();
        this.agentId = agentId;
        this.registerDefaultRules();
    }
    /**
     * Register default alert rules
     */
    registerDefaultRules() {
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
    registerRule(rule) {
        this.rules.set(rule.name, rule);
    }
    /**
     * Evaluate metrics against rules
     */
    evaluateMetrics(metrics) {
        const newAlerts = [];
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
            }
            catch {
                // Rule evaluation failed, skip
            }
        }
        return newAlerts;
    }
    /**
     * Create an alert manually
     */
    createAlert(severity, category, message, data) {
        const alert = {
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
    resolveAlert(alertId) {
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
    getActiveAlerts() {
        return Array.from(this.alerts.values()).filter(a => !a.resolved);
    }
    /**
     * Get all alerts
     */
    getAllAlerts(limit = 100) {
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
    tracer;
    metrics;
    logger;
    health;
    alerts;
    constructor(agentId, options = {}) {
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
    startHandshake(type, peerId, metadata) {
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
    getDashboard() {
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
    export() {
        return {
            timestamp: new Date().toISOString(),
            traces: this.tracer.exportTraces(),
            metrics: this.metrics.exportJSON(),
            logs: this.logger.export(),
            health: this.health.getLastReport(),
            alerts: this.alerts.getAllAlerts()
        };
    }
    setupIntegrations() {
        // Log all alerts
        this.alerts.on('alert', (alert) => {
            this.logger.warn('alert', alert.message, {
                alertId: alert.id,
                severity: alert.severity,
                category: alert.category
            });
        });
        // Log trace completions
        this.tracer.on('trace:end', (trace) => {
            this.logger.info('trace', `Trace ${trace.name} completed`, {
                traceId: trace.traceId,
                status: trace.status,
                durationMs: trace.totalDurationMs
            });
        });
        // Log health changes
        this.health.on('health', (report) => {
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
    evaluateAlertsTimeout;
    evaluateAlertsDebounced() {
        if (this.evaluateAlertsTimeout)
            return;
        this.evaluateAlertsTimeout = setTimeout(() => {
            this.alerts.evaluateMetrics(this.metrics.exportJSON());
            this.evaluateAlertsTimeout = undefined;
        }, 1000);
    }
    registerDefaultHealthChecks() {
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
    obs;
    trace;
    log;
    type;
    peerId;
    currentSpan;
    constructor(obs, trace, log, type, peerId) {
        this.obs = obs;
        this.trace = trace;
        this.log = log;
        this.type = type;
        this.peerId = peerId;
        this.currentSpan = trace.rootSpan;
    }
    get traceId() {
        return this.trace.traceId;
    }
    get spanId() {
        return this.currentSpan.spanId;
    }
    /**
     * Start a new span for a sub-operation
     */
    span(name, kind = 'internal') {
        const span = this.obs.tracer.startSpan(this.trace.traceId, name, kind);
        this.currentSpan = span;
        return new SpanHandle(this.obs.tracer, span);
    }
    /**
     * Log a handshake event
     */
    event(name, data) {
        this.obs.tracer.addSpanEvent(this.currentSpan.spanId, name, data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {});
        this.log.debug('event', name, data);
    }
    /**
     * Record a message sent
     */
    messageSent(messageType, sizeBytes) {
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
    messageReceived(messageType, sizeBytes) {
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
    recordAlignment(score) {
        this.obs.metrics.setGauge('alignment_score', score, { peer_id: this.peerId });
        this.obs.tracer.setSpanAttributes(this.currentSpan.spanId, {
            'alignment.score': score
        });
        this.log.info('alignment', `Alignment with ${this.peerId}: ${(score * 100).toFixed(1)}%`);
    }
    /**
     * Record trust level
     */
    recordTrust(level) {
        this.obs.metrics.setGauge('trust_level', level, { peer_id: this.peerId });
        this.log.info('trust', `Trust with ${this.peerId}: ${(level * 100).toFixed(1)}%`);
    }
    /**
     * Record context size
     */
    recordContextSize(bytes) {
        this.obs.metrics.setGauge('context_size_bytes', bytes, { agent_id: this.peerId });
    }
    /**
     * Complete the handshake successfully
     */
    complete() {
        this.obs.tracer.endTrace(this.trace.traceId, 'completed');
        this.obs.metrics.incCounter('handshake_total', { status: 'success', type: this.type });
        this.obs.metrics.decGauge('active_sessions');
        this.obs.metrics.observeHistogram('handshake_duration_ms', Date.now() - this.trace.startTime.getTime(), { type: this.type });
        this.log.info('handshake', `Handshake completed with ${this.peerId}`);
    }
    /**
     * Mark handshake as failed
     */
    fail(error) {
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
    getContext() {
        return this.obs.tracer.getTraceContext(this.currentSpan.spanId);
    }
}
/**
 * Handle for managing a single span
 */
export class SpanHandle {
    tracer;
    span;
    constructor(tracer, span) {
        this.tracer = tracer;
        this.span = span;
    }
    /**
     * Add attributes to the span
     */
    setAttribute(key, value) {
        this.tracer.setSpanAttributes(this.span.spanId, { [key]: value });
        return this;
    }
    /**
     * Add an event to the span
     */
    addEvent(name, attributes) {
        this.tracer.addSpanEvent(this.span.spanId, name, attributes ?? {});
        return this;
    }
    /**
     * End the span successfully
     */
    end() {
        this.tracer.endSpan(this.span.spanId, { code: 'ok' });
    }
    /**
     * End the span with an error
     */
    error(message) {
        this.tracer.endSpan(this.span.spanId, { code: 'error', message });
    }
}
// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================
/**
 * Create a new observability stack
 */
export function createObservability(agentId, options) {
    return new HandshakeObservability(agentId, options);
}
/**
 * Format duration for display
 */
export function formatDuration(ms) {
    if (ms < 1000)
        return `${ms.toFixed(0)}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
}
/**
 * Format bytes for display
 */
export function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes}B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}
