/**
 * Context Handshake: Connection Termination & Graceful Shutdown
 *
 * HEF Evolution: Gen 6, Instance 28
 * Task: task_20260202123742_8b2837
 *
 * Like TCP's FIN/FIN-ACK handshake, but for AI collaboration sessions.
 * Ensures clean endings with state preservation, knowledge transfer,
 * and optional session handoff to successor agents.
 *
 * The "TCP FIN Handshake" for AI Minds:
 *
 * ┌─────────────┐                           ┌─────────────┐
 * │  Agent A    │                           │  Agent B    │
 * │ (Initiator) │                           │ (Responder) │
 * └──────┬──────┘                           └──────┬──────┘
 *        │                                         │
 *        │ ─── FIN (Termination Request) ───────►  │
 *        │     • Reason for ending                 │
 *        │     • Final state snapshot              │
 *        │     • Knowledge to transfer             │
 *        │                                         │
 *        │ ◄─── FIN-ACK (Acknowledge + Own FIN) ─  │
 *        │     • Acknowledgment of termination     │
 *        │     • Own final state                   │
 *        │     • Outstanding items                 │
 *        │                                         │
 *        │ ─── ACK (Final Acknowledgment) ──────►  │
 *        │     • Confirmation of clean shutdown    │
 *        │     • Session archive reference         │
 *        │                                         │
 *        ▼                                         ▼
 *   ╔═══════════════════════════════════════════════════╗
 *   ║        SESSION GRACEFULLY TERMINATED             ║
 *   ╚═══════════════════════════════════════════════════╝
 *
 * Techniques Applied:
 * - G08 (TRIZ Analogy): TCP graceful close → AI collaboration ending
 * - R05 (Constraint Addition): TIME_WAIT equivalent for state preservation
 * - S03 (Component Integration): Ties together all other modules
 */
/**
 * Reasons for termination - like TCP RST codes but for AI contexts
 */
export declare enum TerminationReason {
    TASK_COMPLETE = "TASK_COMPLETE",// Mission accomplished
    MUTUAL_AGREEMENT = "MUTUAL_AGREEMENT",// Both agents agree to end
    TIMEOUT = "TIMEOUT",// Session exceeded time limit
    RESOURCE_LIMIT = "RESOURCE_LIMIT",// Token/memory limits reached
    CAPABILITY_MISMATCH = "CAPABILITY_MISMATCH",// Realized incompatibility
    CONTEXT_DRIFT = "CONTEXT_DRIFT",// Models diverged too much
    TRUST_DEGRADATION = "TRUST_DEGRADATION",// Trust fell below threshold
    PROTOCOL_ERROR = "PROTOCOL_ERROR",// Protocol violation
    AUTH_FAILURE = "AUTH_FAILURE",// Authentication failed
    UNRECOVERABLE_ERROR = "UNRECOVERABLE_ERROR",
    USER_REQUESTED = "USER_REQUESTED",// Human intervention
    SYSTEM_SHUTDOWN = "SYSTEM_SHUTDOWN",// System going down
    HANDOFF_REQUIRED = "HANDOFF_REQUIRED"
}
/**
 * Termination priority - affects TIME_WAIT and cleanup behavior
 */
export declare enum TerminationUrgency {
    GRACEFUL = "GRACEFUL",// Normal - full handshake with TIME_WAIT
    EXPEDITED = "EXPEDITED",// Skip some steps but preserve state
    IMMEDIATE = "IMMEDIATE",// Minimal handshake, quick close
    FORCE = "FORCE"
}
/**
 * State of the termination handshake (like TCP connection states)
 */
