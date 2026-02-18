/**
 * Context Handshake: Negotiation Protocol
 * HEF Evolution: Gen 6, Instance 28
 * Task: task_20260201061347_9ebd38
 * 
 * When two AIs have low alignment, negotiation bridges the gap.
 * Instead of failing, agents can propose compromises, clarify assumptions,
 * and iteratively converge on shared understanding.
 */

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

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
  severity: number; // 0-1, how much this impacts collaboration
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
  alignmentThreshold: number; // Min alignment to consider converged
  roundTimeoutMs: number;
  allowDeferrals: boolean;
  criticalMustResolve: boolean; // Critical divergences must be resolved
  autoCompromiseThreshold: number; // Auto-merge if severity below this
}

// ─────────────────────────────────────────────────────────────────────
// Negotiation Strategies
// ─────────────────────────────────────────────────────────────────────

export type NegotiationStrategy = 
  | 'collaborative'   // Seek win-win, flexible
  | 'principled'      // Hold firm on core beliefs, flexible on details
  | 'adaptive'        // Mirror opponent's style
  | 'integrative';    // Find creative third options

export interface StrategyProfile {
  strategy: NegotiationStrategy;
  priorities: string[];           // Topics that can't be compromised
  flexibility: Map<string, number>; // Topic -> willingness to adjust (0-1)
  maxConcessions: number;         // How many positions can be yielded
}

// ─────────────────────────────────────────────────────────────────────
// Core Negotiation Engine
// ─────────────────────────────────────────────────────────────────────

export class NegotiationEngine {
  private config: NegotiationConfig;
  private strategyProfile: StrategyProfile;
  private activeSessions: Map<string, NegotiationSession> = new Map();

  constructor(config?: Partial<NegotiationConfig>, strategy?: Partial<StrategyProfile>) {
    this.config = {
      maxRounds: 5,
      alignmentThreshold: 0.75,
      roundTimeoutMs: 30000,
      allowDeferrals: true,
      criticalMustResolve: true,
      autoCompromiseThreshold: 0.2,
      ...config
    };

    this.strategyProfile = {
      strategy: 'collaborative',
      priorities: [],
      flexibility: new Map(),
      maxConcessions: 3,
      ...strategy
    };
  }

  /**
   * Initiate negotiation when handshake alignment is too low
   */
  initiateNegotiation(
    agentA: string,
    agentB: string,
    divergences: Divergence[],
    currentAlignment: number
  ): NegotiationSession {
    const session: NegotiationSession = {
      id: `neg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      initiator: agentA,
      responder: agentB,
      startTime: new Date(),
      divergences: [...divergences].sort((a, b) => b.severity - a.severity),
      rounds: [],
      status: 'active',
      finalAlignment: currentAlignment,
      compromises: []
    };

    this.activeSessions.set(session.id, session);
    return session;
  }

  /**
   * Generate proposals for divergences based on strategy
   */
  generateProposals(
    session: NegotiationSession,
    agentId: string,
    roundNumber: number
  ): NegotiationProposal[] {
    const proposals: NegotiationProposal[] = [];
    const unresolved = session.divergences.filter(d => 
      !session.compromises.some(c => c.original.concept === d.concept)
    );

    for (const divergence of unresolved) {
      // Skip if already at max proposals for this round
      if (proposals.length >= 3) break;

      const proposal = this.createProposal(divergence, agentId, roundNumber);
      proposals.push(proposal);
    }

    return proposals;
  }

  private createProposal(
    divergence: Divergence,
    agentId: string,
    roundNumber: number
  ): NegotiationProposal {
    const flexibility = this.strategyProfile.flexibility.get(divergence.concept) ?? 0.5;
    const isPriority = this.strategyProfile.priorities.includes(divergence.concept);

    // Determine proposal type based on strategy and flexibility
    let type: NegotiationProposal['type'] = 'compromise';
    let proposedResolution: unknown;

    if (isPriority) {
      // Hold firm on priorities - assert position but explain why
      type = 'assertion';
      proposedResolution = divergence.agentAView;
    } else if (divergence.category === 'definition') {
      // Definitions need clarification first
      type = 'clarification';
      proposedResolution = undefined;
    } else if (flexibility > 0.7) {
      // High flexibility - propose accepting other's view
      type = 'compromise';
      proposedResolution = divergence.agentBView;
    } else if (flexibility > 0.3) {
      // Medium flexibility - try to merge views
      type = 'compromise';
      proposedResolution = this.attemptMerge(divergence);
    } else {
      // Low flexibility - ask questions to understand
      type = 'question';
    }

    return {
      id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from: agentId,
      type,
      topic: divergence.concept,
      content: {
        myPosition: divergence.agentAView,
        proposedResolution,
        priority: isPriority ? 'critical' : this.severityToPriority(divergence.severity),
        rationale: this.generateRationale(divergence, type)
      },
      timestamp: new Date()
    };
  }

  private attemptMerge(divergence: Divergence): unknown {
    const a = divergence.agentAView;
    const b = divergence.agentBView;

    // If both are objects, try to merge properties
    if (typeof a === 'object' && typeof b === 'object' && a && b) {
      return { ...a as object, ...b as object };
    }

    // If both are arrays, combine unique elements
    if (Array.isArray(a) && Array.isArray(b)) {
      return [...new Set([...a, ...b])];
    }

    // If numbers, take average (for things like thresholds)
    if (typeof a === 'number' && typeof b === 'number') {
      return (a + b) / 2;
    }

    // Default: prefer my position but note it's tentative
    return { tentative: a, alternative: b };
  }

  private severityToPriority(severity: number): 'critical' | 'high' | 'medium' | 'low' {
    if (severity >= 0.8) return 'critical';
    if (severity >= 0.6) return 'high';
    if (severity >= 0.3) return 'medium';
    return 'low';
  }

  private generateRationale(divergence: Divergence, type: string): string {
    switch (type) {
      case 'clarification':
        return `Need to align on the definition of "${divergence.concept}" before proceeding.`;
      case 'compromise':
        return `Proposing a middle ground that incorporates both perspectives on "${divergence.concept}".`;
      case 'assertion':
        return `This is a core assumption for my task understanding. Here's why it matters: "${divergence.concept}".`;
      case 'question':
        return `Would like to understand the reasoning behind your position on "${divergence.concept}".`;
      default:
        return `Addressing divergence on "${divergence.concept}".`;
    }
  }

