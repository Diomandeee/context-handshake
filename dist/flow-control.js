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
export var ChunkPriority;
(function (ChunkPriority) {
    ChunkPriority[ChunkPriority["CRITICAL"] = 0] = "CRITICAL";
    ChunkPriority[ChunkPriority["HIGH"] = 1] = "HIGH";
    ChunkPriority[ChunkPriority["NORMAL"] = 2] = "NORMAL";
    ChunkPriority[ChunkPriority["LOW"] = 3] = "LOW";
    ChunkPriority[ChunkPriority["BACKGROUND"] = 4] = "BACKGROUND";
})(ChunkPriority || (ChunkPriority = {}));
// ============================================================================
// Flow Control Manager
// ============================================================================
export class FlowControlManager extends EventEmitter {
    config;
    sendState;
    receiveState;
    pendingChunks = [];
    retryTimers = new Map();
    isPaused = false;
    pauseUntil = 0;
    constructor(config = {}) {
        super();
        this.config = {
            initialWindow: 10,
            maxWindow: 100,
            minWindow: 1,
            initialSsthresh: 50,
            tokenBudget: 8000, // ~8K tokens default
            ackTimeout: 5000,
            maxRetries: 3,
            slowStartIncrease: 1, // Double each RTT in slow start
            congestionAvoidanceIncrease: 0.1, // Linear increase
            multiplicativeDecrease: 0.5, // Halve on loss
            ...config,
        };
        this.sendState = this.createInitialFlowState();
        this.receiveState = this.createInitialFlowState();
    }
    createInitialFlowState() {
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
    async send(payload, priority = ChunkPriority.NORMAL) {
        const chunk = this.createChunk(payload, priority);
        if (this.canSendNow(chunk)) {
            await this.transmitChunk(chunk);
        }
        else {
            this.queueChunk(chunk);
        }
        return chunk.id;
    }
    /** Send multiple chunks respecting flow control */
    async sendBatch(payloads) {
        const chunks = payloads.map(({ payload, priority }) => this.createChunk(payload, priority ?? ChunkPriority.NORMAL));
        // Sort by priority
        chunks.sort((a, b) => a.priority - b.priority);
        const ids = [];
        for (const chunk of chunks) {
            if (this.canSendNow(chunk)) {
                await this.transmitChunk(chunk);
            }
            else {
                this.queueChunk(chunk);
            }
            ids.push(chunk.id);
        }
        return ids;
    }
    createChunk(payload, priority) {
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
    canSendNow(chunk) {
        if (this.isPaused && Date.now() < this.pauseUntil) {
            return false;
        }
        const effectiveWindow = Math.min(this.sendState.sendWindow, this.sendState.congestionWindow);
        const inFlight = this.sendState.unackedChunks.size;
        const wouldExceedWindow = inFlight >= effectiveWindow;
        const wouldExceedTokens = this.sendState.tokensInFlight + chunk.tokenEstimate > this.config.tokenBudget;
        // Critical chunks bypass some limits
        if (chunk.priority === ChunkPriority.CRITICAL) {
            return !wouldExceedTokens || inFlight < this.config.minWindow;
        }
        return !wouldExceedWindow && !wouldExceedTokens;
    }
    async transmitChunk(chunk) {
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
    queueChunk(chunk) {
        // Insert sorted by priority
        const idx = this.pendingChunks.findIndex(c => c.priority > chunk.priority);
        if (idx === -1) {
            this.pendingChunks.push(chunk);
        }
        else {
            this.pendingChunks.splice(idx, 0, chunk);
        }
        this.emit('queued', { chunk, queueLength: this.pendingChunks.length });
    }
    async flushQueue() {
        while (this.pendingChunks.length > 0) {
            const chunk = this.pendingChunks[0];
            if (this.canSendNow(chunk)) {
                this.pendingChunks.shift();
                await this.transmitChunk(chunk);
            }
            else {
                break;
            }
        }
    }
    // --------------------------------------------------------------------------
    // Receiving
    // --------------------------------------------------------------------------
    /** Process received chunk */
    async receive(chunk) {
        // Check if expected
        if (chunk.sequenceNumber === this.receiveState.expectedSeq) {
            // In order - process immediately
            await this.processChunk(chunk);
            this.receiveState.expectedSeq++;
            // Process any buffered chunks that are now in order
            await this.processBufferedChunks();
        }
        else if (chunk.sequenceNumber > this.receiveState.expectedSeq) {
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
    async processChunk(chunk) {
        const startTime = Date.now();
        // Emit for processing
        this.emit('process', chunk);
        this.receiveState.processedSeq = chunk.sequenceNumber;
        const processingTime = Date.now() - startTime;
        this.emit('processed', { chunk, processingTime });
    }
    async processBufferedChunks() {
        while (this.receiveState.receiveBuffer.has(this.receiveState.expectedSeq)) {
            const chunk = this.receiveState.receiveBuffer.get(this.receiveState.expectedSeq);
            this.receiveState.receiveBuffer.delete(this.receiveState.expectedSeq);
            await this.processChunk(chunk);
            this.receiveState.expectedSeq++;
        }
    }
    generateAck() {
        // Build selective ACK for gaps
        const selectiveAck = [];
        const bufferedSeqs = [...this.receiveState.receiveBuffer.keys()].sort((a, b) => a - b);
        let rangeStart = -1;
        let rangeEnd = -1;
        for (const seq of bufferedSeqs) {
            if (rangeStart === -1) {
                rangeStart = rangeEnd = seq;
            }
            else if (seq === rangeEnd + 1) {
                rangeEnd = seq;
            }
            else {
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
    findMissingChunks() {
        const missing = [];
        const bufferedSeqs = new Set(this.receiveState.receiveBuffer.keys());
        if (bufferedSeqs.size === 0)
            return missing;
        const maxBuffered = Math.max(...bufferedSeqs);
        for (let seq = this.receiveState.expectedSeq; seq < maxBuffered; seq++) {
            if (!bufferedSeqs.has(seq)) {
                missing.push(String(seq));
            }
        }
        return missing;
    }
    calculateReceiveWindow() {
        const bufferUsage = this.receiveState.receiveBuffer.size;
        const available = this.config.maxWindow - bufferUsage;
        return Math.max(this.config.minWindow, available);
    }
    getRemainingTokenBudget() {
        // Calculate tokens in receive buffer
        let bufferedTokens = 0;
        for (const chunk of this.receiveState.receiveBuffer.values()) {
            bufferedTokens += chunk.tokenEstimate;
        }
        return Math.max(0, this.config.tokenBudget - bufferedTokens);
    }
    getAcceptingTypes() {
        // Under pressure, only accept high-priority types
        if (this.receiveState.receiveBuffer.size > this.config.maxWindow * 0.8) {
            return ['belief', 'constraint', 'goal'];
        }
        return ['belief', 'capability', 'constraint', 'goal', 'memory', 'preference'];
    }
    calculateProcessingRate() {
        // Would be calculated from recent processing history
        return 10; // chunks per second default
    }
    estimateProcessingLatency() {
        const bufferSize = this.receiveState.receiveBuffer.size;
        const rate = this.calculateProcessingRate();
        return bufferSize * (1000 / rate);
    }
    calculateBackpressure() {
        const bufferRatio = this.receiveState.receiveBuffer.size / this.config.maxWindow;
        if (bufferRatio >= 0.95) {
            return {
                type: 'pause',
                severity: 1.0,
                pauseMs: 5000,
                reason: 'Buffer nearly full',
            };
        }
        else if (bufferRatio >= 0.8) {
            return {
                type: 'drop_priority',
                severity: 0.8,
                dropBelow: ChunkPriority.LOW,
                reason: 'Buffer pressure high',
            };
        }
        else if (bufferRatio >= 0.6) {
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
    async handleAck(ack) {
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
        }
        else {
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
    updateRtt(sampleRtt) {
        // Exponentially weighted moving average
        const alpha = 0.125;
        const beta = 0.25;
        const rttDiff = Math.abs(sampleRtt - this.sendState.rtt);
        this.sendState.rttVariance =
            (1 - beta) * this.sendState.rttVariance + beta * rttDiff;
        this.sendState.rtt =
            (1 - alpha) * this.sendState.rtt + alpha * sampleRtt;
    }
    calculateTimeout() {
        // RTO = RTT + 4 * variance (TCP formula)
        return Math.max(this.config.ackTimeout, this.sendState.rtt + 4 * this.sendState.rttVariance);
    }
    handleTimeout(seq) {
        const chunk = this.sendState.unackedChunks.get(seq);
        if (!chunk)
            return;
        this.emit('timeout', { seq, chunk });
        // Congestion event
        this.adjustCongestionWindow(false);
        // Retransmit
        this.retransmit(chunk);
    }
    handleFastRetransmit(seq) {
        const chunk = this.sendState.unackedChunks.get(seq);
        if (!chunk)
            return;
        this.emit('fast-retransmit', { seq, chunk });
        // Less aggressive than timeout
        this.sendState.ssthresh = Math.max(this.sendState.congestionWindow / 2, this.config.minWindow);
        this.sendState.congestionWindow = this.sendState.ssthresh + 3;
        this.retransmit(chunk);
        this.sendState.duplicateAcks = 0;
    }
    retransmit(chunk) {
        // Reset timer
        const timer = this.retryTimers.get(chunk.sequenceNumber);
        if (timer) {
            clearTimeout(timer);
        }
        const timeout = this.calculateTimeout() * 2; // Back off
        this.retryTimers.set(chunk.sequenceNumber, setTimeout(() => this.handleTimeout(chunk.sequenceNumber), timeout));
        this.emit('transmit', chunk);
    }
    adjustCongestionWindow(success) {
        if (success) {
            // Increase
            if (this.sendState.congestionWindow < this.sendState.ssthresh) {
                // Slow start - exponential increase
                this.sendState.congestionWindow += this.config.slowStartIncrease;
            }
            else {
                // Congestion avoidance - linear increase
                this.sendState.congestionWindow += this.config.congestionAvoidanceIncrease;
            }
            // Cap at max
            this.sendState.congestionWindow = Math.min(this.sendState.congestionWindow, this.config.maxWindow);
        }
        else {
            // Decrease (loss event)
            this.sendState.ssthresh = Math.max(this.sendState.congestionWindow * this.config.multiplicativeDecrease, this.config.minWindow);
            this.sendState.congestionWindow = this.config.minWindow;
        }
        this.emit('cwnd-change', {
            congestionWindow: this.sendState.congestionWindow,
            ssthresh: this.sendState.ssthresh,
        });
    }
    handleBackpressure(signal) {
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
                this.sendState.congestionWindow = Math.max(this.sendState.congestionWindow * (1 - signal.severity * 0.5), this.config.minWindow);
                break;
            case 'drop_priority':
                // Drop low priority chunks from queue
                if (signal.dropBelow !== undefined) {
                    this.pendingChunks.splice(0, this.pendingChunks.length, ...this.pendingChunks.filter(c => c.priority < signal.dropBelow));
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
    getMetrics() {
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
    reset() {
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
    async close() {
        // Wait for in-flight to drain or timeout
        const deadline = Date.now() + 10000;
        while (this.sendState.unackedChunks.size > 0 && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.reset();
        this.emit('close');
    }
}
// ============================================================================
// Adaptive Flow Control
// ============================================================================
/**
 * Learns optimal flow control parameters from collaboration history
 */
export class AdaptiveFlowController {
    history = [];
    agentProfiles = new Map();
    /** Record a completed exchange */
    recordExchange(agentId, metrics, outcome) {
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
    getOptimizedConfig(agentId) {
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
    updateAgentProfile(agentId, metrics, outcome) {
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
// ============================================================================
// Priority Queue with Aging
// ============================================================================
/**
 * Prevents starvation of low-priority chunks through aging
 */
export class AgingPriorityQueue {
    chunks = [];
    agingRateMs;
    constructor(agingRateMs = 10000) {
        this.agingRateMs = agingRateMs;
    }
    enqueue(chunk) {
        this.chunks.push({ chunk, insertTime: Date.now() });
    }
    dequeue() {
        if (this.chunks.length === 0)
            return undefined;
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
    effectivePriority(item, now) {
        const age = now - item.insertTime;
        const agingBonus = Math.floor(age / this.agingRateMs);
        return Math.max(0, item.chunk.priority - agingBonus);
    }
    get length() {
        return this.chunks.length;
    }
    peek() {
        return this.chunks[0]?.chunk;
    }
}
// ============================================================================
// Exports
// ============================================================================
export default FlowControlManager;