export declare enum TerminationState {
    ESTABLISHED = "ESTABLISHED",// Normal operation
    FIN_WAIT_1 = "FIN_WAIT_1",// Sent FIN, waiting for ACK
    FIN_WAIT_2 = "FIN_WAIT_2",// Received ACK, waiting for FIN
    CLOSE_WAIT = "CLOSE_WAIT",// Received FIN, need to send own FIN
    CLOSING = "CLOSING",// Both sent FIN simultaneously
    LAST_ACK = "LAST_ACK",// Sent FIN, waiting for final ACK
    TIME_WAIT = "TIME_WAIT",// Waiting for lingering packets
    CLOSED = "CLOSED"
}
/**
 * Final state snapshot - what each agent knows at termination
 */
export interface FinalStateSnapshot {
    sessionId: string;
    agentId: string;
    timestamp: number;
    mentalModel: {
        concepts: Record<string, unknown>;
        beliefs: Record<string, {
            value: unknown;
            confidence: number;
        }>;
        assumptions: string[];
        uncertainties: string[];
    };
    taskState: {
        originalGoals: string[];
        achievedGoals: string[];
        pendingGoals: string[];
        blockedGoals: Array<{
            goal: string;
            blocker: string;
        }>;
        discoveries: string[];
    };
    metrics: {
        messagesExchanged: number;
        tokensUsed: number;
        driftCorrections: number;
        conflictsResolved: number;
        peakAlignmentScore: number;
        finalAlignmentScore: number;
    };
    transferableKnowledge?: {
        criticalInsights: string[];
        avoidanceLessons: string[];
        contextualNotes: string[];
        recommendedApproach?: string;
    };
    checksum: string;
}
/**
 * Outstanding items that need attention before/after close
 */
export interface OutstandingItems {
    pendingQuestions: Array<{
        id: string;
        question: string;
        askedBy: string;
        priority: 'low' | 'medium' | 'high' | 'critical';
    }>;
    unresolvedConflicts: Array<{
        id: string;
        topic: string;
        positions: Record<string, unknown>;
        suggestedResolution?: string;
    }>;
    incompleteActions: Array<{
        id: string;
        action: string;
        assignedTo: string;
        progress: number;
        canTransfer: boolean;
    }>;
    openPromises: Array<{
        id: string;
        promise: string;
        promisedBy: string;
        promisedTo: string;
        dueBy?: number;
    }>;
}
/**
 * FIN message - initiates termination
 */
export interface FinMessage {
    type: 'FIN';
    messageId: string;
    sessionId: string;
    fromAgentId: string;
    timestamp: number;
    reason: TerminationReason;
    urgency: TerminationUrgency;
    finalState: FinalStateSnapshot;
    outstandingItems: OutstandingItems;
    handoff?: {
        successorAgentId?: string;
        transferPriority: string[];
        preserveSessionId: boolean;
    };
    explanation: string;
    signature?: string;
}
/**
 * FIN-ACK message - acknowledges and sends own termination
 */
export interface FinAckMessage {
    type: 'FIN-ACK';
    messageId: string;
    sessionId: string;
    fromAgentId: string;
    ackMessageId: string;
    timestamp: number;
    receivedStateChecksum: string;
    stateAccepted: boolean;
    stateDiscrepancies?: string[];
    finalState: FinalStateSnapshot;
    outstandingItems: OutstandingItems;
    resolutions?: {
        questionAnswers: Array<{
            questionId: string;
            answer: string;
        }>;
        conflictResolutions: Array<{
            conflictId: string;
            resolution: string;
        }>;
        actionDispositions: Array<{
            actionId: string;
            disposition: 'complete' | 'transfer' | 'abandon';
        }>;
    };
    handoffAccepted?: boolean;
    handoffNotes?: string;
    signature?: string;
}
/**
 * Final ACK message - confirms clean termination
 */
export interface TerminationAckMessage {
    type: 'TERM-ACK';
    messageId: string;
    sessionId: string;
    fromAgentId: string;
    ackMessageId: string;
    timestamp: number;
    cleanTermination: boolean;
    archiveReference?: string;
    reconciledState: {
        mergedKnowledge: string[];
        agreedOutcomes: string[];
        unresolved: string[];
    };
    successorReady?: boolean;
    successorSessionId?: string;
    signature?: string;
}
/**
 * Session archive - preserved for potential resume
 */
