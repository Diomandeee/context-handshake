/**
 * Mental Model Alignment Scoring
 * 
 * Measures how well two agents' mental models match
 */

import type {
  MentalModel,
  AgentContext,
  AlignmentResult,
  Divergence,
  Resolution,
  CompatibilityFlags,
  Capability,
} from './protocol';

/**
 * Analyze alignment between two agent contexts
 */
export function analyzeAlignment(
  initiator: AgentContext,
  responder: AgentContext
): AlignmentResult {
  const conceptAlignment = alignConcepts(
    initiator.mentalModel,
    responder.mentalModel
  );

  const assumptionAlignment = alignAssumptions(
    initiator.mentalModel,
    responder.mentalModel
  );

  const goalAlignment = alignGoals(
    initiator.mentalModel,
    responder.mentalModel
  );

  const capabilityAlignment = alignCapabilities(
    initiator.capabilities,
    responder.capabilities
  );

  // Weighted overall score
  const score =
    conceptAlignment.score * 0.35 +
    assumptionAlignment.score * 0.25 +
    goalAlignment.score * 0.25 +
    capabilityAlignment.score * 0.15;

  // Collect all divergences
  const divergences: Divergence[] = [
    ...conceptAlignment.divergences,
    ...assumptionAlignment.divergences,
    ...goalAlignment.divergences,
  ];

  // Generate resolution proposals
  const proposedResolutions = generateResolutions(divergences);

  // Determine compatibility
  const compatibilityFlags = determineCompatibility(
    score,
    divergences,
    initiator,
    responder
  );

  return {
    score,
    matchedConcepts: conceptAlignment.matched,
    divergences,
    proposedResolutions,
    compatibilityFlags,
  };
}

interface SubAlignment {
  score: number;
  matched: string[];
  divergences: Divergence[];
}

/**
 * Align key concepts between models
 */
function alignConcepts(a: MentalModel, b: MentalModel): SubAlignment {
  const aConcepts = Object.keys(a.keyConcepts);
  const bConcepts = Object.keys(b.keyConcepts);

  const allConcepts = new Set([...aConcepts, ...bConcepts]);
  const matched: string[] = [];
  const divergences: Divergence[] = [];

  for (const concept of allConcepts) {
    const aHas = concept in a.keyConcepts;
    const bHas = concept in b.keyConcepts;

    if (aHas && bHas) {
      // Both have the concept - check if definitions match
      const aDef = a.keyConcepts[concept].definition.toLowerCase();
      const bDef = b.keyConcepts[concept].definition.toLowerCase();
      
      const similarity = calculateStringSimilarity(aDef, bDef);
      
      if (similarity > 0.6) {
        matched.push(concept);
      } else {
        divergences.push({
          conceptId: `concept:${concept}`,
          initiatorView: a.keyConcepts[concept].definition,
          responderView: b.keyConcepts[concept].definition,
          severity: similarity < 0.3 ? 'critical' : 'moderate',
        });
      }
    } else {
      // One is missing the concept
      divergences.push({
        conceptId: `concept:${concept}`,
        initiatorView: aHas ? a.keyConcepts[concept].definition : '(not defined)',
        responderView: bHas ? b.keyConcepts[concept].definition : '(not defined)',
        severity: 'minor',
      });
    }
  }

  const score = allConcepts.size > 0 ? matched.length / allConcepts.size : 1;
  return { score, matched, divergences };
}

/**
 * Align assumptions between models
 */
function alignAssumptions(a: MentalModel, b: MentalModel): SubAlignment {
  const aStmts = a.assumptions.map(x => x.statement.toLowerCase());
  const bStmts = b.assumptions.map(x => x.statement.toLowerCase());

  const matched: string[] = [];
  const divergences: Divergence[] = [];

  // Find matching assumptions (semantic similarity)
  for (const aStmt of aStmts) {
    let bestMatch = '';
    let bestScore = 0;

    for (const bStmt of bStmts) {
      const sim = calculateStringSimilarity(aStmt, bStmt);
      if (sim > bestScore) {
        bestScore = sim;
        bestMatch = bStmt;
      }
    }

    if (bestScore > 0.6) {
      matched.push(aStmt);
    } else if (bestScore > 0.3) {
      divergences.push({
        conceptId: `assumption:${aStmt.slice(0, 30)}`,
        initiatorView: aStmt,
        responderView: bestMatch || '(no similar assumption)',
        severity: 'moderate',
      });
    }
  }

  const totalAssumptions = new Set([...aStmts, ...bStmts]).size;
  const score = totalAssumptions > 0 ? matched.length / totalAssumptions : 1;
  return { score, matched, divergences };
}

/**
 * Align goals between models
 */
