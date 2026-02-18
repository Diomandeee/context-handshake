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
import { createHash, randomUUID } from 'crypto';
// =============================================================================
// Core Types
// =============================================================================
/**
 * Reasons for termination - like TCP RST codes but for AI contexts
 */
export var TerminationReason;
(function (TerminationReason) {
    // Normal termination
    TerminationReason["TASK_COMPLETE"] = "TASK_COMPLETE";
    TerminationReason["MUTUAL_AGREEMENT"] = "MUTUAL_AGREEMENT";
    TerminationReason["TIMEOUT"] = "TIMEOUT";
    TerminationReason["RESOURCE_LIMIT"] = "RESOURCE_LIMIT";
    // Graceful degradation
    TerminationReason["CAPABILITY_MISMATCH"] = "CAPABILITY_MISMATCH";
    TerminationReason["CONTEXT_DRIFT"] = "CONTEXT_DRIFT";
    TerminationReason["TRUST_DEGRADATION"] = "TRUST_DEGRADATION";
    // Error conditions
    TerminationReason["PROTOCOL_ERROR"] = "PROTOCOL_ERROR";
    TerminationReason["AUTH_FAILURE"] = "AUTH_FAILURE";
    TerminationReason["UNRECOVERABLE_ERROR"] = "UNRECOVERABLE_ERROR";
    // External triggers
    TerminationReason["USER_REQUESTED"] = "USER_REQUESTED";
    TerminationReason["SYSTEM_SHUTDOWN"] = "SYSTEM_SHUTDOWN";
    TerminationReason["HANDOFF_REQUIRED"] = "HANDOFF_REQUIRED";
})(TerminationReason || (TerminationReason = {}));
/**
 * Termination priority - affects TIME_WAIT and cleanup behavior
 */
export var TerminationUrgency;
(function (TerminationUrgency) {
    TerminationUrgency["GRACEFUL"] = "GRACEFUL";
    TerminationUrgency["EXPEDITED"] = "EXPEDITED";
    TerminationUrgency["IMMEDIATE"] = "IMMEDIATE";
    TerminationUrgency["FORCE"] = "FORCE";
})(TerminationUrgency || (TerminationUrgency = {}));
/**
 * State of the termination handshake (like TCP connection states)
 */
export var TerminationState;
(function (TerminationState) {
    TerminationState["ESTABLISHED"] = "ESTABLISHED";
    TerminationState["FIN_WAIT_1"] = "FIN_WAIT_1";
    TerminationState["FIN_WAIT_2"] = "FIN_WAIT_2";
    TerminationState["CLOSE_WAIT"] = "CLOSE_WAIT";
    TerminationState["CLOSING"] = "CLOSING";
    TerminationState["LAST_ACK"] = "LAST_ACK";
    TerminationState["TIME_WAIT"] = "TIME_WAIT";
    TerminationState["CLOSED"] = "CLOSED";
})(TerminationState || (TerminationState = {}));
export const DEFAULT_TERMINATION_CONFIG = {
    finTimeout: 30000,
    ackTimeout: 15000,
    timeWaitDuration: 60000, // 1 minute TIME_WAIT
    autoArchive: true,
    generateResumeToken: true,
    maxRetries: 3,
};
// =============================================================================
// State Snapshot Builder
// =============================================================================
/**
 * Builds a comprehensive final state snapshot
 */