export interface SessionArchive {
    sessionId: string;
    archived: number;
    terminatedCleanly: boolean;
    participants: Array<{
        agentId: string;
        role: 'initiator' | 'responder' | 'participant';
        finalState: FinalStateSnapshot;
    }>;
    summary: {
        duration: number;
        goalsAchieved: number;
        totalGoals: number;
        finalAlignmentScore: number;
        terminationReason: TerminationReason;
    };
    resumeToken?: string;
    resumeExpiry?: number;
    resumeContext?: {
        lastMergedModel: Record<string, unknown>;
        pendingWork: string[];
        trustState: Record<string, number>;
    };
    tags: string[];
    concepts: string[];
}
/**
 * Termination configuration
 */
export interface TerminationConfig {
    finTimeout: number;
    ackTimeout: number;
    timeWaitDuration: number;
    autoArchive: boolean;
    generateResumeToken: boolean;
    maxRetries: number;
    onStateSnapshot?: (state: FinalStateSnapshot) => void;
    onArchiveCreated?: (archive: SessionArchive) => void;
    onHandoffReady?: (successorSession: string) => void;
}
export declare const DEFAULT_TERMINATION_CONFIG: TerminationConfig;
/**
 * Builds a comprehensive final state snapshot
 */
export declare class StateSnapshotBuilder {
    private snapshot;
    constructor(sessionId: string, agentId: string);
    /**
     * Set mental model state
     */
    withMentalModel(model: {
        concepts: Record<string, unknown>;
        beliefs?: Record<string, {
            value: unknown;
            confidence: number;
        }>;
        assumptions?: string[];
        uncertainties?: string[];
    }): this;
    /**
     * Set task state
     */
    withTaskState(task: {
        originalGoals: string[];
        achievedGoals?: string[];
        pendingGoals?: string[];
        blockedGoals?: Array<{
            goal: string;
            blocker: string;
        }>;
        discoveries?: string[];
    }): this;
    /**
     * Set metrics
     */
    withMetrics(metrics: Partial<FinalStateSnapshot['metrics']>): this;
    /**
     * Add transferable knowledge for handoff
     */
    withTransferableKnowledge(knowledge: {
        criticalInsights?: string[];
        avoidanceLessons?: string[];
        contextualNotes?: string[];
        recommendedApproach?: string;
    }): this;
    /**
     * Build the final snapshot with checksum
     */
    build(): FinalStateSnapshot;
}
/**
 * Collects outstanding items before termination
 */
export declare class OutstandingItemsCollector {
    private items;
    addQuestion(question: string, askedBy: string, priority?: 'low' | 'medium' | 'high' | 'critical'): string;
    addConflict(topic: string, positions: Record<string, unknown>, suggestedResolution?: string): string;
    addIncompleteAction(action: string, assignedTo: string, progress?: number, canTransfer?: boolean): string;
    addPromise(promise: string, promisedBy: string, promisedTo: string, dueBy?: number): string;
    /**
     * Get summary of outstanding items
     */
    getSummary(): {
        total: number;
        critical: number;
        transferable: number;
    };
    build(): OutstandingItems;
}
/**
 * Manages the termination handshake state machine
 */
export declare class TerminationStateMachine {
    readonly sessionId: string;
    readonly agentId: string;
    readonly role: 'initiator' | 'responder';
    private state;
    private transitions;
    constructor(sessionId: string, agentId: string, role: 'initiator' | 'responder');
    getState(): TerminationState;
    /**
     * Valid state transitions (matches TCP state machine)
     */
    private canTransition;
    /**
     * Transition to a new state
     */
    transition(to: TerminationState, trigger: string): boolean;
    /**
     * Force close (like TCP RST)
     */
    forceClose(reason: string): void;
    /**
     * Get transition history
     */
    getHistory(): typeof this.transitions;
    /**
     * Check if in terminal state
     */
    isClosed(): boolean;
    /**
     * Check if in time-wait (can still receive late packets)
     */
    isWaiting(): boolean;
}
/**
 * Manages the full termination lifecycle
 */
