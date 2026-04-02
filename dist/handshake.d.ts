/**
 * Context Handshake State Machine
 *
 * Manages the three-phase handshake protocol
 */
import type { AgentContext, SynMessage, SynAckMessage, AckMessage, RstMessage, CollaborationSession, HandshakeConfig, AlignmentResult } from './protocol';
type HandshakeState = 'idle' | 'syn_sent' | 'syn_received' | 'established' | 'failed';
/**
 * Context Handshake Manager
 */
export declare class ContextHandshake {
    private state;
    private context;
    private config;
    private peerContext?;
    private alignment?;
    private session?;
    private sentSyn?;
    private receivedSyn?;
    private sentSynAck?;
    constructor(context: AgentContext, config?: Partial<HandshakeConfig>);
    /**
     * Initiate a handshake with another agent (send SYN)
     */
    initiate(): SynMessage;
    /**
     * Receive a SYN and generate SYN-ACK (responder side)
     */
    receiveSyn(syn: SynMessage): SynAckMessage | RstMessage;
    /**
     * Receive a SYN-ACK and complete handshake (send ACK)
     */
    receiveSynAck(synAck: SynAckMessage): AckMessage | RstMessage;
    /**
     * Receive ACK and finalize handshake (responder side)
     */
    receiveAck(ack: AckMessage): CollaborationSession;
    /**
     * Get current handshake state
     */
    getState(): HandshakeState;
    /**
     * Get alignment result if available
     */
    getAlignment(): AlignmentResult | undefined;
    /**
     * Get active session if established
     */
    getSession(): CollaborationSession | undefined;
    /**
     * Create a RST (reset) message
     */
    private createRst;
    /**
     * Reset the handshake to idle state
     */
    reset(): void;
}
/**
 * Quick handshake helper for simple cases
 */
export declare function performHandshake(initiator: AgentContext, responder: AgentContext, config?: Partial<HandshakeConfig>): Promise<{
    session: CollaborationSession;
    alignment: AlignmentResult;
} | {
    error: string;
}>;
/**
 * Format handshake for logging/display
 */
export declare function formatHandshakeLog(syn: SynMessage, synAck?: SynAckMessage, ack?: AckMessage): string;
export {};
