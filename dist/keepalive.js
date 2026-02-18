/**
 * Keepalive & Drift Detection
 * HEF Evolution Instance 28, Generation 6
 *
 * Like TCP keepalives, but for mental models. During long collaborations,
 * agents can drift apart in understanding. This module detects and corrects
 * divergence before it causes problems.
 *
 * Techniques: G07 (Analogy Mining - TCP keepalive), R04 (Iterate), S03 (Emergent Synthesis)
 */
// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================
export const DEFAULT_KEEPALIVE_CONFIG = {
    intervalMs: 30000,
    probeTimeoutMs: 5000,
    fullResyncIntervalMs: 300000,
    minorDriftThreshold: 0.95,
    resyncThreshold: 0.80,
    divergenceThreshold: 0.50,
    autoCorrect: true,
    adaptiveInterval: true,
    conceptSampling: 0.2,
    maxRetries: 3,
    gracePeriodMs: 60000,
};
// =============================================================================
// KEEPALIVE MANAGER
// =============================================================================
export class KeepaliveManager {
    config;
    sessions = new Map();
    timers = new Map();
    probeSequences = new Map();
    constructor(config = {}) {
        this.config = config;
    }
    /**
     * Start keepalive monitoring for a session
     */
    startMonitoring(sessionId, agentA, agentB, initialAlignment = 1.0, customConfig) {
        const config = { ...DEFAULT_KEEPALIVE_CONFIG, ...this.config, ...customConfig };
        const session = {
            sessionId,
            agentA,
            agentB,
            startTime: Date.now(),
            lastProbe: Date.now(),
            lastSuccessfulSync: Date.now(),
            probesSent: 0,
            probesReceived: 0,
            driftHistory: [],
            currentAlignment: initialAlignment,
            config,
            state: 'active',
        };
        this.sessions.set(sessionId, session);
        this.probeSequences.set(sessionId, 0);
        this.scheduleNextProbe(sessionId);
        return session;
    }
    /**
     * Stop monitoring a session
     */
    stopMonitoring(sessionId) {
        const timer = this.timers.get(sessionId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(sessionId);
        }
        const session = this.sessions.get(sessionId);
        if (session) {
            session.state = 'terminated';
        }
    }
    /**
     * Generate a keepalive probe
     */
    generateProbe(sessionId, model, type = 'heartbeat') {
        const session = this.sessions.get(sessionId);
        if (!session || session.state === 'terminated')
            return null;
        const sequence = this.probeSequences.get(sessionId) || 0;
        this.probeSequences.set(sessionId, sequence + 1);
        // Sample concepts for efficiency
        const conceptSnapshots = this.sampleConcepts(model, session.config.conceptSampling);
        const probe = {
            id: `probe_${sessionId}_${sequence}`,
            sessionId,
            timestamp: Date.now(),
            type,
            payload: {
                modelFingerprint: this.generateFingerprint(model),
                conceptSnapshots,
                assumptionDigest: this.digestAssumptions(model),
                goalVector: this.extractGoalVector(model),
            },
            sequence,
        };
        session.probesSent++;
        session.lastProbe = Date.now();
        return probe;
    }
    /**
     * Process a received probe and generate response
     */
    processProbe(probe, localModel) {
        const session = this.sessions.get(probe.sessionId);
        if (!session) {
            return this.createErrorResponse(probe, 'Session not found');
        }
        session.probesReceived++;
        // Detect drift
        const driftVectors = this.detectDrift(probe, localModel);
        const alignmentScore = this.calculateAlignment(driftVectors);
        // Determine status
        const status = this.classifyAlignment(alignmentScore, session.config);
        // Generate corrections if needed
        const proposedCorrections = status !== 'in_sync'
            ? this.generateCorrections(driftVectors, localModel)
            : undefined;
        // Update session state
        this.updateSessionState(session, alignmentScore, driftVectors);
        return {
            probeId: probe.id,
            responderId: session.agentB,
            timestamp: Date.now(),
            status,
            driftVectors,
            proposedCorrections,
            resyncRequired: status === 'resync_needed' || status === 'diverged',
        };
    }
    /**
     * Apply corrections from a keepalive response
     */
    applyCorrections(corrections, model) {
        let applied = 0;
        let failed = 0;
        let updatedModel = { ...model };
        // Sort by priority
        const sorted = [...corrections].sort((a, b) => b.priority - a.priority);
        for (const patch of sorted) {
            try {
                updatedModel = this.applyPatch(updatedModel, patch);
                applied++;
            }
            catch {
                failed++;
            }
        }
        return { applied, failed, model: updatedModel };
    }
    /**
     * Get session status
     */
    getSessionStatus(sessionId) {
        return this.sessions.get(sessionId) || null;
    }
    /**
     * Force an immediate probe
     */
    forceProbe(sessionId, type = 'alignment_verify') {
        const timer = this.timers.get(sessionId);
        if (timer) {
            clearTimeout(timer);
        }
        this.scheduleNextProbe(sessionId, 0);
    }
    // ===========================================================================
    // PRIVATE METHODS
    // ===========================================================================
    scheduleNextProbe(sessionId, delayOverride) {
        const session = this.sessions.get(sessionId);
        if (!session || session.state === 'terminated')
            return;
        const delay = delayOverride ?? this.calculateInterval(session);
        const timer = setTimeout(() => {
            this.executeProbe(sessionId);
        }, delay);
        this.timers.set(sessionId, timer);
    }
    async executeProbe(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || session.state === 'terminated')
            return;
        // In real implementation, this would send the probe
        // For now, we just schedule the next one
        this.scheduleNextProbe(sessionId);
    }
    calculateInterval(session) {
        if (!session.config.adaptiveInterval) {
            return session.config.intervalMs;
        }
        // Adaptive: more frequent probes when alignment is lower
        const alignmentFactor = Math.max(0.5, session.currentAlignment);
        const baseInterval = session.config.intervalMs;
        // Also consider drift rate
        const recentDrift = this.calculateDriftRate(session);
        const driftFactor = Math.max(0.5, 1 - recentDrift);
        return Math.floor(baseInterval * alignmentFactor * driftFactor);
    }
    calculateDriftRate(session) {
        const recent = session.driftHistory.slice(-5);
        if (recent.length < 2)
            return 0;
        let totalDrift = 0;
        for (let i = 1; i < recent.length; i++) {
            totalDrift += Math.abs(recent[i].alignment - recent[i - 1].alignment);
        }
        return totalDrift / (recent.length - 1);
    }
    sampleConcepts(model, sampleRate) {
        const snapshots = new Map();
        const concepts = Object.keys(model.concepts || {});
        // Always include core concepts
        const coreConcepts = concepts.filter(c => model.concepts[c]?.importance > 0.8);
        // Sample from the rest
        const otherConcepts = concepts.filter(c => !coreConcepts.includes(c));
        const sampleSize = Math.ceil(otherConcepts.length * sampleRate);
        const sampled = this.shuffleArray(otherConcepts).slice(0, sampleSize);
        for (const concept of [...coreConcepts, ...sampled]) {
            const conceptData = model.concepts[concept];
            snapshots.set(concept, {
                concept,
                hash: this.hashConcept(conceptData),
                confidence: conceptData?.confidence || 1,
                lastModified: conceptData?.lastModified || Date.now(),
                dependencies: conceptData?.dependencies || [],
            });
        }
        return snapshots;
    }
    detectDrift(probe, localModel) {
        const vectors = [];
        // Check concept drift
        for (const [concept, remoteSnapshot] of probe.payload.conceptSnapshots) {
            const localConcept = localModel.concepts?.[concept];
            if (!localConcept) {
                vectors.push({
                    dimension: `concept:${concept}`,
                    originalValue: 1,
                    currentValue: 0,
                    delta: -1,
                    severity: 'significant',
                    cause: 'assumption_decay',
                });
                continue;
            }
            const localHash = this.hashConcept(localConcept);
            if (localHash !== remoteSnapshot.hash) {
                const similarity = this.estimateSimilarity(localConcept, remoteSnapshot);
                const delta = 1 - similarity;
                vectors.push({
                    dimension: `concept:${concept}`,
                    originalValue: 1,
                    currentValue: similarity,
                    delta: -delta,
                    severity: this.classifyDriftSeverity(delta),
                    cause: 'interpretation_shift',
                });
            }
        }
        // Check goal drift
        const localGoals = this.extractGoalVector(localModel);
        const remoteGoals = probe.payload.goalVector;
        const goalSimilarity = this.cosineSimilarity(localGoals, remoteGoals);
        if (goalSimilarity < 0.95) {
            vectors.push({
                dimension: 'goals',
                originalValue: 1,
                currentValue: goalSimilarity,
                delta: goalSimilarity - 1,
                severity: this.classifyDriftSeverity(1 - goalSimilarity),
                cause: 'goal_divergence',
            });
        }
        // Check assumption drift
        const localDigest = this.digestAssumptions(localModel);
        if (localDigest !== probe.payload.assumptionDigest) {
            vectors.push({
                dimension: 'assumptions',
                originalValue: 1,
                currentValue: 0.7, // Estimated - would need more sophisticated comparison
                delta: -0.3,
                severity: 'notable',
                cause: 'assumption_decay',
            });
        }
        return vectors;
    }
    calculateAlignment(driftVectors) {
        if (driftVectors.length === 0)
            return 1.0;
        // Weight by severity
        const weights = {
            minimal: 0.1,
            notable: 0.3,
            significant: 0.6,
            critical: 1.0,
        };
        let totalPenalty = 0;
        let totalWeight = 0;
        for (const vector of driftVectors) {
            const weight = weights[vector.severity];
            totalPenalty += Math.abs(vector.delta) * weight;
            totalWeight += weight;
        }
        return Math.max(0, 1 - (totalPenalty / Math.max(1, totalWeight)));
    }
    classifyAlignment(score, config) {
        if (score >= config.minorDriftThreshold)
            return 'in_sync';
        if (score >= config.resyncThreshold)
            return 'minor_drift';
        if (score >= config.divergenceThreshold)
            return 'resync_needed';
        return 'diverged';
    }
    classifyDriftSeverity(delta) {
        if (delta < 0.05)
            return 'minimal';
        if (delta < 0.15)
            return 'notable';
        if (delta < 0.30)
            return 'significant';
        return 'critical';
    }
    generateCorrections(driftVectors, model) {
        const corrections = [];
        for (const vector of driftVectors) {
            if (vector.severity === 'minimal')
                continue;
            if (vector.dimension.startsWith('concept:')) {
                const concept = vector.dimension.replace('concept:', '');
                corrections.push({
                    type: vector.currentValue === 0 ? 'add_concept' : 'update_concept',
                    target: concept,
                    payload: model.concepts?.[concept],
                    priority: vector.severity === 'critical' ? 10 : vector.severity === 'significant' ? 7 : 4,
                    bilateral: true,
                });
            }
            else if (vector.dimension === 'goals') {
                corrections.push({
                    type: 'realign_goal',
                    target: 'goals',
                    payload: this.extractGoalVector(model),
                    priority: 9,
                    bilateral: true,
                });
            }
            else if (vector.dimension === 'assumptions') {
                corrections.push({
                    type: 'refresh_assumption',
                    target: 'assumptions',
                    payload: model.assumptions,
                    priority: 8,
                    bilateral: true,
                });
            }
        }
        return corrections.sort((a, b) => b.priority - a.priority);
    }
    applyPatch(model, patch) {
        const updated = { ...model };
        switch (patch.type) {
            case 'update_concept':
            case 'add_concept':
                updated.concepts[patch.target] = patch.payload;
                break;
            case 'remove_concept':
                delete updated.concepts[patch.target];
                break;
            case 'realign_goal':
                updated.goals = patch.payload;
                break;
            case 'refresh_assumption':
                updated.assumptions = patch.payload;
                break;
        }
        return updated;
    }
    updateSessionState(session, alignment, driftVectors) {
        session.currentAlignment = alignment;
        session.driftHistory.push({
            timestamp: Date.now(),
            alignment,
            driftVectors,
            correctionApplied: false,
            resyncTriggered: false,
        });
        // Trim history
        if (session.driftHistory.length > 100) {
            session.driftHistory = session.driftHistory.slice(-100);
        }
        // Update state
        if (alignment >= session.config.minorDriftThreshold) {
            session.state = 'active';
            session.lastSuccessfulSync = Date.now();
        }
        else if (alignment >= session.config.resyncThreshold) {
            session.state = 'degraded';
        }
        else if (alignment >= session.config.divergenceThreshold) {
            session.state = 'reconnecting';
        }
        else {
            session.state = 'diverged';
        }
    }
    createErrorResponse(probe, error) {
        return {
            probeId: probe.id,
            responderId: 'error',
            timestamp: Date.now(),
            status: 'diverged',
            driftVectors: [{
                    dimension: 'session',
                    originalValue: 1,
                    currentValue: 0,
                    delta: -1,
                    severity: 'critical',
                    cause: 'unknown',
                }],
            resyncRequired: true,
        };
    }
    // ===========================================================================
    // UTILITY METHODS
    // ===========================================================================
    generateFingerprint(model) {
        const content = JSON.stringify({
            conceptCount: Object.keys(model.concepts || {}).length,
            assumptionCount: model.assumptions?.length || 0,
            goalCount: Object.keys(model.goals || {}).length,
        });
        return this.simpleHash(content);
    }
    digestAssumptions(model) {
        return this.simpleHash(JSON.stringify(model.assumptions || []));
    }
    extractGoalVector(model) {
        // Convert goals to a numeric vector for comparison
        const goals = model.goals || {};
        const values = Object.values(goals);
        if (values.length === 0)
            return [0];
        // Normalize to unit vector
        const numeric = values.map(v => typeof v === 'number' ? v : 0.5);
        const magnitude = Math.sqrt(numeric.reduce((sum, n) => sum + n * n, 0));
        return magnitude > 0 ? numeric.map(n => n / magnitude) : numeric;
    }
    hashConcept(concept) {
        return this.simpleHash(JSON.stringify(concept));
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }
    estimateSimilarity(local, remote) {
        const localHash = this.hashConcept(local);
        // Simple comparison - in practice would use semantic similarity
        if (localHash === remote.hash)
            return 1.0;
        // Estimate based on structure
        const localStr = JSON.stringify(local);
        const remoteHash = remote.hash;
        return 0.5 + (0.5 * (1 - Math.abs(localStr.length - parseInt(remoteHash, 16)) / 10000));
    }
    cosineSimilarity(a, b) {
        if (a.length !== b.length)
            return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude > 0 ? dotProduct / magnitude : 0;
    }
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}
// =============================================================================
// DRIFT ANALYZER
// =============================================================================
export class DriftAnalyzer {
    /**
     * Analyze drift patterns over time
     */
    analyzePatterns(history) {
        const patterns = [];
        // Check for cyclic drift
        const cyclicPattern = this.detectCyclicDrift(history);
        if (cyclicPattern)
            patterns.push(cyclicPattern);
        // Check for accelerating drift
        const acceleratingPattern = this.detectAcceleratingDrift(history);
        if (acceleratingPattern)
            patterns.push(acceleratingPattern);
        // Check for sudden divergence
        const suddenPattern = this.detectSuddenDivergence(history);
        if (suddenPattern)
            patterns.push(suddenPattern);
        return patterns;
    }
    detectCyclicDrift(history) {
        if (history.length < 10)
            return null;
        // Look for oscillation in alignment scores
        const alignments = history.map(h => h.alignment);
        let oscillations = 0;
        let direction = 0;
        for (let i = 1; i < alignments.length; i++) {
            const newDirection = Math.sign(alignments[i] - alignments[i - 1]);
            if (newDirection !== 0 && newDirection !== direction) {
                oscillations++;
                direction = newDirection;
            }
        }
        if (oscillations > history.length * 0.4) {
            return {
                type: 'cyclic',
                confidence: oscillations / history.length,
                description: 'Agents are oscillating between agreement and disagreement',
                recommendation: 'Consider stabilizing shared assumptions before continuing',
            };
        }
        return null;
    }
    detectAcceleratingDrift(history) {
        if (history.length < 5)
            return null;
        // Calculate drift rate over time
        const rates = [];
        for (let i = 1; i < history.length; i++) {
            rates.push(Math.abs(history[i].alignment - history[i - 1].alignment));
        }
        // Check if rates are increasing
        let increasing = 0;
        for (let i = 1; i < rates.length; i++) {
            if (rates[i] > rates[i - 1])
                increasing++;
        }
        if (increasing > rates.length * 0.6) {
            return {
                type: 'accelerating',
                confidence: increasing / rates.length,
                description: 'Drift is accelerating - agents are diverging faster over time',
                recommendation: 'Immediate resync recommended to prevent complete divergence',
            };
        }
        return null;
    }
    detectSuddenDivergence(history) {
        if (history.length < 3)
            return null;
        // Look for sudden drops in alignment
        for (let i = 1; i < history.length; i++) {
            const drop = history[i - 1].alignment - history[i].alignment;
            if (drop > 0.3) {
                return {
                    type: 'sudden',
                    confidence: 0.9,
                    description: `Sudden divergence detected at ${new Date(history[i].timestamp).toISOString()}`,
                    recommendation: 'Investigate recent changes that may have caused the split',
                };
            }
        }
        return null;
    }
}
// =============================================================================
// EXPORTS
// =============================================================================
export function createKeepaliveManager(config) {
    return new KeepaliveManager(config);
}
export function createDriftAnalyzer() {
    return new DriftAnalyzer();
}