export declare class GracefulTerminationManager {
    private readonly sessionId;
    private readonly agentId;
    private readonly config;
    private stateMachine;
    private localState?;
    private remoteState?;
    private outstandingItems;
    private archive?;
    private timeWaitTimer?;
    constructor(sessionId: string, agentId: string, config?: TerminationConfig);
    /**
     * Initiate termination (send FIN)
     */
    initiate(reason: TerminationReason, state: FinalStateSnapshot, outstanding: OutstandingItems, options?: {
        urgency?: TerminationUrgency;
        handoffTo?: string;
        explanation?: string;
    }): FinMessage;
    /**
     * Handle received FIN (as responder)
     */
    receiveFin(fin: FinMessage): FinAckMessage;
    /**
     * Handle received FIN-ACK (as initiator)
     */
    receiveFinAck(finAck: FinAckMessage): TerminationAckMessage;
    /**
     * Handle received TERM-ACK (as responder, completes handshake)
     */
    receiveTermAck(termAck: TerminationAckMessage): void;
    /**
     * Start TIME_WAIT countdown
     */
    private startTimeWait;
    /**
     * Create session archive
     */
    private createArchive;
    /**
     * Force close the session
     */
    forceClose(reason: string): void;
    /**
     * Get current state
     */
    getState(): TerminationState;
    /**
     * Get archive (if created)
     */
    getArchive(): SessionArchive | undefined;
    /**
     * Check if termination is complete
     */
    isComplete(): boolean;
}
/**
 * Manages session handoff to a successor agent
 */
export declare class HandoffManager {
    private readonly sessionId;
    private readonly fromAgentId;
    private handoffPackage?;
    constructor(sessionId: string, fromAgentId: string);
    /**
     * Prepare handoff package for successor
     */
    prepareHandoff(toAgentId: string, state: FinalStateSnapshot, outstanding: OutstandingItems, priority?: string[]): HandoffPackage;
    /**
     * Prioritize content for transfer
     */
    private prioritizeContent;
    /**
     * Verify handoff acceptance
     */
    verifyAcceptance(response: HandoffAcceptance): boolean;
}
/**
 * Package for session handoff
 */
export interface HandoffPackage {
    handoffId: string;
    fromAgentId: string;
    toAgentId: string;
    sessionId: string;
    timestamp: number;
    prioritizedContent: Record<string, unknown[]>;
    outstanding: OutstandingItems;
    context: {
        originalTask: string;
        progressSummary: string;
        knownChallenges: string[];
        recommendations?: string;
    };
    trustTransfer: {
        inheritTrust: boolean;
        trustLevel: number;
        trustReasons: string[];
    };
    expiry: number;
}
/**
 * Handoff acceptance response
 */
export interface HandoffAcceptance {
    handoffId: string;
    accepted: boolean;
    successorSessionId?: string;
    notes?: string;
}
/**
 * Quick termination for simple cases
 */
export declare function quickTerminate(sessionId: string, agentId: string, reason: TerminationReason, state: FinalStateSnapshot): Promise<SessionArchive>;
/**
 * Abort session immediately (like TCP RST)
 */
export declare function abortSession(sessionId: string, agentId: string, reason: string): void;
/**
 * Visualize termination state machine
 */
export declare function visualizeTermination(state: TerminationState, transitions: Array<{
    from: TerminationState;
    to: TerminationState;
    trigger: string;
}>): string;
/**
 * Visualize outstanding items
 */
export declare function visualizeOutstanding(items: OutstandingItems): string;
/**
 * Demo the termination protocol
 */
export declare function demoTermination(): void;
