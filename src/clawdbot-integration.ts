/**
 * Clawdbot Integration for Context Handshake
 * 
 * Enables AI-to-AI context sync between Clawdbot sessions
 */

import type { AgentContext, CollaborationSession, MentalModel } from './protocol';
import { ContextHandshake, performHandshake } from './handshake';
import { buildMentalModel } from './context';
import { ActiveSession, SessionStore } from './session';

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
export function buildContextFromSession(
  session: ClawdbotSession,
  options: {
    taskDescription: string;
    capabilities?: string[];
    concepts?: Record<string, string>;
    assumptions?: string[];
    goals?: string[];
    confidence?: number;
  }
): AgentContext {
  return {
    agentId: session.agentId || session.sessionKey,
    capabilities: options.capabilities || ['general'],
    mentalModel: buildMentalModel({
      taskDescription: options.taskDescription,
      concepts: options.concepts,
      assumptions: options.assumptions,
      goals: options.goals,
      confidence: options.confidence,
    }),
    preferredStyle: 'concise',
  };
}

/**
 * Handshake wrapper for Clawdbot sessions_spawn
 */
export async function handshakeWithSubAgent(
  mainContext: AgentContext,
  subAgentTask: string,
  subAgentCapabilities: string[] = ['code']
): Promise<{ 
  session: CollaborationSession; 
  contextPrompt: string;
} | { error: string }> {
  // Build sub-agent context from task
  const subAgentContext: AgentContext = {
    agentId: `sub_${Date.now().toString(36)}`,
    capabilities: subAgentCapabilities,
    mentalModel: buildMentalModel({
      taskDescription: subAgentTask,
      confidence: 0.6, // Lower confidence since it's starting fresh
    }),
    preferredStyle: 'technical',
  };

  // Perform handshake
  const result = await performHandshake(mainContext, subAgentContext);
  
  if ('error' in result) {
    return result;
  }

  // Generate context prompt for the sub-agent
  const contextPrompt = generateContextPrompt(result.session);

  return {
    session: result.session,
    contextPrompt,
  };
}

/**
 * Generate a context prompt to inject into sub-agent spawn
 */
function generateContextPrompt(session: CollaborationSession): string {
  const model = session.mergedModel.sharedUnderstanding;
  
  const lines = [
    `[Context Handshake: Session ${session.sessionId}]`,
    ``,
    `## Shared Understanding`,
    model.taskUnderstanding,
    ``,
    `## Your Role`,
    `You are the ${session.mergedModel.roleAssignments.support === session.participants[1] ? 'support' : 'lead'} agent.`,
    ``,
    `## Key Concepts`,
    ...Object.entries(model.keyConcepts).map(([k, v]) => `- **${v.name}**: ${v.definition}`),
    ``,
    `## Active Goals`,
    ...model.goals.filter(g => g.status === 'active').map((g, i) => `${i + 1}. ${g.description}`),
    ``,
    `## Assumptions`,
    ...model.assumptions.slice(0, 5).map(a => `- ${a.statement} (confidence: ${(a.confidence * 100).toFixed(0)}%)`),
    ``,
    `## Communication Style`,
    `Preferred: ${session.mergedModel.communicationProtocol}`,
    ``,
    `---`,
    `[End Context Handshake]`,
  ];

  return lines.join('\n');
}

/**
 * Parse context from incoming message (for responder side)
 */
export function parseIncomingContext(message: string): AgentContext | null {
  const handshakeMatch = message.match(/\[Context Handshake: Session ([^\]]+)\]/);
  if (!handshakeMatch) return null;

  const taskMatch = message.match(/## Shared Understanding\n([^\n]+)/);
  const conceptsMatch = message.matchAll(/- \*\*([^*]+)\*\*: ([^\n]+)/g);
  const goalsMatch = message.matchAll(/^\d+\. ([^\n]+)/gm);

  const concepts: Record<string, string> = {};
  for (const match of conceptsMatch) {
    concepts[match[1].toLowerCase()] = match[2];
  }

  const goals: string[] = [];
  for (const match of goalsMatch) {
    goals.push(match[1]);
  }

  return {
    agentId: `parsed_${handshakeMatch[1]}`,
    capabilities: ['general'],
    mentalModel: buildMentalModel({
      taskDescription: taskMatch?.[1] || 'Unknown task',
      concepts,
      goals,
      confidence: 0.7,
    }),
    preferredStyle: 'concise',
  };
}

/**
 * Create enriched spawn task with handshake context
 */
export function createEnrichedSpawnTask(
  originalTask: string,
  context: AgentContext
): string {
  const handshake = new ContextHandshake(context);
  const syn = handshake.initiate();

  return [
    `[CONTEXT_SYNC]`,
    `From: ${syn.from}`,
    `Checksum: ${syn.checksum}`,
    `Capabilities: ${context.capabilities.join(', ')}`,
    `Task Understanding: ${context.mentalModel.taskUnderstanding}`,
    `Key Concepts: ${Object.keys(context.mentalModel.keyConcepts).join(', ')}`,
    `[/CONTEXT_SYNC]`,
    ``,
    originalTask,
  ].join('\n');
}

/**
 * Example integration with Clawdbot's sessions_spawn
 */
export const USAGE_EXAMPLE = `
// In your Clawdbot agent:

import { buildContextFromSession, handshakeWithSubAgent } from './clawdbot-integration';

// 1. Build your current context
const myContext = buildContextFromSession(
  { sessionKey: 'main', agentId: 'clawd-main' },
  {
    taskDescription: 'Build a REST API with authentication',
    capabilities: ['code', 'architecture', 'security'],
    concepts: {
      'jwt': 'JSON Web Tokens for auth',
      'middleware': 'Express middleware pattern',
    },
    goals: ['Setup Express', 'Add JWT auth', 'Create user routes'],
    confidence: 0.85,
  }
);

// 2. Handshake before spawning sub-agent
const result = await handshakeWithSubAgent(
  myContext,
  'Implement JWT authentication middleware',
  ['code', 'security']
);

if ('error' in result) {
  console.error('Handshake failed:', result.error);
} else {
  // 3. Spawn with context
  await sessions_spawn({
    task: result.contextPrompt + '\\n\\n' + 'Implement JWT middleware...',
    label: 'jwt-auth-agent',
  });
  
  console.log('Sub-agent spawned with shared context!');
}
`;
