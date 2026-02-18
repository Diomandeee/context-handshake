/**
 * Context Handshake State Machine
 *
 * Manages the three-phase handshake protocol
 */
import { DEFAULT_CONFIG, PROTOCOL_VERSION } from './protocol';
import { hashContext, generateNonce, generateSessionId } from './context';
import { analyzeAlignment } from './alignment';
import { mergeModels } from './merge';
/**
 * Context Handshake Manager
 */
export class ContextHandshake {
    state = 'idle';
    context;
    config;
    peerContext;
    alignment;
    session;
    sentSyn;
    receivedSyn;
    sentSynAck;
    constructor(context, config = {}) {
        this.context = context;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Initiate a handshake with another agent (send SYN)
     */
    initiate() {
        if (this.state !== 'idle') {
            throw new Error(`Cannot initiate from state: ${this.state}`);
        }
        const syn = {
            type: 'SYN',
            protocolVersion: PROTOCOL_VERSION,
            from: this.context.agentId,
            timestamp: new Date().toISOString(),
            context: this.context,
            checksum: hashContext(this.context),
            nonce: generateNonce(),
        };
        this.sentSyn = syn;
        this.state = 'syn_sent';
        return syn;
    }
    /**
     * Receive a SYN and generate SYN-ACK (responder side)
     */
    receiveSyn(syn) {
        if (this.state !== 'idle') {
            return this.createRst(syn.from, 'protocol_error', 'Already in handshake');
        }
        // Verify checksum
        const expectedChecksum = hashContext(syn.context);
        if (syn.checksum !== expectedChecksum) {
            return this.createRst(syn.from, 'protocol_error', 'Checksum mismatch');
        }
        this.receivedSyn = syn;
        this.peerContext = syn.context;
        // Analyze alignment
        this.alignment = analyzeAlignment(syn.context, this.context);
        // Check minimum alignment
        if (this.alignment.score < this.config.minAlignment) {
            this.state = 'failed';
            return this.createRst(syn.from, 'alignment_failure', `Alignment score ${this.alignment.score.toFixed(2)} below minimum ${this.config.minAlignment}`);
        }
        // Generate SYN-ACK
        const synAck = {
            type: 'SYN-ACK',
            protocolVersion: PROTOCOL_VERSION,
            from: this.context.agentId,
            to: syn.from,
            timestamp: new Date().toISOString(),
            ackChecksum: syn.checksum,
            alignment: this.alignment,
            context: this.context,
            checksum: hashContext(this.context),
            nonce: generateNonce(),
        };
        this.sentSynAck = synAck;
        this.state = 'syn_received';
        return synAck;
    }
    /**
     * Receive a SYN-ACK and complete handshake (send ACK)
     */
    receiveSynAck(synAck) {
        if (this.state !== 'syn_sent') {
            return this.createRst(synAck.from, 'protocol_error', 'Unexpected SYN-ACK');
        }
        // Verify our SYN was acknowledged
        if (synAck.ackChecksum !== this.sentSyn?.checksum) {
            return this.createRst(synAck.from, 'protocol_error', 'ACK checksum mismatch');
        }
        this.peerContext = synAck.context;
        this.alignment = synAck.alignment;
        // Check if we accept the alignment
        if (!synAck.alignment.compatibilityFlags.canCollaborate) {
            this.state = 'failed';
            return this.createRst(synAck.from, 'alignment_failure', 'Cannot collaborate');
        }
        // Merge models
        const mergedModel = mergeModels(this.context.mentalModel, synAck.context.mentalModel, synAck.alignment);
        // Assign roles
        mergedModel.roleAssignments = synAck.alignment.compatibilityFlags.suggestedRoles;
        // Create session
        const sessionId = generateSessionId([this.context.agentId, synAck.from]);
        this.session = {
            sessionId,
            participants: [this.context.agentId, synAck.from],
            mergedModel,
            startedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            status: 'active',
            messageLog: [],
        };
        // Generate ACK
        const ack = {
            type: 'ACK',
            protocolVersion: PROTOCOL_VERSION,
            from: this.context.agentId,
            to: synAck.from,
            timestamp: new Date().toISOString(),
            ackChecksum: synAck.checksum,
            mergedModel,
            sessionId,
        };
        this.state = 'established';
        return ack;
    }
    /**
     * Receive ACK and finalize handshake (responder side)
     */
    receiveAck(ack) {
        if (this.state !== 'syn_received') {
            throw new Error(`Unexpected ACK in state: ${this.state}`);
        }
        // Verify our SYN-ACK was acknowledged
        if (ack.ackChecksum !== this.sentSynAck?.checksum) {
            throw new Error('ACK checksum mismatch');
        }
        // Create session from merged model
        this.session = {
            sessionId: ack.sessionId,
            participants: [ack.from, this.context.agentId],
            mergedModel: ack.mergedModel,
            startedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            status: 'active',
            messageLog: [],
        };
        this.state = 'established';
        return this.session;
    }
    /**
     * Get current handshake state
     */
    getState() {
        return this.state;
    }
    /**
     * Get alignment result if available
     */
    getAlignment() {
        return this.alignment;
    }
    /**
     * Get active session if established
     */
    getSession() {
        return this.session;
    }
    /**
     * Create a RST (reset) message
     */
    createRst(to, reason, details) {
        return {
            type: 'RST',
            from: this.context.agentId,
            to,
            timestamp: new Date().toISOString(),
            reason,
            details,
        };
    }
    /**
     * Reset the handshake to idle state
     */
    reset() {
        this.state = 'idle';
        this.peerContext = undefined;
        this.alignment = undefined;
        this.session = undefined;
        this.sentSyn = undefined;
        this.receivedSyn = undefined;
        this.sentSynAck = undefined;
    }
}
/**
 * Quick handshake helper for simple cases
 */
export async function performHandshake(initiator, responder, config) {
    const initiatorHandshake = new ContextHandshake(initiator, config);
    const responderHandshake = new ContextHandshake(responder, config);
    // Phase 1: SYN
    const syn = initiatorHandshake.initiate();
    // Phase 2: SYN-ACK
    const synAckResult = responderHandshake.receiveSyn(syn);
    if (synAckResult.type === 'RST') {
        return { error: synAckResult.details || synAckResult.reason };
    }
    // Phase 3: ACK
    const ackResult = initiatorHandshake.receiveSynAck(synAckResult);
    if (ackResult.type === 'RST') {
        return { error: ackResult.details || ackResult.reason };
    }
    // Finalize on responder side
    responderHandshake.receiveAck(ackResult);
    const session = initiatorHandshake.getSession();
    const alignment = initiatorHandshake.getAlignment();
    if (!session || !alignment) {
        return { error: 'Handshake incomplete' };
    }
    return { session, alignment };
}
/**
 * Format handshake for logging/display
 */
export function formatHandshakeLog(syn, synAck, ack) {
    const lines = [
        '┌─── Context Handshake ───',
        `│ SYN from: ${syn.from}`,
        `│   Capabilities: ${syn.context.capabilities.join(', ')}`,
        `│   Confidence: ${(syn.context.mentalModel.confidenceLevel * 100).toFixed(0)}%`,
    ];
    if (synAck) {
        lines.push(`├─── SYN-ACK ───`, `│ From: ${synAck.from}`, `│ Alignment: ${(synAck.alignment.score * 100).toFixed(0)}%`, `│ Can collaborate: ${synAck.alignment.compatibilityFlags.canCollaborate}`, `│ Divergences: ${synAck.alignment.divergences.length}`);
    }
    if (ack) {
        lines.push(`├─── ACK ───`, `│ Session: ${ack.sessionId}`, `│ Lead: ${ack.mergedModel.roleAssignments.lead}`, `│ Support: ${ack.mergedModel.roleAssignments.support}`);
    }
    lines.push('└───────────────────────');
    return lines.join('\n');
}
