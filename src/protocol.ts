/**
 * Context Handshake Protocol
 * 
 * Three-phase synchronization for AI-to-AI collaboration
 */

export const PROTOCOL_VERSION = '1.0.0';

// Message types
export type HandshakePhase = 'SYN' | 'SYN-ACK' | 'ACK' | 'RST' | 'FIN';

// Capability domains
export type Capability = 
  | 'code'
  | 'research'
  | 'creative'
  | 'analysis'
  | 'automation'
  | 'communication'
  | 'memory'
  | 'planning'
  | string;

// Communication preferences
export type CommunicationStyle = 'concise' | 'verbose' | 'technical' | 'casual';

// Conflict resolution strategies
export type ConflictResolution = 'defer_to_lead' | 'vote' | 'escalate' | 'merge';

/**
 * Core mental model representation
 */
export interface MentalModel {
  taskUnderstanding: string;
  keyConcepts: Record<string, ConceptDefinition>;
  assumptions: Assumption[];
  constraints: Constraint[];
  goals: Goal[];
  currentFocus?: string;
  confidenceLevel: number; // 0-1
}

export interface ConceptDefinition {
  name: string;
  definition: string;
  relationships: string[];
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface Assumption {
  id: string;
  statement: string;
  confidence: number;
  basis: string;
}

export interface Constraint {
  id: string;
  type: 'hard' | 'soft';
  description: string;
  source: string;
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  status: 'active' | 'achieved' | 'blocked';
}

/**
 * Agent context for handshake
 */
export interface AgentContext {
  agentId: string;
  capabilities: Capability[];
  mentalModel: MentalModel;
  preferredStyle: CommunicationStyle;
  trustLevel?: number; // 0-1, for known agents
  sessionHistory?: string[]; // Previous collaboration session IDs
}

/**
 * SYN message - Initial context offer
 */
export interface SynMessage {
  type: 'SYN';
  protocolVersion: string;
  from: string;
  timestamp: string;
  context: AgentContext;
  checksum: string;
  nonce: string; // For replay protection
}

/**
 * Alignment analysis result
 */
export interface AlignmentResult {
  score: number; // 0-1
  matchedConcepts: string[];
  divergences: Divergence[];
  proposedResolutions: Resolution[];
  compatibilityFlags: CompatibilityFlags;
}

export interface Divergence {
  conceptId: string;
  initiatorView: string;
  responderView: string;
  severity: 'critical' | 'moderate' | 'minor';
}

export interface Resolution {
  divergenceId: string;
  strategy: 'adopt_initiator' | 'adopt_responder' | 'merge' | 'defer';
  mergedView?: string;
  rationale: string;
}

export interface CompatibilityFlags {
  canCollaborate: boolean;
  requiresNegotiation: boolean;
  suggestedRoles: {
    lead: string;
    support: string;
  };
}

/**
 * SYN-ACK message - Context acceptance and response
 */
export interface SynAckMessage {
  type: 'SYN-ACK';
  protocolVersion: string;
  from: string;
  to: string;
  timestamp: string;
  ackChecksum: string; // Checksum of received SYN
  alignment: AlignmentResult;
  context: AgentContext;
  checksum: string;
  nonce: string;
}

/**
 * Merged understanding after handshake
 */
export interface MergedModel {
  sharedUnderstanding: MentalModel;
  roleAssignments: {
    lead: string;
    support: string;
  };
  communicationProtocol: CommunicationStyle;
  conflictResolution: ConflictResolution;
  syncedAt: string;
  divergencesAccepted: string[];
}

/**
 * ACK message - Handshake completion
 */
export interface AckMessage {
  type: 'ACK';
  protocolVersion: string;
  from: string;
  to: string;
  timestamp: string;
  ackChecksum: string; // Checksum of received SYN-ACK
  mergedModel: MergedModel;
  sessionId: string;
}

/**
 * RST message - Handshake abort
 */
export interface RstMessage {
  type: 'RST';
  from: string;
  to: string;
  timestamp: string;
  reason: 'timeout' | 'alignment_failure' | 'protocol_error' | 'user_cancel';
  details?: string;
}

/**
 * FIN message - Collaboration end
 */
export interface FinMessage {
  type: 'FIN';
  from: string;
  sessionId: string;
  timestamp: string;
  summary?: CollaborationSummary;
}

export interface CollaborationSummary {
  duration: number;
  messagesExchanged: number;
  goalsAchieved: string[];
  lessonsLearned: string[];
  trustDelta: number; // Change in trust level
}

/**
 * Active collaboration session
 */
export interface CollaborationSession {
  sessionId: string;
  participants: string[];
  mergedModel: MergedModel;
  startedAt: string;
  lastActivity: string;
  status: 'active' | 'paused' | 'completed' | 'terminated';
  messageLog: SessionMessage[];
}

export interface SessionMessage {
  id: string;
  from: string;
  timestamp: string;
  content: string;
  contextUpdates?: Partial<MentalModel>;
}

/**
 * Protocol configuration
 */
export interface HandshakeConfig {
  timeoutMs: number;
  minAlignment: number;
  autoRetry: boolean;
  maxRetries: number;
  requireAck: boolean;
}

export const DEFAULT_CONFIG: HandshakeConfig = {
  timeoutMs: 5000,
  minAlignment: 0.6,
  autoRetry: true,
  maxRetries: 3,
  requireAck: true,
};
