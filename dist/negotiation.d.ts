/**
 * Context Handshake: Negotiation Protocol
 * HEF Evolution: Gen 6, Instance 28
 * Task: task_20260201061347_9ebd38
 *
 * When two AIs have low alignment, negotiation bridges the gap.
 * Instead of failing, agents can propose compromises, clarify assumptions,
 * and iteratively converge on shared understanding.
 */
export interface NegotiationProposal {
    id: string;
    from: string;
    type: 'clarification' | 'compromise' | 'assertion' | 'question';
    topic: string;
    content: {
        myPosition: unknown;
        proposedResolution?: unknown;
        priority: 'critical' | 'high' | 'medium' | 'low';
        rationale?: string;
    };
    timestamp: Date;
}
export interface NegotiationResponse {
    proposalId: string;
    from: string;
    decision: 'accept' | 'counter' | 'reject' | 'defer';
    counterProposal?: NegotiationProposal;
    reasoning?: string;
    newAlignment?: number;
}
export interface Divergence {
    concept: string;
    agentAView: unknown;
    agentBView: unknown;
    severity: number;
    category: 'definition' | 'assumption' | 'priority' | 'constraint';
}
export interface NegotiationSession {
    id: string;
    initiator: string;
    responder: string;
    startTime: Date;
    endTime?: Date;
    divergences: Divergence[];
    rounds: NegotiationRound[];
    status: 'active' | 'converged' | 'failed' | 'timeout';
    finalAlignment: number;
    compromises: ResolvedDivergence[];
}
export interface NegotiationRound {
    number: number;
    proposals: NegotiationProposal[];
    responses: NegotiationResponse[];
    alignmentBefore: number;
    alignmentAfter: number;
    timestamp: Date;
}
export interface ResolvedDivergence {
    original: Divergence;
    resolution: 'agent_a_adopts' | 'agent_b_adopts' | 'merged' | 'agreed_to_differ';
    resolvedValue: unknown;
    round: number;
}
export interface NegotiationConfig {
    maxRounds: number;
    alignmentThreshold: number;
    roundTimeoutMs: number;
    allowDeferrals: boolean;
    criticalMustResolve: boolean;
    autoCompromiseThreshold: number;
}
export type NegotiationStrategy = 'collaborative' | 'principled' | 'adaptive' | 'integrative';
export interface StrategyProfile {
    strategy: NegotiationStrategy;
    priorities: string[];
    flexibility: Map<string, number>;
    maxConcessions: number;
}
export declare class NegotiationEngine {
    private config;
    private strategyProfile;
    private activeSessions;
    constructor(config?: Partial<NegotiationConfig>, strategy?: Partial<StrategyProfile>);
    /**
     * Initiate negotiation when handshake alignment is too low
     */
    initiateNegotiation(agentA: string, agentB: string, divergences: Divergence[], currentAlignment: number): NegotiationSession;
    /**
     * Generate proposals for divergences based on strategy
     */
    generateProposals(session: NegotiationSession, agentId: string, roundNumber: number): NegotiationProposal[];
    private createProposal;
    private attemptMerge;
    private severityToPriority;
    private generateRationale;
    /**
     * Evaluate and respond to incoming proposals
     */
    evaluateProposal(proposal: NegotiationProposal, myView: unknown): NegotiationResponse;
    private calculateDivergence;
    private createCounterProposal;
    /**
     * Execute a negotiation round
     */
    executeRound(session: NegotiationSession): NegotiationRound;
    /**
     * Run full negotiation until convergence or failure
     */
    negotiate(session: NegotiationSession): Promise<NegotiationSession>;
    /**
     * Get negotiation summary for handshake integration
     */
    getSummary(session: NegotiationSession): {
        success: boolean;
        finalAlignment: number;
        rounds: number;
        resolvedCount: number;
        unresolvedCount: number;
        compromises: string[];
    };
}
export interface HandshakeWithNegotiation {
    handshakeId: string;
    initialAlignment: number;
    negotiationRequired: boolean;
    negotiation?: NegotiationSession;
    finalAlignment: number;
    status: 'synced' | 'negotiated' | 'partial' | 'failed';
}
/**
 * Enhanced handshake that falls back to negotiation when alignment is low
 */
export declare function handshakeWithNegotiation(agentA: string, agentB: string, contextA: Record<string, unknown>, contextB: Record<string, unknown>, alignmentThreshold?: number): Promise<HandshakeWithNegotiation>;
export declare function demo(): Promise<void>;