export class StateSnapshotBuilder {
    snapshot = {};
    constructor(sessionId, agentId) {
        this.snapshot.sessionId = sessionId;
        this.snapshot.agentId = agentId;
        this.snapshot.timestamp = Date.now();
    }
    /**
     * Set mental model state
     */
    withMentalModel(model) {
        this.snapshot.mentalModel = {
            concepts: model.concepts,
            beliefs: model.beliefs ?? {},
            assumptions: model.assumptions ?? [],
            uncertainties: model.uncertainties ?? [],
        };
        return this;
    }
    /**
     * Set task state
     */
    withTaskState(task) {
        this.snapshot.taskState = {
            originalGoals: task.originalGoals,
            achievedGoals: task.achievedGoals ?? [],
            pendingGoals: task.pendingGoals ?? [],
            blockedGoals: task.blockedGoals ?? [],
            discoveries: task.discoveries ?? [],
        };
        return this;
    }
    /**
     * Set metrics
     */
    withMetrics(metrics) {
        this.snapshot.metrics = {
            messagesExchanged: metrics.messagesExchanged ?? 0,
            tokensUsed: metrics.tokensUsed ?? 0,
            driftCorrections: metrics.driftCorrections ?? 0,
            conflictsResolved: metrics.conflictsResolved ?? 0,
            peakAlignmentScore: metrics.peakAlignmentScore ?? 1.0,
            finalAlignmentScore: metrics.finalAlignmentScore ?? 1.0,
        };
        return this;
    }
    /**
     * Add transferable knowledge for handoff
     */
    withTransferableKnowledge(knowledge) {
        this.snapshot.transferableKnowledge = {
            criticalInsights: knowledge.criticalInsights ?? [],
            avoidanceLessons: knowledge.avoidanceLessons ?? [],
            contextualNotes: knowledge.contextualNotes ?? [],
            recommendedApproach: knowledge.recommendedApproach,
        };
        return this;
    }
    /**
     * Build the final snapshot with checksum
     */
    build() {
        if (!this.snapshot.mentalModel) {
            throw new Error('Mental model is required');
        }
        if (!this.snapshot.taskState) {
            throw new Error('Task state is required');
        }
        if (!this.snapshot.metrics) {
            this.snapshot.metrics = {
                messagesExchanged: 0,
                tokensUsed: 0,
                driftCorrections: 0,
                conflictsResolved: 0,
                peakAlignmentScore: 1.0,
                finalAlignmentScore: 1.0,
            };
        }
        // Generate checksum
        const contentForHash = JSON.stringify({
            mentalModel: this.snapshot.mentalModel,
            taskState: this.snapshot.taskState,
            metrics: this.snapshot.metrics,
        });
        this.snapshot.checksum = createHash('sha256')
            .update(contentForHash)
            .digest('hex')
            .substring(0, 16);
        return this.snapshot;
    }
}
// =============================================================================
// Outstanding Items Collector
// =============================================================================
/**
 * Collects outstanding items before termination
 */
export class OutstandingItemsCollector {
    items = {
        pendingQuestions: [],
        unresolvedConflicts: [],
        incompleteActions: [],
        openPromises: [],
    };
    addQuestion(question, askedBy, priority = 'medium') {
        const id = `q_${randomUUID().substring(0, 8)}`;
        this.items.pendingQuestions.push({ id, question, askedBy, priority });
        return id;
    }
    addConflict(topic, positions, suggestedResolution) {
        const id = `c_${randomUUID().substring(0, 8)}`;
        this.items.unresolvedConflicts.push({ id, topic, positions, suggestedResolution });
        return id;
    }
    addIncompleteAction(action, assignedTo, progress = 0, canTransfer = true) {
        const id = `a_${randomUUID().substring(0, 8)}`;
        this.items.incompleteActions.push({ id, action, assignedTo, progress, canTransfer });
        return id;
    }
    addPromise(promise, promisedBy, promisedTo, dueBy) {
        const id = `p_${randomUUID().substring(0, 8)}`;
        this.items.openPromises.push({ id, promise, promisedBy, promisedTo, dueBy });
        return id;
    }
    /**
     * Get summary of outstanding items
     */
    getSummary() {
        const criticalQuestions = this.items.pendingQuestions.filter(q => q.priority === 'critical').length;
        const transferableActions = this.items.incompleteActions.filter(a => a.canTransfer).length;
        return {
            total: this.items.pendingQuestions.length +
                this.items.unresolvedConflicts.length +
                this.items.incompleteActions.length +
                this.items.openPromises.length,
            critical: criticalQuestions,
            transferable: transferableActions,
        };
    }
    build() {
        return { ...this.items };
    }
}
// =============================================================================
// Termination State Machine
// =============================================================================
/**
 * Manages the termination handshake state machine
 */