  /**
   * Evaluate and respond to incoming proposals
   */
  evaluateProposal(
    proposal: NegotiationProposal,
    myView: unknown
  ): NegotiationResponse {
    const flexibility = this.strategyProfile.flexibility.get(proposal.topic) ?? 0.5;
    const isPriority = this.strategyProfile.priorities.includes(proposal.topic);

    // Calculate how different the proposed resolution is from my view
    const divergenceScore = this.calculateDivergence(
      myView, 
      proposal.content.proposedResolution
    );

    let decision: NegotiationResponse['decision'];
    let counterProposal: NegotiationProposal | undefined;
    let reasoning: string;

    if (proposal.type === 'clarification' || proposal.type === 'question') {
      // Always respond to questions
      decision = 'accept';
      reasoning = 'Providing clarification as requested.';
    } else if (isPriority && divergenceScore > 0.3) {
      // Priority topic with significant divergence - counter
      decision = 'counter';
      counterProposal = this.createCounterProposal(proposal, myView);
      reasoning = 'This is a priority topic; proposing alternative resolution.';
    } else if (flexibility > 0.7 || divergenceScore < 0.2) {
      // High flexibility or small divergence - accept
      decision = 'accept';
      reasoning = divergenceScore < 0.2 
        ? 'Proposed resolution aligns closely with my understanding.'
        : 'Willing to adopt this position for collaboration.';
    } else if (this.config.allowDeferrals && proposal.content.priority === 'low') {
      // Low priority item - defer for now
      decision = 'defer';
      reasoning = 'Can proceed without resolving; will revisit if needed.';
    } else if (flexibility > 0.3) {
      // Moderate flexibility - counter with alternative
      decision = 'counter';
      counterProposal = this.createCounterProposal(proposal, myView);
      reasoning = 'Proposing alternative that balances both perspectives.';
    } else {
      // Low flexibility - reject
      decision = 'reject';
      reasoning = 'Cannot accept this resolution; fundamental to my task model.';
    }

    return {
      proposalId: proposal.id,
      from: 'self', // Would be replaced with actual agent ID
      decision,
      counterProposal,
      reasoning,
      newAlignment: decision === 'accept' ? 0.05 : 0 // Alignment boost
    };
  }

