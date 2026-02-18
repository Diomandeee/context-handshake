/**
 * Context serialization and hashing utilities
 */
import * as crypto from 'crypto';
/**
 * Generate a deterministic hash of context for integrity verification
 */
export function hashContext(context) {
    const normalized = normalizeContext(context);
    const serialized = JSON.stringify(normalized, Object.keys(normalized).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}
/**
 * Generate a unique nonce for replay protection
 */
export function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}
/**
 * Normalize context for consistent hashing
 */
function normalizeContext(context) {
    return {
        agentId: context.agentId,
        capabilities: [...context.capabilities].sort(),
        mentalModel: normalizeMentalModel(context.mentalModel),
        preferredStyle: context.preferredStyle,
    };
}
function normalizeMentalModel(model) {
    return {
        taskUnderstanding: model.taskUnderstanding.trim().toLowerCase(),
        keyConcepts: Object.keys(model.keyConcepts).sort().reduce((acc, key) => {
            acc[key] = model.keyConcepts[key];
            return acc;
        }, {}),
        assumptions: model.assumptions.map(a => a.statement).sort(),
        goals: model.goals.map(g => g.description).sort(),
        confidenceLevel: Math.round(model.confidenceLevel * 100) / 100,
    };
}
/**
 * Build a mental model from current session context
 */
export function buildMentalModel(options) {
    const concepts = {};
    if (options.concepts) {
        for (const [name, definition] of Object.entries(options.concepts)) {
            concepts[name.toLowerCase()] = {
                name,
                definition,
                relationships: [],
                importance: 'medium',
            };
        }
    }
    const assumptions = (options.assumptions || []).map((stmt, i) => ({
        id: `assumption_${i}`,
        statement: stmt,
        confidence: 0.8,
        basis: 'implicit',
    }));
    const goals = (options.goals || []).map((desc, i) => ({
        id: `goal_${i}`,
        description: desc,
        priority: i + 1,
        status: 'active',
    }));
    return {
        taskUnderstanding: options.taskDescription,
        keyConcepts: concepts,
        assumptions,
        constraints: (options.constraints || []).map((c, i) => ({
            id: `constraint_${i}`,
            type: 'soft',
            description: c,
            source: 'user',
        })),
        goals,
        confidenceLevel: options.confidence ?? 0.7,
    };
}
/**
 * Extract key concepts from a text description
 */
export function extractConcepts(text) {
    const concepts = {};
    // Simple extraction based on capitalized terms and technical patterns
    const patterns = [
        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g, // Multi-word proper nouns
        /\b([A-Z]{2,})\b/g, // Acronyms
        /`([^`]+)`/g, // Code/technical terms
        /\*\*([^*]+)\*\*/g, // Bold terms
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const term = match[1].trim();
            if (term.length > 2 && !concepts[term.toLowerCase()]) {
                concepts[term.toLowerCase()] = {
                    name: term,
                    definition: `Mentioned in context: "${text.slice(Math.max(0, match.index - 30), match.index + term.length + 30).trim()}"`,
                    relationships: [],
                    importance: 'medium',
                };
            }
        }
    }
    return concepts;
}
/**
 * Serialize context for transmission
 */
export function serializeContext(context) {
    return JSON.stringify(context, null, 2);
}
/**
 * Deserialize context from transmission
 */
export function deserializeContext(data) {
    const parsed = JSON.parse(data);
    // Validate required fields
    if (!parsed.agentId || !parsed.capabilities || !parsed.mentalModel) {
        throw new Error('Invalid context format: missing required fields');
    }
    return parsed;
}
/**
 * Compress context for efficiency
 */
export function compressContext(context) {
    return {
        ...context,
        mentalModel: {
            ...context.mentalModel,
            // Keep only essential assumptions
            assumptions: context.mentalModel.assumptions.filter(a => a.confidence > 0.5),
            // Keep only active goals
            goals: context.mentalModel.goals.filter(g => g.status === 'active'),
            // Limit concepts to important ones
            keyConcepts: Object.fromEntries(Object.entries(context.mentalModel.keyConcepts)
                .filter(([_, c]) => c.importance === 'critical' || c.importance === 'high')
                .slice(0, 20)),
        },
    };
}
/**
 * Generate a unique session ID
 */
export function generateSessionId(participants) {
    const sorted = [...participants].sort().join(':');
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `session_${timestamp}_${random}`;
}