export class TerminationStateMachine {
    sessionId;
    agentId;
    role;
    state = TerminationState.ESTABLISHED;
    transitions = [];
    constructor(sessionId, agentId, role) {
        this.sessionId = sessionId;
        this.agentId = agentId;
        this.role = role;
    }
    getState() {
        return this.state;
    }
    /**
     * Valid state transitions (matches TCP state machine)
     */
    canTransition(to) {
        const validTransitions = {
            [TerminationState.ESTABLISHED]: [TerminationState.FIN_WAIT_1, TerminationState.CLOSE_WAIT],
            [TerminationState.FIN_WAIT_1]: [TerminationState.FIN_WAIT_2, TerminationState.CLOSING],
            [TerminationState.FIN_WAIT_2]: [TerminationState.TIME_WAIT],
            [TerminationState.CLOSE_WAIT]: [TerminationState.LAST_ACK],
            [TerminationState.CLOSING]: [TerminationState.TIME_WAIT],
            [TerminationState.LAST_ACK]: [TerminationState.CLOSED],
            [TerminationState.TIME_WAIT]: [TerminationState.CLOSED],
            [TerminationState.CLOSED]: [],
        };
        return validTransitions[this.state]?.includes(to) ?? false;
    }
    /**
     * Transition to a new state
     */
    transition(to, trigger) {
        if (!this.canTransition(to)) {
            return false;
        }
        this.transitions.push({
            from: this.state,
            to,
            at: Date.now(),
            trigger,
        });
        this.state = to;
        return true;
    }
    /**
     * Force close (like TCP RST)
     */
    forceClose(reason) {
        this.transitions.push({
            from: this.state,
            to: TerminationState.CLOSED,
            at: Date.now(),
            trigger: `FORCE: ${reason}`,
        });
        this.state = TerminationState.CLOSED;
    }
    /**
     * Get transition history
     */
    getHistory() {
        return [...this.transitions];
    }
    /**
     * Check if in terminal state
     */
    isClosed() {
        return this.state === TerminationState.CLOSED;
    }
    /**
     * Check if in time-wait (can still receive late packets)
     */
    isWaiting() {
        return this.state === TerminationState.TIME_WAIT;
    }
}
// =============================================================================
// Graceful Termination Manager
// =============================================================================
/**
 * Manages the full termination lifecycle
 */