  private calculateDivergence(a: unknown, b: unknown): number {
    if (a === b) return 0;
    if (a === undefined || b === undefined) return 0.5;

    // Deep comparison for objects
    if (typeof a === 'object' && typeof b === 'object') {
      const aStr = JSON.stringify(a);
      const bStr = JSON.stringify(b);
      if (aStr === bStr) return 0;
      
      // Rough similarity based on length difference
      const lenDiff = Math.abs(aStr.length - bStr.length);
      const maxLen = Math.max(aStr.length, bStr.length);
      return Math.min(1, lenDiff / maxLen);
    }

    // Numbers - normalize difference
    if (typeof a === 'number' && typeof b === 'number') {
      const max = Math.max(Math.abs(a), Math.abs(b), 1);
      return Math.min(1, Math.abs(a - b) / max);
    }

    // Strings - Jaccard similarity
    if (typeof a === 'string' && typeof b === 'string') {
      const setA = new Set(a.toLowerCase().split(/\s+/));
      const setB = new Set(b.toLowerCase().split(/\s+/));
      const intersection = [...setA].filter(x => setB.has(x)).length;
      const union = new Set([...setA, ...setB]).size;
      return 1 - (intersection / union);
    }

    return 1; // Completely different types
  }

  private createCounterProposal(
    original: NegotiationProposal,
    myView: unknown
  ): NegotiationProposal {
    return {
      id: `counter_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from: 'self',
      type: 'compromise',
      topic: original.topic,
      content: {
        myPosition: myView,
        proposedResolution: this.attemptMerge({
          concept: original.topic,
          agentAView: myView,
          agentBView: original.content.proposedResolution,
          severity: 0.5,
          category: 'assumption'
        }),
        priority: original.content.priority,
        rationale: 'Counter-proposal seeking middle ground.'
      },
      timestamp: new Date()
    };
  }

  /**
   * Execute a negotiation round
   */
  executeRound(session: NegotiationSession): NegotiationRound {
    const roundNumber = session.rounds.length + 1;
    const alignmentBefore = session.finalAlignment;

    // Generate proposals for this round
    const proposals = this.generateProposals(session, session.initiator, roundNumber);
    const responses: NegotiationResponse[] = [];

    // Simulate responses (in real use, these would come from the other agent)
    for (const proposal of proposals) {
      // Find the divergence this proposal addresses
      const divergence = session.divergences.find(d => d.concept === proposal.topic);
      if (divergence) {
        const response = this.evaluateProposal(proposal, divergence.agentBView);
        responses.push(response);

        // If accepted, record the resolution
        if (response.decision === 'accept') {
          session.compromises.push({
            original: divergence,
            resolution: 'merged',
            resolvedValue: proposal.content.proposedResolution,
            round: roundNumber
          });
        }
      }
    }

    // Calculate new alignment after this round
    const alignmentBoost = responses
      .filter(r => r.decision === 'accept')
      .reduce((sum, r) => sum + (r.newAlignment || 0), 0);
    
    const alignmentAfter = Math.min(1, alignmentBefore + alignmentBoost);
    session.finalAlignment = alignmentAfter;

    const round: NegotiationRound = {
      number: roundNumber,
      proposals,
      responses,
      alignmentBefore,
      alignmentAfter,
      timestamp: new Date()
    };

    session.rounds.push(round);

    // Check if we've converged
    if (alignmentAfter >= this.config.alignmentThreshold) {
      session.status = 'converged';
      session.endTime = new Date();
    } else if (roundNumber >= this.config.maxRounds) {
      session.status = 'failed';
      session.endTime = new Date();
    }

    return round;
  }

  /**
   * Run full negotiation until convergence or failure
   */
  async negotiate(session: NegotiationSession): Promise<NegotiationSession> {
    while (session.status === 'active') {
      this.executeRound(session);
      
      // Small delay between rounds for async scenarios
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return session;
  }

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
  } {
    const unresolvedCount = session.divergences.length - session.compromises.length;
    
    return {
      success: session.status === 'converged',
      finalAlignment: session.finalAlignment,
      rounds: session.rounds.length,
      resolvedCount: session.compromises.length,
      unresolvedCount,
      compromises: session.compromises.map(c => 
        `${c.original.concept}: ${c.resolution}`
      )
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Handshake Integration
// ─────────────────────────────────────────────────────────────────────

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
export async function handshakeWithNegotiation(
  agentA: string,
  agentB: string,
  contextA: Record<string, unknown>,
  contextB: Record<string, unknown>,
  alignmentThreshold: number = 0.7
): Promise<HandshakeWithNegotiation> {
  // Calculate initial alignment
  const initialAlignment = calculateContextAlignment(contextA, contextB);
  
  const result: HandshakeWithNegotiation = {
    handshakeId: `hs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    initialAlignment,
    negotiationRequired: initialAlignment < alignmentThreshold,
    finalAlignment: initialAlignment,
    status: initialAlignment >= alignmentThreshold ? 'synced' : 'partial'
  };

  // If alignment is good, we're done
  if (!result.negotiationRequired) {
    result.status = 'synced';
    return result;
  }

  // Find divergences
  const divergences = findDivergences(contextA, contextB);

  // Initiate negotiation
  const engine = new NegotiationEngine({
    alignmentThreshold,
    maxRounds: 5
  });

  const session = engine.initiateNegotiation(
    agentA,
    agentB,
    divergences,
    initialAlignment
  );

  // Run negotiation
  await engine.negotiate(session);
  
  result.negotiation = session;
  result.finalAlignment = session.finalAlignment;
  result.status = session.status === 'converged' ? 'negotiated' : 
                  session.finalAlignment > initialAlignment ? 'partial' : 'failed';

  return result;
}

function calculateContextAlignment(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): number {
  const keysA = new Set(Object.keys(a));
  const keysB = new Set(Object.keys(b));
  
  // Key overlap
  const intersection = [...keysA].filter(k => keysB.has(k));
  const keyOverlap = intersection.length / Math.max(keysA.size, keysB.size);
  
  // Value similarity for shared keys
  let valueMatch = 0;
  for (const key of intersection) {
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) {
      valueMatch++;
    }
  }
  const valueSimilarity = intersection.length > 0 
    ? valueMatch / intersection.length 
    : 0;

