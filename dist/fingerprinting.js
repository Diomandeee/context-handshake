/**
 * Context Fingerprinting - Gen 6 Evolution (Instance 28)
 *
 * Quick re-sync for agents who've collaborated before.
 * Like TLS session resumption - skip the full handshake when
 * both parties have a shared history.
 *
 * The Problem:
 * Full context handshakes are expensive. When Agent A and Agent B
 * have collaborated 10 times before, they shouldn't need to re-sync
 * their entire mental models each time.
 *
 * The Solution:
 * Context Fingerprinting creates compact, cryptographic signatures
 * of mental model states. Agents can compare fingerprints and only
 * sync the deltas.
 */
// ============================================================
// FINGERPRINT GENERATION
// ============================================================
/**
 * Generate a fingerprint from a mental model
 */
export function generateFingerprint(agentId, model, parentFingerprint) {
    const conceptVersions = extractConceptVersions(model);
    const semanticVector = computeSemanticVector(model);
    const modelHash = hashMentalModel(model);
    // Check stability - how much has changed from parent?
    let stabilityCount = 0;
    if (parentFingerprint) {
        const similarity = computeVectorSimilarity(semanticVector, parentFingerprint.semanticVector);
        if (similarity > 0.95) {
            stabilityCount = parentFingerprint.stabilityCount + 1;
        }
    }
    return {
        id: generateFingerprintId(agentId, modelHash),
        agentId,
        modelHash,
        semanticVector,
        conceptVersions,
        generatedAt: new Date(),
        stabilityCount,
        parentId: parentFingerprint?.id
    };
}
/**
 * Extract versioned concepts from a mental model
 */
function extractConceptVersions(model) {
    const versions = new Map();
    // Hash each domain's content to get a version number
    for (const [domain, content] of Object.entries(model.domains || {})) {
        versions.set(`domain:${domain}`, hashContent(content));
    }
    // Version each assumption
    for (const [key, assumption] of Object.entries(model.assumptions || {})) {
        versions.set(`assumption:${key}`, hashContent(assumption));
    }
    // Version goals
    for (const goal of model.goals || []) {
        versions.set(`goal:${goal.id}`, hashContent(goal));
    }
    // Version capabilities
    for (const cap of model.capabilities || []) {
        versions.set(`capability:${cap.name}`, hashContent(cap));
    }
    return versions;
}
/**
 * Compute a semantic vector embedding of the mental model
 * This captures the "meaning shape" of the model
 */
function computeSemanticVector(model) {
    // In production, this would use a real embedding model
    // For now, create a deterministic pseudo-embedding
    const vector = new Array(128).fill(0);
    const modelString = JSON.stringify(model);
    for (let i = 0; i < modelString.length; i++) {
        const charCode = modelString.charCodeAt(i);
        vector[i % 128] += charCode * 0.001;
    }
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map(v => v / magnitude);
}
// ============================================================
// FINGERPRINT COMPARISON
// ============================================================
/**
 * Compare two fingerprints to determine sync strategy
 */
export function compareFingerprints(mine, theirs) {
    // Compute semantic similarity
    const similarity = computeVectorSimilarity(mine.semanticVector, theirs.semanticVector);
    // Find diverged concepts
    const divergedConcepts = [];
    const newInMine = [];
    const newInTheirs = [];
    const allConcepts = new Set([
        ...mine.conceptVersions.keys(),
        ...theirs.conceptVersions.keys()
    ]);
    for (const concept of allConcepts) {
        const myVersion = mine.conceptVersions.get(concept);
        const theirVersion = theirs.conceptVersions.get(concept);
        if (myVersion === undefined) {
            newInTheirs.push(concept);
        }
        else if (theirVersion === undefined) {
            newInMine.push(concept);
        }
        else if (myVersion !== theirVersion) {
            divergedConcepts.push(concept);
        }
    }
    // Calculate sync overhead
    const totalConcepts = allConcepts.size;
    const changedConcepts = divergedConcepts.length + newInMine.length + newInTheirs.length;
    const syncOverhead = totalConcepts > 0 ? changedConcepts / totalConcepts : 1;
    // Determine strategy
    let strategy;
    let quickSyncEligible = false;
    if (similarity > 0.99 && syncOverhead < 0.01) {
        // Nearly identical - instant sync
        strategy = 'instant';
        quickSyncEligible = true;
    }
    else if (similarity > 0.90 && syncOverhead < 0.10) {
        // Very similar - quick sync
        strategy = 'quick';
        quickSyncEligible = true;
    }
    else if (similarity > 0.70 && syncOverhead < 0.30) {
        // Somewhat similar - delta sync
        strategy = 'delta';
        quickSyncEligible = true;
    }
    else {
        // Too different - full handshake needed
        strategy = 'full';
        quickSyncEligible = false;
    }
    return {
        similarity,
        quickSyncEligible,
        divergedConcepts,
        newConcepts: { agentA: newInMine, agentB: newInTheirs },
        syncOverhead,
        strategy
    };
}
/**
 * Compute cosine similarity between two vectors
 */