export class GracefulTerminationManager {
    sessionId;
    agentId;
    config;
    stateMachine;
    localState;
    remoteState;
    outstandingItems;
    archive;
    timeWaitTimer;
    constructor(sessionId, agentId, config = DEFAULT_TERMINATION_CONFIG) {
        this.sessionId = sessionId;
        this.agentId = agentId;
        this.config = config;
        this.stateMachine = new TerminationStateMachine(sessionId, agentId, 'initiator');
        this.outstandingItems = {
            pendingQuestions: [],
            unresolvedConflicts: [],
            incompleteActions: [],
            openPromises: [],
        };
    }
    /**
     * Initiate termination (send FIN)
     */
    initiate(reason, state, outstanding, options) {
        this.localState = state;
        this.outstandingItems = outstanding;
        // Transition to FIN_WAIT_1
        this.stateMachine.transition(TerminationState.FIN_WAIT_1, 'SEND_FIN');
        const fin = {
            type: 'FIN',
            messageId: `fin_${randomUUID().substring(0, 8)}`,
            sessionId: this.sessionId,
            fromAgentId: this.agentId,
            timestamp: Date.now(),
            reason,
            urgency: options?.urgency ?? TerminationUrgency.GRACEFUL,
            finalState: state,
            outstandingItems: outstanding,
            explanation: options?.explanation ?? `Session terminating: ${reason}`,
        };
        if (options?.handoffTo) {
            fin.handoff = {
                successorAgentId: options.handoffTo,
                transferPriority: ['criticalInsights', 'pendingGoals', 'discoveries'],
                preserveSessionId: false,
            };
        }
        return fin;
    }
    /**
     * Handle received FIN (as responder)
     */
    receiveFin(fin) {
        this.remoteState = fin.finalState;
        // Transition to CLOSE_WAIT
        this.stateMachine.transition(TerminationState.CLOSE_WAIT, 'RECEIVE_FIN');
        // Analyze received state
        const discrepancies = [];
        if (this.localState) {
            // Check for state discrepancies
            if (fin.finalState.metrics.messagesExchanged !== this.localState.metrics.messagesExchanged) {
                discrepancies.push(`Message count mismatch: ${fin.finalState.metrics.messagesExchanged} vs ${this.localState.metrics.messagesExchanged}`);
            }
        }
        // Transition to LAST_ACK
        this.stateMachine.transition(TerminationState.LAST_ACK, 'SEND_FIN_ACK');
        const finAck = {
            type: 'FIN-ACK',
            messageId: `finack_${randomUUID().substring(0, 8)}`,
            sessionId: this.sessionId,
            fromAgentId: this.agentId,
            ackMessageId: fin.messageId,
            timestamp: Date.now(),
            receivedStateChecksum: fin.finalState.checksum,
            stateAccepted: discrepancies.length === 0,
            stateDiscrepancies: discrepancies.length > 0 ? discrepancies : undefined,
            finalState: this.localState,
            outstandingItems: this.outstandingItems,
            handoffAccepted: fin.handoff ? true : undefined,
        };
        return finAck;
    }
    /**
     * Handle received FIN-ACK (as initiator)
     */
    receiveFinAck(finAck) {
        this.remoteState = finAck.finalState;
        // Transition to TIME_WAIT
        this.stateMachine.transition(TerminationState.FIN_WAIT_2, 'RECEIVE_ACK');
        this.stateMachine.transition(TerminationState.TIME_WAIT, 'RECEIVE_FIN');
        // Reconcile states
        const mergedKnowledge = [];
        const agreedOutcomes = [];
        const unresolved = [];
        if (this.localState && this.remoteState) {
            // Merge discoveries
            const allDiscoveries = new Set([
                ...this.localState.taskState.discoveries,
                ...this.remoteState.taskState.discoveries,
            ]);
            mergedKnowledge.push(...Array.from(allDiscoveries));
            // Find agreed outcomes
            const localAchieved = new Set(this.localState.taskState.achievedGoals);
            for (const goal of this.remoteState.taskState.achievedGoals) {
                if (localAchieved.has(goal)) {
                    agreedOutcomes.push(goal);
                }
            }
            // Find unresolved items
            if (finAck.stateDiscrepancies) {
                unresolved.push(...finAck.stateDiscrepancies);
            }
        }
        // Create archive
        if (this.config.autoArchive) {
            this.archive = this.createArchive(TerminationReason.TASK_COMPLETE);
        }
        // Start TIME_WAIT timer
        this.startTimeWait();
        const termAck = {
            type: 'TERM-ACK',
            messageId: `termack_${randomUUID().substring(0, 8)}`,
            sessionId: this.sessionId,
            fromAgentId: this.agentId,
            ackMessageId: finAck.messageId,
            timestamp: Date.now(),
            cleanTermination: unresolved.length === 0,
            archiveReference: this.archive ? `archive:${this.sessionId}` : undefined,
            reconciledState: {
                mergedKnowledge,
                agreedOutcomes,
                unresolved,
            },
        };
        return termAck;
    }
    /**
     * Handle received TERM-ACK (as responder, completes handshake)
     */
    receiveTermAck(termAck) {
        // Transition to CLOSED
        this.stateMachine.transition(TerminationState.CLOSED, 'RECEIVE_TERM_ACK');
        // Create archive if configured
        if (this.config.autoArchive && !this.archive) {
            this.archive = this.createArchive(TerminationReason.TASK_COMPLETE);
        }
        if (this.archive && this.config.onArchiveCreated) {
            this.config.onArchiveCreated(this.archive);
        }
    }
    /**
     * Start TIME_WAIT countdown
     */
    startTimeWait() {
        this.timeWaitTimer = setTimeout(() => {
            this.stateMachine.transition(TerminationState.CLOSED, 'TIME_WAIT_EXPIRED');
            if (this.archive && this.config.onArchiveCreated) {
                this.config.onArchiveCreated(this.archive);
            }
        }, this.config.timeWaitDuration);
    }
    /**
     * Create session archive
     */
    createArchive(reason) {
        const participants = [];
        if (this.localState) {
            participants.push({
                agentId: this.agentId,
                role: 'initiator',
                finalState: this.localState,
            });
        }
        if (this.remoteState) {
            participants.push({
                agentId: this.remoteState.agentId,
                role: 'responder',
                finalState: this.remoteState,
            });
        }
        const totalGoals = this.localState?.taskState.originalGoals.length ?? 0;
        const achievedGoals = this.localState?.taskState.achievedGoals.length ?? 0;
        const archive = {
            sessionId: this.sessionId,
            archived: Date.now(),
            terminatedCleanly: this.stateMachine.getState() !== TerminationState.CLOSED || true,
            participants,
            summary: {
                duration: this.localState ? Date.now() - this.localState.timestamp : 0,
                goalsAchieved: achievedGoals,
                totalGoals,
                finalAlignmentScore: this.localState?.metrics.finalAlignmentScore ?? 1.0,
                terminationReason: reason,
            },
            tags: [],
            concepts: Object.keys(this.localState?.mentalModel.concepts ?? {}),
        };
        // Generate resume token if configured
        if (this.config.generateResumeToken) {
            archive.resumeToken = createHash('sha256')
                .update(this.sessionId + Date.now())
                .digest('hex')
                .substring(0, 32);
            archive.resumeExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
            archive.resumeContext = {
                lastMergedModel: this.localState?.mentalModel.concepts ?? {},
                pendingWork: this.localState?.taskState.pendingGoals ?? [],
                trustState: {},
            };
        }
        return archive;
    }
    /**
     * Force close the session
     */
    forceClose(reason) {
        if (this.timeWaitTimer) {
            clearTimeout(this.timeWaitTimer);
        }
        this.stateMachine.forceClose(reason);
    }
    /**
     * Get current state
     */
    getState() {
        return this.stateMachine.getState();
    }
    /**
     * Get archive (if created)
     */
    getArchive() {
        return this.archive;
    }
    /**
     * Check if termination is complete
     */
    isComplete() {
        return this.stateMachine.isClosed();
    }
}
// =============================================================================
// Handoff Manager
// =============================================================================
/**
 * Manages session handoff to a successor agent
 */
