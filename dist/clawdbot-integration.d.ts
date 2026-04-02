/**
 * Clawdbot Integration for Context Handshake
 *
 * Enables AI-to-AI context sync between Clawdbot sessions
 */
import type { AgentContext, CollaborationSession } from './protocol';
/**
 * Clawdbot session adapter
 */
export interface ClawdbotSession {
    sessionKey: string;
    agentId?: string;
    label?: string;
}
/**
 * Build context from Clawdbot session state
 */
export declare function buildContextFromSession(session: ClawdbotSession, options: {
    taskDescription: string;
    capabilities?: string[];
    concepts?: Record<string, string>;
    assumptions?: string[];
    goals?: string[];
    confidence?: number;
}): AgentContext;
/**
 * Handshake wrapper for Clawdbot sessions_spawn
 */
export declare function handshakeWithSubAgent(mainContext: AgentContext, subAgentTask: string, subAgentCapabilities?: string[]): Promise<{
    session: CollaborationSession;
    contextPrompt: string;
} | {
    error: string;
}>;
/**
 * Parse context from incoming message (for responder side)
 */
export declare function parseIncomingContext(message: string): AgentContext | null;
/**
 * Create enriched spawn task with handshake context
 */
export declare function createEnrichedSpawnTask(originalTask: string, context: AgentContext): string;
/**
 * Example integration with Clawdbot's sessions_spawn
 */
export declare const USAGE_EXAMPLE = "\n// In your Clawdbot agent:\n\nimport { buildContextFromSession, handshakeWithSubAgent } from './clawdbot-integration';\n\n// 1. Build your current context\nconst myContext = buildContextFromSession(\n  { sessionKey: 'main', agentId: 'clawd-main' },\n  {\n    taskDescription: 'Build a REST API with authentication',\n    capabilities: ['code', 'architecture', 'security'],\n    concepts: {\n      'jwt': 'JSON Web Tokens for auth',\n      'middleware': 'Express middleware pattern',\n    },\n    goals: ['Setup Express', 'Add JWT auth', 'Create user routes'],\n    confidence: 0.85,\n  }\n);\n\n// 2. Handshake before spawning sub-agent\nconst result = await handshakeWithSubAgent(\n  myContext,\n  'Implement JWT authentication middleware',\n  ['code', 'security']\n);\n\nif ('error' in result) {\n  console.error('Handshake failed:', result.error);\n} else {\n  // 3. Spawn with context\n  await sessions_spawn({\n    task: result.contextPrompt + '\\n\\n' + 'Implement JWT middleware...',\n    label: 'jwt-auth-agent',\n  });\n  \n  console.log('Sub-agent spawned with shared context!');\n}\n";
