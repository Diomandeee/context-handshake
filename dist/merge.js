/**
 * Mental Model Merging
 *
 * Strategies for combining two agent's mental models into shared understanding
 */
/**
 * Merge two mental models based on alignment analysis
 */
export function mergeModels(initiator, responder, alignment) {
    // Build resolution lookup
    const resolutions = new Map(alignment.proposedResolutions.map(r => [r.divergenceId, r]));
    // Merge each component
    const mergedConcepts = mergeConcepts(initiator.keyConcepts, responder.keyConcepts, resolutions);
    const mergedAssumptions = mergeAssumptions(initiator.assumptions, responder.assumptions, resolutions);
    const mergedGoals = mergeGoals(initiator.goals, responder.goals);
    const mergedConstraints = mergeConstraints(initiator.constraints, responder.constraints);
    // Merge task understanding
    const mergedTaskUnderstanding = mergeTaskUnderstanding(initiator.taskUnderstanding, responder.taskUnderstanding, alignment.score);
    // Create merged mental model
    const sharedUnderstanding = {
        taskUnderstanding: mergedTaskUnderstanding,
        keyConcepts: mergedConcepts,
        assumptions: mergedAssumptions,
        constraints: mergedConstraints,
        goals: mergedGoals,
        confidenceLevel: (initiator.confidenceLevel + responder.confidenceLevel) / 2,
    };
    // Determine communication style (prefer more detailed for divergence)
    const communicationProtocol = alignment.score < 0.7 ? 'verbose' : 'concise';
    return {
        sharedUnderstanding,
        roleAssignments: alignment.compatibilityFlags.suggestedRoles,
        communicationProtocol,
        conflictResolution: alignment.divergences.some(d => d.severity === 'critical')
            ? 'escalate'
            : 'defer_to_lead',
        syncedAt: new Date().toISOString(),
        divergencesAccepted: alignment.proposedResolutions
            .filter(r => r.strategy !== 'defer')
            .map(r => r.divergenceId),
    };
}
/**
 * Merge concepts from both models
 */
function mergeConcepts(a, b, resolutions) {
    const merged = {};
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of allKeys) {
        const resolution = resolutions.get(`concept:${key}`);
        const aDef = a[key];
        const bDef = b[key];
        if (aDef && !bDef) {
            merged[key] = { ...aDef };
        }
        else if (!aDef && bDef) {
            merged[key] = { ...bDef };
        }
        else if (aDef && bDef) {
            // Both have the concept
            if (resolution?.strategy === 'adopt_initiator') {
                merged[key] = { ...aDef };
            }
            else if (resolution?.strategy === 'adopt_responder') {
                merged[key] = { ...bDef };
            }
            else {
                // Merge: combine definitions and relationships
                merged[key] = {
                    name: aDef.name,
                    definition: synthesizeDefinitions(aDef.definition, bDef.definition),
                    relationships: [...new Set([...aDef.relationships, ...bDef.relationships])],
                    importance: higherImportance(aDef.importance, bDef.importance),
                };
            }
        }
    }
    return merged;
}
/**
 * Merge assumptions from both models
 */
function mergeAssumptions(a, b, resolutions) {
    const merged = [];
    const seen = new Set();
    // Add all from A, potentially merging with B
    for (const aAssump of a) {
        const key = aAssump.statement.toLowerCase().slice(0, 50);
        const resolution = resolutions.get(`assumption:${key}`);
        if (resolution?.strategy === 'adopt_responder') {
            continue; // Skip, will add from B
        }
        merged.push({
            ...aAssump,
            id: `merged_${aAssump.id}`,
            basis: `merged:${aAssump.basis}`,
        });
        seen.add(key);
    }
    // Add unique assumptions from B
    for (const bAssump of b) {
        const key = bAssump.statement.toLowerCase().slice(0, 50);
        if (!seen.has(key)) {
            merged.push({
                ...bAssump,
                id: `merged_${bAssump.id}`,
                basis: `merged:${bAssump.basis}`,
            });
        }
    }
    // Sort by confidence
    return merged.sort((x, y) => y.confidence - x.confidence);
}
/**
 * Merge goals from both models
 */