export class HandoffManager {
    sessionId;
    fromAgentId;
    handoffPackage;
    constructor(sessionId, fromAgentId) {
        this.sessionId = sessionId;
        this.fromAgentId = fromAgentId;
    }
    /**
     * Prepare handoff package for successor
     */
    prepareHandoff(toAgentId, state, outstanding, priority = ['criticalInsights', 'pendingGoals', 'discoveries']) {
        this.handoffPackage = {
            handoffId: `handoff_${randomUUID().substring(0, 8)}`,
            fromAgentId: this.fromAgentId,
            toAgentId,
            sessionId: this.sessionId,
            timestamp: Date.now(),
            prioritizedContent: this.prioritizeContent(state, priority),
            outstanding,
            context: {
                originalTask: state.taskState.originalGoals.join('; '),
                progressSummary: `Achieved ${state.taskState.achievedGoals.length}/${state.taskState.originalGoals.length} goals`,
                knownChallenges: state.taskState.blockedGoals.map(b => b.blocker),
                recommendations: state.transferableKnowledge?.recommendedApproach,
            },
            trustTransfer: {
                inheritTrust: true,
                trustLevel: 0.5, // Start with moderate trust
                trustReasons: ['session_handoff', 'predecessor_endorsement'],
            },
            expiry: Date.now() + 60 * 60 * 1000, // 1 hour to accept
        };
        return this.handoffPackage;
    }
    /**
     * Prioritize content for transfer
     */
    prioritizeContent(state, priority) {
        const content = {};
        for (const key of priority) {
            switch (key) {
                case 'criticalInsights':
                    content[key] = state.transferableKnowledge?.criticalInsights ?? [];
                    break;
                case 'pendingGoals':
                    content[key] = state.taskState.pendingGoals;
                    break;
                case 'discoveries':
                    content[key] = state.taskState.discoveries;
                    break;
                case 'avoidanceLessons':
                    content[key] = state.transferableKnowledge?.avoidanceLessons ?? [];
                    break;
                case 'concepts':
                    content[key] = Object.entries(state.mentalModel.concepts);
                    break;
            }
        }
        return content;
    }
    /**
     * Verify handoff acceptance
     */
    verifyAcceptance(response) {
        if (!this.handoffPackage)
            return false;
        if (response.handoffId !== this.handoffPackage.handoffId)
            return false;
        if (Date.now() > this.handoffPackage.expiry)
            return false;
        return response.accepted;
    }
}
// =============================================================================
// Quick Termination Functions
// =============================================================================
/**
 * Quick termination for simple cases
 */
