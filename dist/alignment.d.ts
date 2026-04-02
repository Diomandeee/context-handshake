/**
 * Mental Model Alignment Scoring
 *
 * Measures how well two agents' mental models match
 */
import type { MentalModel, AgentContext, AlignmentResult } from './protocol';
/**
 * Analyze alignment between two agent contexts
 */
export declare function analyzeAlignment(initiator: AgentContext, responder: AgentContext): AlignmentResult;
/**
 * Quick alignment score without full analysis
 */
export declare function quickAlignmentScore(a: MentalModel, b: MentalModel): number;
