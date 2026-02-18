/**
 * Context Handshake Protocol
 *
 * Three-phase synchronization for AI-to-AI collaboration
 */
export declare const PROTOCOL_VERSION = "1.0.0";
export type HandshakePhase = 'SYN' | 'SYN-ACK' | 'ACK' | 'RST' | 'FIN';
export type Capability = 'code' | 'research' | 'creative' | 'analysis' | 'automation' | 'communication' | 'memory' | 'planning' | string;
export type CommunicationStyle = 'concise' | 'verbose' | 'technical' | 'casual';
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
    confidenceLevel: number;
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
    trustLevel?: number;
    sessionHistory?: string[];
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
    nonce: string;
}
/**
 * Alignment analysis result
 */
export interface AlignmentResult {
    score: number;
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
    ackChecksum: string;
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
    ackChecksum: string;
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
    trustDelta: number;
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
export declare const DEFAULT_CONFIG: HandshakeConfig;