export async function quickTerminate(sessionId, agentId, reason, state) {
    const manager = new GracefulTerminationManager(sessionId, agentId, {
        ...DEFAULT_TERMINATION_CONFIG,
        timeWaitDuration: 0, // Skip TIME_WAIT for quick terminate
    });
    const outstanding = new OutstandingItemsCollector().build();
    // Simulate immediate close
    manager.initiate(reason, state, outstanding, { urgency: TerminationUrgency.IMMEDIATE });
    manager.forceClose('quick_terminate');
    return manager.getArchive();
}
/**
 * Abort session immediately (like TCP RST)
 */
export function abortSession(sessionId, agentId, reason) {
    const manager = new GracefulTerminationManager(sessionId, agentId);
    manager.forceClose(reason);
}
// =============================================================================
// Visualization
// =============================================================================
/**
 * Visualize termination state machine
 */
export function visualizeTermination(state, transitions) {
    const stateEmoji = {
        [TerminationState.ESTABLISHED]: '🟢',
        [TerminationState.FIN_WAIT_1]: '🟡',
        [TerminationState.FIN_WAIT_2]: '🟡',
        [TerminationState.CLOSE_WAIT]: '🟠',
        [TerminationState.CLOSING]: '🟠',
        [TerminationState.LAST_ACK]: '🟠',
        [TerminationState.TIME_WAIT]: '⏳',
        [TerminationState.CLOSED]: '🔴',
    };
    let output = `
╔════════════════════════════════════════╗
║     TERMINATION STATE MACHINE          ║
╠════════════════════════════════════════╣
║  Current: ${stateEmoji[state]} ${state.padEnd(15)}      ║
╠════════════════════════════════════════╣
║  Transitions:                          ║`;
    for (const t of transitions) {
        output += `\n║  ${stateEmoji[t.from]} → ${stateEmoji[t.to]} (${t.trigger})`.padEnd(43) + '║';
    }
    output += `
╚════════════════════════════════════════╝`;
    return output;
}
/**
 * Visualize outstanding items
 */
export function visualizeOutstanding(items) {
    const summary = {
        questions: items.pendingQuestions.length,
        conflicts: items.unresolvedConflicts.length,
        actions: items.incompleteActions.length,
        promises: items.openPromises.length,
    };
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    return `
┌──────────────────────────────────────┐
│    OUTSTANDING ITEMS (${total} total)       │
├──────────────────────────────────────┤
│  ❓ Questions:  ${String(summary.questions).padStart(3)}                  │
│  ⚔️  Conflicts:  ${String(summary.conflicts).padStart(3)}                  │
│  📋 Actions:    ${String(summary.actions).padStart(3)}                  │
│  🤝 Promises:   ${String(summary.promises).padStart(3)}                  │
└──────────────────────────────────────┘`;
}
// =============================================================================
// Demo / Example
// =============================================================================
/**
 * Demo the termination protocol
 */
