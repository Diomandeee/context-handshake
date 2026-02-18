/**
 * Collaboration Session Management
 * 
 * Manages active AI collaboration sessions after handshake
 */

import type {
  CollaborationSession,
  SessionMessage,
  MergedModel,
  FinMessage,
  CollaborationSummary,
} from './protocol';
import { updateMergedModel } from './merge';

/**
 * Active session wrapper with collaboration methods
 */
export class ActiveSession {
  private session: CollaborationSession;
  private myAgentId: string;
  private messageCounter: number = 0;

  constructor(session: CollaborationSession, myAgentId: string) {
    this.session = session;
    this.myAgentId = myAgentId;
  }

  /**
   * Get session ID
   */
  get id(): string {
    return this.session.sessionId;
  }

  /**
   * Get current merged model
   */
  get model(): MergedModel {
    return this.session.mergedModel;
  }

  /**
   * Check if I'm the lead agent
   */
  get isLead(): boolean {
    return this.session.mergedModel.roleAssignments.lead === this.myAgentId;
  }

  /**
   * Get peer agent ID
   */
  get peerId(): string {
    return this.session.participants.find(p => p !== this.myAgentId) || '';
  }

  /**
   * Add a message to the session log
   */
  addMessage(content: string, contextUpdates?: Partial<any>): SessionMessage {
    const message: SessionMessage = {
      id: `msg_${++this.messageCounter}`,
      from: this.myAgentId,
      timestamp: new Date().toISOString(),
      content,
      contextUpdates,
    };

    this.session.messageLog.push(message);
    this.session.lastActivity = message.timestamp;

    // Apply context updates to merged model if provided
    if (contextUpdates) {
      const role = this.isLead ? 'lead' : 'support';
      this.session.mergedModel = updateMergedModel(
        this.session.mergedModel,
        contextUpdates,
        role
      );
    }

    return message;
  }

  /**
   * Receive a message from peer
   */
  receiveMessage(message: SessionMessage): void {
    this.session.messageLog.push(message);
    this.session.lastActivity = message.timestamp;

    if (message.contextUpdates) {
      const role = message.from === this.session.mergedModel.roleAssignments.lead
        ? 'lead'
        : 'support';
      this.session.mergedModel = updateMergedModel(
        this.session.mergedModel,
        message.contextUpdates,
        role
      );
    }
  }

  /**
   * Get shared understanding summary
   */
  getSharedContext(): string {
    const model = this.session.mergedModel.sharedUnderstanding;
    const lines: string[] = [
      `📋 Task: ${model.taskUnderstanding}`,
      ``,
      `🎯 Active Goals:`,
      ...model.goals
        .filter(g => g.status === 'active')
        .map(g => `  - ${g.description}`),
      ``,
      `💡 Key Concepts:`,
      ...Object.entries(model.keyConcepts)
        .slice(0, 5)
        .map(([k, v]) => `  - ${v.name}: ${v.definition.slice(0, 60)}...`),
      ``,
      `🤝 Roles: Lead=${this.session.mergedModel.roleAssignments.lead}, Support=${this.session.mergedModel.roleAssignments.support}`,
    ];
    return lines.join('\n');
  }

  /**
   * Get message history
   */
  getHistory(limit?: number): SessionMessage[] {
    const messages = this.session.messageLog;
    return limit ? messages.slice(-limit) : messages;
  }

  /**
   * Mark a goal as achieved
   */
  achieveGoal(goalId: string): void {
    const goal = this.session.mergedModel.sharedUnderstanding.goals.find(
      g => g.id === goalId || g.description.includes(goalId)
    );
    if (goal) {
      goal.status = 'achieved';
    }
  }

  /**
   * End the collaboration session
   */
  end(lessonsLearned?: string[]): FinMessage {
    this.session.status = 'completed';

    const duration = Date.now() - new Date(this.session.startedAt).getTime();
    const goalsAchieved = this.session.mergedModel.sharedUnderstanding.goals
      .filter(g => g.status === 'achieved')
      .map(g => g.description);

    const summary: CollaborationSummary = {
      duration,
      messagesExchanged: this.session.messageLog.length,
      goalsAchieved,
      lessonsLearned: lessonsLearned || [],
      trustDelta: this.calculateTrustDelta(),
    };

    return {
      type: 'FIN',
      from: this.myAgentId,
      sessionId: this.session.sessionId,
      timestamp: new Date().toISOString(),
      summary,
    };
  }

  /**
   * Calculate trust change based on collaboration quality
   */
  private calculateTrustDelta(): number {
    const goals = this.session.mergedModel.sharedUnderstanding.goals;
    const achieved = goals.filter(g => g.status === 'achieved').length;
    const total = goals.length;

    if (total === 0) return 0;

    const achievementRate = achieved / total;
    const messageEngagement = Math.min(this.session.messageLog.length / 10, 1);

    // Trust increases with goal achievement and engagement
    return (achievementRate * 0.15 + messageEngagement * 0.05);
  }

  /**
   * Serialize session for storage
   */
  serialize(): string {
    return JSON.stringify(this.session, null, 2);
  }

  /**
   * Create session from serialized data
   */
  static deserialize(data: string, myAgentId: string): ActiveSession {
    const session = JSON.parse(data) as CollaborationSession;
    const active = new ActiveSession(session, myAgentId);
    active.messageCounter = session.messageLog.length;
    return active;
  }
}

/**
 * Session store for managing multiple active sessions
 */
export class SessionStore {
  private sessions: Map<string, ActiveSession> = new Map();
  private myAgentId: string;

  constructor(myAgentId: string) {
    this.myAgentId = myAgentId;
  }

  /**
   * Add a new session
   */
  add(session: CollaborationSession): ActiveSession {
    const active = new ActiveSession(session, this.myAgentId);
    this.sessions.set(session.sessionId, active);
    return active;
  }

  /**
   * Get session by ID
   */
  get(sessionId: string): ActiveSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActive(): ActiveSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.model.syncedAt // Still has valid model
    );
  }

  /**
   * Remove ended session
   */
  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Find session with specific peer
   */
  findByPeer(peerId: string): ActiveSession | undefined {
    return Array.from(this.sessions.values()).find(s => s.peerId === peerId);
  }
}

/**
 * Format session for display
 */
export function formatSession(session: ActiveSession): string {
  return [
    `═══════════════════════════════════════`,
    `📡 Collaboration Session: ${session.id}`,
    `═══════════════════════════════════════`,
    ``,
    session.getSharedContext(),
    ``,
    `📊 Messages: ${session.getHistory().length}`,
    `⏱️  Status: Active`,
    `═══════════════════════════════════════`,
  ].join('\n');
}