function mergeGoals(a, b) {
    const merged = [];
    const seen = new Set();
    // Combine and deduplicate
    for (const goal of [...a, ...b]) {
        const key = goal.description.toLowerCase();
        if (!seen.has(key)) {
            merged.push({
                ...goal,
                id: `merged_${goal.id}`,
            });
            seen.add(key);
        }
    }
    // Re-prioritize by original priority average
    return merged.sort((x, y) => x.priority - y.priority);
}
/**
 * Merge constraints from both models
 */
function mergeConstraints(a, b) {
    const merged = [];
    const seen = new Set();
    for (const constraint of [...a, ...b]) {
        const key = constraint.description.toLowerCase();
        if (!seen.has(key)) {
            merged.push({
                ...constraint,
                id: `merged_${constraint.id}`,
                source: constraint.source.startsWith('merged:')
                    ? constraint.source
                    : `merged:${constraint.source}`,
            });
            seen.add(key);
        }
    }
    // Hard constraints first
    return merged.sort((x, y) => {
        if (x.type === 'hard' && y.type !== 'hard')
            return -1;
        if (x.type !== 'hard' && y.type === 'hard')
            return 1;
        return 0;
    });
}
/**
 * Merge task understanding with synthesis
 */
function mergeTaskUnderstanding(a, b, alignmentScore) {
    if (alignmentScore > 0.9) {
        // Very aligned - just use first (they're nearly identical)
        return a;
    }
    if (alignmentScore > 0.7) {
        // Good alignment - combine key points
        const aWords = new Set(a.toLowerCase().split(/\s+/));
        const bUnique = b.split(/\s+/).filter(w => !aWords.has(w.toLowerCase())).join(' ');
        return bUnique.length > 10
            ? `${a} Additionally: ${bUnique.slice(0, 100)}`
            : a;
    }
    // Lower alignment - explicitly note both perspectives
    return `Initiator view: ${a.slice(0, 150)} | Responder view: ${b.slice(0, 150)}`;
}
/**
 * Synthesize two definitions into one
 */
function synthesizeDefinitions(a, b) {
    // Simple synthesis: combine if different enough
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    // Check for significant overlap
    const aWords = new Set(aLower.split(/\s+/).filter(w => w.length > 3));
    const bWords = new Set(bLower.split(/\s+/).filter(w => w.length > 3));
    let overlap = 0;
    for (const word of aWords) {
        if (bWords.has(word))
            overlap++;
    }
    const overlapRatio = overlap / Math.max(aWords.size, bWords.size);
    if (overlapRatio > 0.7) {
        // Very similar, just use the longer one
        return a.length > b.length ? a : b;
    }
    // Combine both perspectives
    return `${a} (alt: ${b.slice(0, 80)}${b.length > 80 ? '...' : ''})`;
}
/**
 * Return higher importance level
 */
function higherImportance(a, b) {
    const order = ['critical', 'high', 'medium', 'low'];
    return order.indexOf(a) <= order.indexOf(b) ? a : b;
}
/**
 * Update merged model with incremental context
 */
export function updateMergedModel(current, update, source) {
    const newUnderstanding = { ...current.sharedUnderstanding };
    if (update.taskUnderstanding) {
        newUnderstanding.taskUnderstanding =
            `${current.sharedUnderstanding.taskUnderstanding} [${source} adds: ${update.taskUnderstanding}]`;
    }
    if (update.keyConcepts) {
        newUnderstanding.keyConcepts = {
            ...newUnderstanding.keyConcepts,
            ...update.keyConcepts,
        };
    }
    if (update.assumptions) {
        newUnderstanding.assumptions = [
            ...newUnderstanding.assumptions,
            ...update.assumptions.map(a => ({
                ...a,
                id: `update_${a.id}`,
                basis: `${source}_update`,
            })),
        ];
    }
    if (update.goals) {
        newUnderstanding.goals = [
            ...newUnderstanding.goals,
            ...update.goals.map(g => ({
                ...g,
                id: `update_${g.id}`,
            })),
        ];
    }
    return {
        ...current,
        sharedUnderstanding: newUnderstanding,
        syncedAt: new Date().toISOString(),
    };
}