export function demoTermination() {
    console.log('=== Context Handshake: Termination Protocol Demo ===\n');
    // Build state for Agent A
    const stateA = new StateSnapshotBuilder('session_123', 'agent_A')
        .withMentalModel({
        concepts: { 'scraper': 'Web data extractor', 'pagination': 'Multi-page handling' },
        beliefs: { 'approach': { value: 'Puppeteer', confidence: 0.9 } },
        assumptions: ['Target site allows scraping'],
    })
        .withTaskState({
        originalGoals: ['Build scraper', 'Handle pagination', 'Export to JSON'],
        achievedGoals: ['Build scraper', 'Handle pagination'],
        pendingGoals: ['Export to JSON'],
        discoveries: ['Site uses infinite scroll', 'Rate limiting at 100 req/min'],
    })
        .withMetrics({
        messagesExchanged: 47,
        tokensUsed: 15000,
        driftCorrections: 2,
        conflictsResolved: 1,
        peakAlignmentScore: 0.95,
        finalAlignmentScore: 0.88,
    })
        .withTransferableKnowledge({
        criticalInsights: ['Infinite scroll requires scroll-to-load approach'],
        avoidanceLessons: ['Do not exceed 100 req/min or get blocked'],
        contextualNotes: ['CSS selectors may change, use data attributes'],
        recommendedApproach: 'Use Puppeteer with scroll detection',
    })
        .build();
    // Collect outstanding items
    const outstanding = new OutstandingItemsCollector();
    outstanding.addQuestion('What format for the JSON output?', 'agent_B', 'high');
    outstanding.addIncompleteAction('Export to JSON', 'agent_A', 60, true);
    // Initiate termination
    const managerA = new GracefulTerminationManager('session_123', 'agent_A');
    const fin = managerA.initiate(TerminationReason.RESOURCE_LIMIT, stateA, outstanding.build(), {
        urgency: TerminationUrgency.GRACEFUL,
        explanation: 'Token limit approaching, handing off remaining work',
        handoffTo: 'agent_C',
    });
    console.log('FIN Message:');
    console.log(JSON.stringify(fin, null, 2).substring(0, 500) + '...\n');
    // Simulate responder (Agent B)
    const managerB = new GracefulTerminationManager('session_123', 'agent_B');
    managerB['localState'] = new StateSnapshotBuilder('session_123', 'agent_B')
        .withMentalModel({ concepts: { 'scraper': 'Data extractor tool' } })
        .withTaskState({ originalGoals: ['Support scraper development'] })
        .withMetrics({ messagesExchanged: 47 })
        .build();
    const finAck = managerB.receiveFin(fin);
    console.log('FIN-ACK Message:');
    console.log(JSON.stringify(finAck, null, 2).substring(0, 400) + '...\n');
    // Complete termination
    const termAck = managerA.receiveFinAck(finAck);
    console.log('TERM-ACK Message:');
    console.log(JSON.stringify(termAck, null, 2) + '\n');
    // Show state machine
    console.log(visualizeTermination(managerA.getState(), managerA['stateMachine'].getHistory()));
    console.log(visualizeOutstanding(outstanding.build()));
    // Show archive
    const archive = managerA.getArchive();
    if (archive) {
        console.log('\nSession Archive:');
        console.log(`  ID: ${archive.sessionId}`);
        console.log(`  Goals: ${archive.summary.goalsAchieved}/${archive.summary.totalGoals} achieved`);
        console.log(`  Resume Token: ${archive.resumeToken}`);
        console.log(`  Expires: ${new Date(archive.resumeExpiry).toISOString()}`);
    }
}
// Run demo if executed directly
if (require.main === module) {
    demoTermination();
}
