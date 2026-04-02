/**
 * Mental Model Merging
 *
 * Strategies for combining two agent's mental models into shared understanding
 */
import type { MentalModel, MergedModel, AlignmentResult } from './protocol';
/**
 * Merge two mental models based on alignment analysis
 */
export declare function mergeModels(initiator: MentalModel, responder: MentalModel, alignment: AlignmentResult): MergedModel;
/**
 * Update merged model with incremental context
 */
export declare function updateMergedModel(current: MergedModel, update: Partial<MentalModel>, source: 'lead' | 'support'): MergedModel;