  return (keyOverlap * 0.4) + (valueSimilarity * 0.6);
}

function findDivergences(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): Divergence[] {
  const divergences: Divergence[] = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const inA = key in a;
    const inB = key in b;

    if (inA && inB) {
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
        divergences.push({
          concept: key,
          agentAView: a[key],
          agentBView: b[key],
          severity: 0.5, // Could be refined with semantic analysis
          category: 'assumption'
        });
      }
    } else if (inA || inB) {
      divergences.push({
        concept: key,
        agentAView: a[key],
        agentBView: b[key],
        severity: 0.3, // Missing is less severe than conflicting
        category: 'assumption'
      });
    }
  }

  return divergences;
}

// ─────────────────────────────────────────────────────────────────────
// Demo
// ─────────────────────────────────────────────────────────────────────

export async function demo() {
  console.log('🤝 Context Handshake: Negotiation Protocol Demo\n');
  console.log('━'.repeat(50));

  // Two agents with different mental models
  const agentAContext = {
    task: 'Build a REST API',
    framework: 'Express.js',
    database: 'PostgreSQL',
    auth: 'JWT',
    style: 'RESTful',
    testing: 'Jest'
  };

  const agentBContext = {
    task: 'Build an API',
    framework: 'Fastify',
    database: 'PostgreSQL',
    auth: 'OAuth2',
    documentation: 'OpenAPI'
  };

  console.log('\n📤 Agent A Context:', JSON.stringify(agentAContext, null, 2));
  console.log('\n📥 Agent B Context:', JSON.stringify(agentBContext, null, 2));

  const result = await handshakeWithNegotiation(
    'agent-a',
    'agent-b',
    agentAContext,
    agentBContext,
    0.7
  );

  console.log('\n' + '━'.repeat(50));
  console.log('📊 HANDSHAKE RESULT\n');
  console.log(`  Handshake ID: ${result.handshakeId}`);
  console.log(`  Initial Alignment: ${(result.initialAlignment * 100).toFixed(1)}%`);
  console.log(`  Negotiation Required: ${result.negotiationRequired ? '✅ Yes' : '❌ No'}`);
  console.log(`  Final Alignment: ${(result.finalAlignment * 100).toFixed(1)}%`);
  console.log(`  Status: ${result.status.toUpperCase()}`);

  if (result.negotiation) {
    console.log('\n📝 NEGOTIATION DETAILS');
    console.log(`  Rounds: ${result.negotiation.rounds.length}`);
    console.log(`  Divergences Found: ${result.negotiation.divergences.length}`);
    console.log(`  Resolved: ${result.negotiation.compromises.length}`);
    
    console.log('\n  Compromises:');
    for (const c of result.negotiation.compromises) {
      console.log(`    • ${c.original.concept}: ${c.resolution}`);
    }
  }

  console.log('\n' + '━'.repeat(50));
  console.log('✨ Agents are now synchronized and ready to collaborate!\n');
}

// Run demo if executed directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/^file:\/\//, '') || '')) {
  demo();
}
