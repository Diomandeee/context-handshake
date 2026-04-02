/**
 * Context serialization and hashing utilities
 */
import type { MentalModel, AgentContext, ConceptDefinition } from './protocol';
/**
 * Generate a deterministic hash of context for integrity verification
 */
export declare function hashContext(context: AgentContext): string;
/**
 * Generate a unique nonce for replay protection
 */
export declare function generateNonce(): string;
/**
 * Build a mental model from current session context
 */
export declare function buildMentalModel(options: {
    taskDescription: string;
    concepts?: Record<string, string>;
    assumptions?: string[];
    goals?: string[];
    constraints?: string[];
    confidence?: number;
}): MentalModel;
/**
 * Extract key concepts from a text description
 */
export declare function extractConcepts(text: string): Record<string, ConceptDefinition>;
/**
 * Serialize context for transmission
 */
export declare function serializeContext(context: AgentContext): string;
/**
 * Deserialize context from transmission
 */
export declare function deserializeContext(data: string): AgentContext;
/**
 * Compress context for efficiency
 */
export declare function compressContext(context: AgentContext): AgentContext;
/**
 * Generate a unique session ID
 */
export declare function generateSessionId(participants: string[]): string;