function computeVectorSimilarity(a, b) {
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
// ============================================================
// DELTA SYNC
// ============================================================
/**
 * Generate a delta sync packet between two states
 */
export function generateDeltaSync(fromFingerprint, toFingerprint, fromModel, toModel) {
    const comparison = compareFingerprints(fromFingerprint, toFingerprint);
    const changes = [];
    const removals = comparison.newConcepts.agentA; // In from but not in to
    const additions = [];
    // Generate patches for changed concepts
    for (const concept of comparison.divergedConcepts) {
        const oldVersion = fromFingerprint.conceptVersions.get(concept) || 0;
        const newVersion = toFingerprint.conceptVersions.get(concept) || 0;
        changes.push({
            concept,
            oldVersion,
            newVersion,
            patch: generateConceptPatch(concept, fromModel, toModel)
        });
    }
    // Generate full content for new concepts
    for (const concept of comparison.newConcepts.agentB) {
        const content = extractConceptContent(concept, toModel);
        additions.push({
            concept,
            version: toFingerprint.conceptVersions.get(concept) || 0,
            fullContent: JSON.stringify(content),
            semanticEmbedding: computeConceptEmbedding(content)
        });
    }
    // Calculate compression ratio
    const fullSize = JSON.stringify(toModel).length;
    const deltaSize = JSON.stringify({ changes, removals, additions }).length;
    const compressionRatio = fullSize > 0 ? 1 - (deltaSize / fullSize) : 0;
    return {
        fromFingerprint: fromFingerprint.id,
        toFingerprint: toFingerprint.id,
        changes,
        removals,
        additions,
        compressionRatio
    };
}
/**
 * Apply a delta sync to update a mental model
 */
export function applyDeltaSync(model, delta) {
    const updated = JSON.parse(JSON.stringify(model)); // Deep clone
    // Apply removals
    for (const concept of delta.removals) {
        removeConceptFromModel(updated, concept);
    }
    // Apply changes
    for (const change of delta.changes) {
        applyConceptPatch(updated, change.concept, change.patch);
    }
    // Apply additions
    for (const addition of delta.additions) {
        addConceptToModel(updated, addition.concept, JSON.parse(addition.fullContent));
    }
    return updated;
}
/**
 * Initiate a quick sync with another agent
 */
export function initiateQuickSync(cache, peerAgentId) {
    return {
        type: 'FINGERPRINT_OFFER',
        fingerprint: cache.self
    };
}
/**
 * Handle incoming quick sync message
 */
export function handleQuickSyncMessage(cache, message, myModel) {
    switch (message.type) {
        case 'FINGERPRINT_OFFER': {
            // Check if we know this agent
            const history = cache.known.get(message.fingerprint.agentId);
            const comparison = compareFingerprints(cache.self, message.fingerprint);
            if (!comparison.quickSyncEligible) {
                return {
                    response: {
                        type: 'FALLBACK_TO_FULL',
                        reason: `Sync overhead too high: ${(comparison.syncOverhead * 100).toFixed(1)}%`
                    }
                };
            }
            return {
                response: {
                    type: 'FINGERPRINT_MATCH',
                    comparison,
                    myFingerprint: cache.self
                }
            };
        }
        case 'FINGERPRINT_MATCH': {
            const { comparison } = message;
            if (comparison.strategy === 'instant') {
                // No changes needed - models are identical
                return {
                    response: {
                        type: 'QUICK_SYNC_COMPLETE',
                        mergedFingerprint: cache.self
                    }
                };
            }
            // Request delta for diverged concepts
            return {
                response: {
                    type: 'DELTA_REQUEST',
                    concepts: [
                        ...comparison.divergedConcepts,
                        ...comparison.newConcepts.agentB
                    ]
                }
            };
        }
        case 'DELTA_REQUEST': {
            // Generate partial delta for requested concepts
            const partialDelta = {
                changes: [],
                additions: []
            };
            for (const concept of message.concepts) {
                const content = extractConceptContent(concept, myModel);
                if (content) {
                    partialDelta.additions.push({
                        concept,
                        version: cache.self.conceptVersions.get(concept) || 0,
                        fullContent: JSON.stringify(content),
                        semanticEmbedding: computeConceptEmbedding(content)
                    });
                }
            }
            return {
                response: {
                    type: 'DELTA_RESPONSE',
                    delta: partialDelta
                }
            };
        }
        case 'DELTA_RESPONSE': {
            // Apply the delta to our model
            const updatedModel = applyPartialDelta(myModel, message.delta);
            const newFingerprint = generateFingerprint(cache.self.agentId, updatedModel, cache.self);
            return {
                response: {
                    type: 'QUICK_SYNC_COMPLETE',
                    mergedFingerprint: newFingerprint
                },
                updatedModel
            };
        }
        case 'QUICK_SYNC_COMPLETE': {
            // Sync complete - update our cache
            return {
                response: message // Echo back to confirm
            };
        }
        case 'FALLBACK_TO_FULL': {
            // Need to initiate full handshake
            return {
                response: message // Pass through
            };
        }
    }
}
// ============================================================
// FINGERPRINT CACHE MANAGEMENT
// ============================================================
/**
 * Update cache after successful collaboration
 */
export function updateCacheAfterCollaboration(cache, peerAgentId, peerFingerprint, alignmentScore) {
    const history = cache.known.get(peerAgentId);
    if (history) {
        // Update existing history
        history.lastFingerprint = peerFingerprint;
        history.fingerprintHistory.push(peerFingerprint);
        // Keep only last 10 fingerprints
        if (history.fingerprintHistory.length > 10) {
            history.fingerprintHistory = history.fingerprintHistory.slice(-10);
        }
        history.collaborationCount++;
        history.lastCollaboration = new Date();
        // Rolling average of alignment score
        history.avgAlignmentScore =
            (history.avgAlignmentScore * (history.collaborationCount - 1) + alignmentScore)
                / history.collaborationCount;
        // Trust increases with successful collaborations
        history.trustLevel = Math.min(1, history.trustLevel + 0.05);
    }
    else {
        // New collaborator
        cache.known.set(peerAgentId, {
            agentId: peerAgentId,
            lastFingerprint: peerFingerprint,
            fingerprintHistory: [peerFingerprint],
            collaborationCount: 1,
            lastCollaboration: new Date(),
            avgAlignmentScore: alignmentScore,
            trustLevel: 0.3 // Start with base trust
        });
    }
}
/**
 * Check if we should attempt quick sync with an agent
 */
export function shouldAttemptQuickSync(cache, peerAgentId) {
    const history = cache.known.get(peerAgentId);
    if (!history) {
        return {
            eligible: false,
            reason: 'Never collaborated before - full handshake required'
        };
    }
    if (history.trustLevel < 0.5) {
        return {
            eligible: false,
            reason: `Trust level too low: ${(history.trustLevel * 100).toFixed(0)}%`
        };
    }
    // Check how stale the fingerprint is
    const staleness = Date.now() - history.lastCollaboration.getTime();
    const maxStaleMs = 24 * 60 * 60 * 1000; // 24 hours
    if (staleness > maxStaleMs) {
        return {
            eligible: false,
            reason: 'Last collaboration too old - full handshake recommended'
        };
    }
    // Estimate sync overhead based on history
    const avgOverhead = estimateOverhead(cache.self, history.lastFingerprint);
    return {
        eligible: true,
        reason: `Good candidate for quick sync (trust: ${(history.trustLevel * 100).toFixed(0)}%, last collab: ${formatTimeAgo(history.lastCollaboration)})`,
        expectedOverhead: avgOverhead
    };
}
// ============================================================
// HELPER FUNCTIONS
// ============================================================
function generateFingerprintId(agentId, modelHash) {
    return `fp_${agentId}_${modelHash.substring(0, 8)}_${Date.now()}`;
}
function hashMentalModel(model) {
    // Simple hash for demo - use proper crypto in production
    const str = JSON.stringify(model);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}
function hashContent(content) {
    const str = JSON.stringify(content);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash);
}
function generateConceptPatch(concept, from, to) {
    // In production, use JSON Patch (RFC 6902)
    const fromContent = extractConceptContent(concept, from);
    const toContent = extractConceptContent(concept, to);
    return JSON.stringify({ from: fromContent, to: toContent });
}
function extractConceptContent(concept, model) {
    const [type, key] = concept.split(':');
    switch (type) {
        case 'domain': return model.domains?.[key];
        case 'assumption': return model.assumptions?.[key];
        case 'goal': return model.goals?.find(g => g.id === key);
        case 'capability': return model.capabilities?.find(c => c.name === key);
        default: return undefined;
    }
}
function computeConceptEmbedding(content) {
    // Placeholder - would use real embedding model
    const vector = new Array(32).fill(0);
    const str = JSON.stringify(content);
    for (let i = 0; i < str.length; i++) {
        vector[i % 32] += str.charCodeAt(i) * 0.01;
    }
    return vector;
}
function removeConceptFromModel(model, concept) {
    const [type, key] = concept.split(':');
    switch (type) {
        case 'domain':
            delete model.domains?.[key];
            break;
        case 'assumption':
            delete model.assumptions?.[key];
            break;
        case 'goal':
            model.goals = model.goals?.filter(g => g.id !== key);
            break;
        case 'capability':
            model.capabilities = model.capabilities?.filter(c => c.name !== key);
            break;
    }
}
function applyConceptPatch(model, concept, patch) {
    const { to } = JSON.parse(patch);
    addConceptToModel(model, concept, to);
}
function addConceptToModel(model, concept, content) {
    const [type, key] = concept.split(':');
    switch (type) {
        case 'domain':
            model.domains = model.domains || {};
            model.domains[key] = content;
            break;
        case 'assumption':
            model.assumptions = model.assumptions || {};
            model.assumptions[key] = content;
            break;
        case 'goal':
            model.goals = model.goals || [];
            const existingGoal = model.goals.findIndex(g => g.id === key);
            if (existingGoal >= 0)
                model.goals[existingGoal] = content;
            else
                model.goals.push(content);
            break;
        case 'capability':
            model.capabilities = model.capabilities || [];
            const existingCap = model.capabilities.findIndex(c => c.name === key);
            if (existingCap >= 0)
                model.capabilities[existingCap] = content;
            else
                model.capabilities.push(content);
            break;
    }
}
function applyPartialDelta(model, delta) {
    const updated = JSON.parse(JSON.stringify(model));
    for (const addition of delta.additions || []) {
        addConceptToModel(updated, addition.concept, JSON.parse(addition.fullContent));
    }
    for (const change of delta.changes || []) {
        applyConceptPatch(updated, change.concept, change.patch);
    }
    return updated;
}
function estimateOverhead(mine, theirs) {
    const comparison = compareFingerprints(mine, theirs);
    return comparison.syncOverhead;
}
function formatTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60)
        return `${seconds}s ago`;
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400)
        return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}
// ============================================================
// EXPORTS
// ============================================================
export const ContextFingerprinting = {
    generateFingerprint,
    compareFingerprints,
    generateDeltaSync,
    applyDeltaSync,
    initiateQuickSync,
    handleQuickSyncMessage,
    updateCacheAfterCollaboration,
    shouldAttemptQuickSync
};
export default ContextFingerprinting;