function alignGoals(a: MentalModel, b: MentalModel): SubAlignment {
  const aGoals = a.goals.filter(g => g.status === 'active').map(g => g.description.toLowerCase());
  const bGoals = b.goals.filter(g => g.status === 'active').map(g => g.description.toLowerCase());

  const matched: string[] = [];
  const divergences: Divergence[] = [];

  for (const aGoal of aGoals) {
    let found = false;
    for (const bGoal of bGoals) {
      if (calculateStringSimilarity(aGoal, bGoal) > 0.5) {
        matched.push(aGoal);
        found = true;
        break;
      }
    }
    
    if (!found && aGoals.length > 0) {
      divergences.push({
        conceptId: `goal:${aGoal.slice(0, 30)}`,
        initiatorView: aGoal,
        responderView: '(goal not shared)',
        severity: 'moderate',
      });
    }
  }

  const totalGoals = new Set([...aGoals, ...bGoals]).size;
  const score = totalGoals > 0 ? matched.length / Math.max(aGoals.length, bGoals.length) : 1;
  return { score, matched, divergences };
}

/**
 * Align capabilities between agents
 */
function alignCapabilities(a: Capability[], b: Capability[]): SubAlignment {
  const aSet = new Set(a);
  const bSet = new Set(b);
  
  const matched = a.filter(cap => bSet.has(cap));
  const complementary = [...new Set([...a.filter(cap => !bSet.has(cap)), ...b.filter(cap => !aSet.has(cap))])];

  // Higher score if capabilities complement each other
  const overlap = matched.length;
  const total = new Set([...a, ...b]).size;
  
  // Reward both overlap AND complementary capabilities
  const overlapScore = total > 0 ? overlap / total : 0;
  const complementScore = complementary.length > 0 ? Math.min(complementary.length / 4, 0.5) : 0;
  
  return {
    score: Math.min(1, overlapScore + complementScore),
    matched: matched as string[],
    divergences: [], // Capability differences aren't really "divergences"
  };
}

/**
 * Calculate string similarity using Jaccard index on word sets
 */
function calculateStringSimilarity(a: string, b: string): number {
  const aWords = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const bWords = new Set(b.split(/\s+/).filter(w => w.length > 2));

  if (aWords.size === 0 && bWords.size === 0) return 1;
  if (aWords.size === 0 || bWords.size === 0) return 0;

  let intersection = 0;
  for (const word of aWords) {
    if (bWords.has(word)) intersection++;
  }

  const union = new Set([...aWords, ...bWords]).size;
  return intersection / union;
}

/**
 * Generate resolution proposals for divergences
 */
function generateResolutions(divergences: Divergence[]): Resolution[] {
  return divergences.map(d => {
    // Choose strategy based on severity
    let strategy: Resolution['strategy'];
    let rationale: string;

    if (d.severity === 'critical') {
      strategy = 'defer';
      rationale = 'Critical divergence requires human review or explicit negotiation';
    } else if (d.responderView === '(not defined)') {
      strategy = 'adopt_initiator';
      rationale = 'Responder lacks this concept; adopt initiator\'s definition';
    } else if (d.initiatorView === '(not defined)') {
      strategy = 'adopt_responder';
      rationale = 'Initiator lacks this concept; adopt responder\'s definition';
    } else {
      strategy = 'merge';
      rationale = 'Both have perspectives; synthesize into unified view';
    }

    return {
      divergenceId: d.conceptId,
      strategy,
      rationale,
      mergedView: strategy === 'merge'
        ? `Synthesized: ${d.initiatorView.slice(0, 50)} + ${d.responderView.slice(0, 50)}`
        : undefined,
    };
  });
}

/**
 * Determine compatibility and suggest roles
 */
function determineCompatibility(
  score: number,
  divergences: Divergence[],
  initiator: AgentContext,
  responder: AgentContext
): CompatibilityFlags {
  const criticalDivergences = divergences.filter(d => d.severity === 'critical').length;

  const canCollaborate = score >= 0.3 && criticalDivergences < 3;
  const requiresNegotiation = score < 0.7 || criticalDivergences > 0;

  // Suggest lead based on confidence and capability breadth
  const initiatorScore = initiator.mentalModel.confidenceLevel * initiator.capabilities.length;
  const responderScore = responder.mentalModel.confidenceLevel * responder.capabilities.length;

  return {
    canCollaborate,
    requiresNegotiation,
    suggestedRoles: {
      lead: initiatorScore >= responderScore ? initiator.agentId : responder.agentId,
      support: initiatorScore < responderScore ? initiator.agentId : responder.agentId,
    },
  };
}

/**
 * Quick alignment score without full analysis
 */
export function quickAlignmentScore(a: MentalModel, b: MentalModel): number {
  // Just check task understanding similarity
  return calculateStringSimilarity(
    a.taskUnderstanding.toLowerCase(),
    b.taskUnderstanding.toLowerCase()
  );
}
