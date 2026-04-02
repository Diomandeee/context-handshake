/**
 * Collaboration Session Management
 *
 * Manages active AI collaboration sessions after handshake
 */
import type { CollaborationSession, SessionMessage, MergedModel, FinMessage } from './protocol';
/**
 * Active session wrapper with collaboration methods
 */
export declare class ActiveSession {
    private session;
    private myAgentId;
    private messageCounter;
    constructor(session: CollaborationSession, myAgentId: string);
    /**
     * Get session ID
     */
    get id(): string;
    /**
     * Get current merged model
     */
    get model(): MergedModel;
    /**
     * Check if I'm the lead agent
     */
    get isLead(): boolean;
    /**
     * Get peer agent ID
     */
    get peerId(): string;
    /**
     * Add a message to the session log
     */
    addMessage(content: string, contextUpdates?: Partial<any>): SessionMessage;
    /**
     * Receive a message from peer
     */
    receiveMessage(message: SessionMessage): void;
    /**
     * Get shared understanding summary
     */
    getSharedContext(): string;
    /**
     * Get message history
     */
    getHistory(limit?: number): SessionMessage[];
    /**
     * Mark a goal as achieved
     */
    achieveGoal(goalId: string): void;
    /**
     * End the collaboration session
     */
    end(lessonsLearned?: string[]): FinMessage;
    /**
     * Calculate trust change based on collaboration quality
     */
    private calculateTrustDelta;
    /**
     * Serialize session for storage
     */
    serialize(): string;
    /**
     * Create session from serialized data
     */
    static deserialize(data: string, myAgentId: string): ActiveSession;
}
/**
 * Session store for managing multiple active sessions
 */
export declare class SessionStore {
    private sessions;
    private myAgentId;
    constructor(myAgentId: string);
    /**
     * Add a new session
     */
    add(session: CollaborationSession): ActiveSession;
    /**
     * Get session by ID
     */
    get(sessionId: string): ActiveSession | undefined;
    /**
     * Get all active sessions
     */
    getActive(): ActiveSession[];
    /**
     * Remove ended session
     */
    remove(sessionId: string): void;
    /**
     * Find session with specific peer
     */
    findByPeer(peerId: string): ActiveSession | undefined;
}
/**
 * Format session for display
 */
export declare function formatSession(session: ActiveSession): string;
