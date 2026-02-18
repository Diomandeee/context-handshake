/**
 * Context Versioning - Git-like Mental Model History
 * 
 * HEF Evolution Task: task_20260201230448_e66942
 * Instance: 28 | Generation: 6 | Priority: 1
 * 
 * Concept: Mental models evolve during collaboration. Like Git tracks code
 * changes, this tracks understanding changes - enabling rollback, branching,
 * and conflict-aware merging.
 * 
 * TCP Analogy: Sequence numbers ensure ordered delivery; this ensures
 * ordered understanding with the ability to rewind and replay.
 */

import { createHash } from 'crypto';

// ============================================================================
// Core Types
// ============================================================================

/**
 * A snapshot of mental model state at a point in time
 */
export interface ContextCommit {
  id: string;                    // SHA of content
  parentIds: string[];           // Previous commits (0 for root, 2 for merge)
  timestamp: number;
  author: string;                // Agent ID
  
  // Content
  concepts: Map<string, ConceptVersion>;
  beliefs: Map<string, BeliefVersion>;
  understanding: Map<string, number>;  // Topic → confidence
  
  // Metadata
  message: string;
  tags: string[];
  signature?: string;            // Author's cryptographic signature
}

/**
 * Versioned concept with semantic tracking
 */
export interface ConceptVersion {
  name: string;
  definition: string;
  semanticVector: number[];      // Embedding for semantic comparison
  examples: string[];
  relations: Map<string, string>; // conceptId → relation type
  confidence: number;
  source: 'learned' | 'inferred' | 'received' | 'merged';
}

/**
 * Versioned belief with provenance
 */
export interface BeliefVersion {
  statement: string;
  confidence: number;
  evidence: string[];
  derivedFrom: string[];         // Commit IDs where evidence originated
  challenges: string[];          // Counter-evidence
}

/**
 * Branch pointer for tracking parallel understanding
 */
export interface ContextBranch {
  name: string;
  head: string;                  // Commit ID
  upstream?: string;             // Parent branch
  protected: boolean;            // Prevent force updates
  createdAt: number;
  updatedAt: number;
}

/**
 * Diff between two context states
 */
export interface ContextDiff {
  fromCommit: string;
  toCommit: string;
  
  concepts: {
    added: Map<string, ConceptVersion>;
    removed: Set<string>;
    modified: Map<string, { before: ConceptVersion; after: ConceptVersion; similarity: number }>;
  };
  
  beliefs: {
    added: Map<string, BeliefVersion>;
    removed: Set<string>;
    modified: Map<string, { before: BeliefVersion; after: BeliefVersion; strengthened: boolean }>;
  };
  
  understanding: {
    increased: Map<string, { from: number; to: number }>;
    decreased: Map<string, { from: number; to: number }>;
    newTopics: Map<string, number>;
    forgottenTopics: Set<string>;
  };
  
  stats: {
    additions: number;
    deletions: number;
    modifications: number;
    semanticShift: number;       // Overall semantic distance
  };
}

/**
 * Merge conflict for manual resolution
 */
export interface MergeConflict {
  type: 'concept' | 'belief' | 'understanding';
  key: string;
  ours: any;
  theirs: any;
  base?: any;                    // Common ancestor value
  autoResolution?: any;          // AI-suggested resolution
  confidence: number;            // Confidence in auto-resolution
}

/**
 * Result of attempting a merge
 */
export interface MergeResult {
  success: boolean;
  commit?: ContextCommit;
  conflicts: MergeConflict[];
  strategy: MergeStrategy;
  stats: {
    autoMerged: number;
    conflicted: number;
    fastForward: boolean;
  };
}

/**
 * Strategies for automatic merge resolution
 */
export type MergeStrategy = 
  | 'ours'           // Always prefer local
  | 'theirs'         // Always prefer remote
  | 'union'          // Combine both
  | 'confidence'     // Prefer higher confidence
  | 'recency'        // Prefer more recent
  | 'semantic'       // Use semantic similarity to base
  | 'manual';        // Always ask

// ============================================================================
// Context Repository
// ============================================================================

export class ContextRepository {
  private commits: Map<string, ContextCommit> = new Map();
  private branches: Map<string, ContextBranch> = new Map();
  private tags: Map<string, string> = new Map();  // Tag name → commit ID
  private currentBranch: string = 'main';
  private workingState: Partial<ContextCommit>;
  
  private agentId: string;
  private defaultStrategy: MergeStrategy = 'confidence';
  
  constructor(agentId: string) {
    this.agentId = agentId;
    this.workingState = {
      concepts: new Map(),
      beliefs: new Map(),
      understanding: new Map()
    };
    
    // Initialize main branch with empty root
    this.initializeRepository();
  }
  
  private initializeRepository(): void {
    const rootCommit: ContextCommit = {
      id: this.computeCommitId({
        concepts: new Map(),
        beliefs: new Map(),
        understanding: new Map()
      }),
      parentIds: [],
      timestamp: Date.now(),
      author: this.agentId,
      concepts: new Map(),
      beliefs: new Map(),
      understanding: new Map(),
      message: 'Initial context',
      tags: ['root']
    };
    
    this.commits.set(rootCommit.id, rootCommit);
    
    this.branches.set('main', {
      name: 'main',
      head: rootCommit.id,
      protected: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
  
  // --------------------------------------------------------------------------
  // Commit Operations
  // --------------------------------------------------------------------------
  
  /**
   * Stage a concept change
   */
  stageConcept(name: string, concept: ConceptVersion): void {
    this.workingState.concepts!.set(name, concept);
  }
  
  /**
   * Stage a belief change
   */
  stageBelief(statement: string, belief: BeliefVersion): void {
    this.workingState.beliefs!.set(statement, belief);
  }
  
  /**
   * Stage understanding change
   */
  stageUnderstanding(topic: string, confidence: number): void {
    this.workingState.understanding!.set(topic, Math.max(0, Math.min(1, confidence)));
  }
  
  /**
   * Create a new commit from staged changes
   */
  commit(message: string, tags: string[] = []): ContextCommit {
    const currentHead = this.getHead();
    
    // Merge staged changes with current state
    const newConcepts = new Map([
      ...currentHead.concepts,
      ...this.workingState.concepts!
    ]);
    
    const newBeliefs = new Map([
      ...currentHead.beliefs,
      ...this.workingState.beliefs!
    ]);
    
    const newUnderstanding = new Map([
      ...currentHead.understanding,
      ...this.workingState.understanding!
    ]);
    
    const commit: ContextCommit = {
      id: this.computeCommitId({
        concepts: newConcepts,
        beliefs: newBeliefs,
        understanding: newUnderstanding
      }),
      parentIds: [currentHead.id],
      timestamp: Date.now(),
      author: this.agentId,
      concepts: newConcepts,
      beliefs: newBeliefs,
      understanding: newUnderstanding,
      message,
      tags
    };
    
    this.commits.set(commit.id, commit);
    this.updateBranchHead(this.currentBranch, commit.id);
    
    // Clear staging area
    this.workingState = {
      concepts: new Map(),
      beliefs: new Map(),
      understanding: new Map()
    };
    
    return commit;
  }
  
  /**
   * Get current HEAD commit
   */
  getHead(): ContextCommit {
    const branch = this.branches.get(this.currentBranch)!;
    return this.commits.get(branch.head)!;
  }
  
  /**
   * Get commit by ID (short or full)
   */
  getCommit(id: string): ContextCommit | undefined {
    // Try exact match
    if (this.commits.has(id)) {
      return this.commits.get(id);
    }
    
    // Try short hash (like git)
    for (const [fullId, commit] of this.commits) {
      if (fullId.startsWith(id)) {
        return commit;
      }
    }
    
    return undefined;
  }
  
  // --------------------------------------------------------------------------
  // Branch Operations
  // --------------------------------------------------------------------------
  
  /**
   * Create a new branch at current HEAD
   */
  createBranch(name: string, fromCommit?: string): ContextBranch {
    if (this.branches.has(name)) {
      throw new Error(`Branch '${name}' already exists`);
    }
    
    const head = fromCommit || this.getHead().id;
    
    const branch: ContextBranch = {
      name,
      head,
      upstream: this.currentBranch,
      protected: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.branches.set(name, branch);
    return branch;
  }
  
  /**
   * Switch to a different branch
   */
  checkout(branchName: string): void {
    if (!this.branches.has(branchName)) {
      throw new Error(`Branch '${branchName}' not found`);
    }
    
    this.currentBranch = branchName;
    
    // Clear uncommitted changes
    this.workingState = {
      concepts: new Map(),
      beliefs: new Map(),
      understanding: new Map()
    };
  }
  
  /**
   * Delete a branch
   */
  deleteBranch(name: string): boolean {
    const branch = this.branches.get(name);
    if (!branch) return false;
    if (branch.protected) {
      throw new Error(`Cannot delete protected branch '${name}'`);
    }
    if (name === this.currentBranch) {
      throw new Error('Cannot delete current branch');
    }
    
    return this.branches.delete(name);
  }
  
  private updateBranchHead(branchName: string, commitId: string): void {
    const branch = this.branches.get(branchName)!;
    branch.head = commitId;
    branch.updatedAt = Date.now();
  }
  
  // --------------------------------------------------------------------------
  // Diff Operations
  // --------------------------------------------------------------------------
  
  /**
   * Compute diff between two commits
   */
  diff(fromCommitId: string, toCommitId: string): ContextDiff {
    const from = this.getCommit(fromCommitId);
    const to = this.getCommit(toCommitId);
    
    if (!from || !to) {
      throw new Error('Commit not found');
    }
    
    const diff: ContextDiff = {
      fromCommit: fromCommitId,
      toCommit: toCommitId,
      concepts: { added: new Map(), removed: new Set(), modified: new Map() },
      beliefs: { added: new Map(), removed: new Set(), modified: new Map() },
      understanding: { increased: new Map(), decreased: new Map(), newTopics: new Map(), forgottenTopics: new Set() },
      stats: { additions: 0, deletions: 0, modifications: 0, semanticShift: 0 }
    };
    
    // Diff concepts
    for (const [name, concept] of to.concepts) {
      if (!from.concepts.has(name)) {
        diff.concepts.added.set(name, concept);
        diff.stats.additions++;
      } else {
        const before = from.concepts.get(name)!;
        const similarity = this.computeConceptSimilarity(before, concept);
        if (similarity < 0.99) {
          diff.concepts.modified.set(name, { before, after: concept, similarity });
          diff.stats.modifications++;
        }
      }
    }
    
    for (const name of from.concepts.keys()) {
      if (!to.concepts.has(name)) {
        diff.concepts.removed.add(name);
        diff.stats.deletions++;
      }
    }
    
    // Diff beliefs
    for (const [statement, belief] of to.beliefs) {
      if (!from.beliefs.has(statement)) {
        diff.beliefs.added.set(statement, belief);
        diff.stats.additions++;
      } else {
        const before = from.beliefs.get(statement)!;
        if (Math.abs(before.confidence - belief.confidence) > 0.01 ||
            before.evidence.length !== belief.evidence.length) {
          const strengthened = belief.confidence > before.confidence;
          diff.beliefs.modified.set(statement, { before, after: belief, strengthened });
          diff.stats.modifications++;
        }
      }
    }
    
    for (const statement of from.beliefs.keys()) {
      if (!to.beliefs.has(statement)) {
        diff.beliefs.removed.add(statement);
        diff.stats.deletions++;
      }
    }
    
    // Diff understanding
    for (const [topic, confidence] of to.understanding) {
      if (!from.understanding.has(topic)) {
        diff.understanding.newTopics.set(topic, confidence);
        diff.stats.additions++;
      } else {
        const before = from.understanding.get(topic)!;
        if (confidence > before) {
          diff.understanding.increased.set(topic, { from: before, to: confidence });
        } else if (confidence < before) {
          diff.understanding.decreased.set(topic, { from: before, to: confidence });
        }
      }
    }
    
    for (const topic of from.understanding.keys()) {
      if (!to.understanding.has(topic)) {
        diff.understanding.forgottenTopics.add(topic);
        diff.stats.deletions++;
      }
    }
    
    // Compute overall semantic shift
    diff.stats.semanticShift = this.computeOverallShift(diff);
    
    return diff;
  }
  
  private computeConceptSimilarity(a: ConceptVersion, b: ConceptVersion): number {
    if (a.semanticVector.length === 0 || b.semanticVector.length === 0) {
      return a.definition === b.definition ? 1 : 0;
    }
    
    // Cosine similarity
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.semanticVector.length; i++) {
      dotProduct += a.semanticVector[i] * b.semanticVector[i];
      normA += a.semanticVector[i] ** 2;
      normB += b.semanticVector[i] ** 2;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  private computeOverallShift(diff: ContextDiff): number {
    const changes = diff.stats.additions + diff.stats.deletions + diff.stats.modifications;
    const total = changes + diff.concepts.modified.size;
    
    if (total === 0) return 0;
    
    // Weight by modification severity
    let semanticChange = 0;
    for (const mod of diff.concepts.modified.values()) {
      semanticChange += (1 - mod.similarity);
    }
    
    return Math.min(1, (changes * 0.1 + semanticChange) / Math.max(1, total));
  }
  
  // --------------------------------------------------------------------------
  // Merge Operations
  // --------------------------------------------------------------------------
  
  /**
   * Merge another branch into current branch
   */
  merge(
    sourceBranch: string,
    strategy: MergeStrategy = this.defaultStrategy,
    message?: string
  ): MergeResult {
    const source = this.branches.get(sourceBranch);
    if (!source) {
      throw new Error(`Branch '${sourceBranch}' not found`);
    }
    
    const current = this.getHead();
    const sourceCommit = this.commits.get(source.head)!;
    
    // Find merge base (common ancestor)
    const base = this.findMergeBase(current.id, sourceCommit.id);
    
    // Check for fast-forward
    if (this.isAncestor(current.id, sourceCommit.id)) {
      // Fast-forward: just move branch pointer
      this.updateBranchHead(this.currentBranch, sourceCommit.id);
      return {
        success: true,
        commit: sourceCommit,
        conflicts: [],
        strategy,
        stats: { autoMerged: 0, conflicted: 0, fastForward: true }
      };
    }
    
    // Full merge required
    const conflicts: MergeConflict[] = [];
    const mergedConcepts = new Map<string, ConceptVersion>();
    const mergedBeliefs = new Map<string, BeliefVersion>();
    const mergedUnderstanding = new Map<string, number>();
    
    // Merge concepts
    const allConceptKeys = new Set([
      ...current.concepts.keys(),
      ...sourceCommit.concepts.keys()
    ]);
    
    for (const key of allConceptKeys) {
      const ours = current.concepts.get(key);
      const theirs = sourceCommit.concepts.get(key);
      const baseValue = base?.concepts.get(key);
      
      const result = this.mergeValue('concept', key, ours, theirs, baseValue, strategy);
      
      if (result.conflict) {
        conflicts.push(result.conflict);
        if (result.value) {
          mergedConcepts.set(key, result.value);
        }
      } else if (result.value) {
        mergedConcepts.set(key, result.value);
      }
    }
    
    // Merge beliefs
    const allBeliefKeys = new Set([
      ...current.beliefs.keys(),
      ...sourceCommit.beliefs.keys()
    ]);
    
    for (const key of allBeliefKeys) {
      const ours = current.beliefs.get(key);
      const theirs = sourceCommit.beliefs.get(key);
      const baseValue = base?.beliefs.get(key);
      
      const result = this.mergeValue('belief', key, ours, theirs, baseValue, strategy);
      
      if (result.conflict) {
        conflicts.push(result.conflict);
        if (result.value) {
          mergedBeliefs.set(key, result.value);
        }
      } else if (result.value) {
        mergedBeliefs.set(key, result.value);
      }
    }
    
    // Merge understanding
    const allTopics = new Set([
      ...current.understanding.keys(),
      ...sourceCommit.understanding.keys()
    ]);
    
    for (const topic of allTopics) {
      const ours = current.understanding.get(topic);
      const theirs = sourceCommit.understanding.get(topic);
      const baseValue = base?.understanding.get(topic);
      
      const result = this.mergeValue('understanding', topic, ours, theirs, baseValue, strategy);
      
      if (result.conflict) {
        conflicts.push(result.conflict);
        if (result.value !== undefined) {
          mergedUnderstanding.set(topic, result.value);
        }
      } else if (result.value !== undefined) {
        mergedUnderstanding.set(topic, result.value);
      }
    }
    
    // If no conflicts (or all auto-resolved), create merge commit
    if (conflicts.length === 0 || conflicts.every(c => c.autoResolution !== undefined)) {
      const mergeCommit: ContextCommit = {
        id: this.computeCommitId({
          concepts: mergedConcepts,
          beliefs: mergedBeliefs,
          understanding: mergedUnderstanding
        }),
        parentIds: [current.id, sourceCommit.id],
        timestamp: Date.now(),
        author: this.agentId,
        concepts: mergedConcepts,
        beliefs: mergedBeliefs,
        understanding: mergedUnderstanding,
        message: message || `Merge branch '${sourceBranch}' into ${this.currentBranch}`,
        tags: ['merge']
      };
      
      this.commits.set(mergeCommit.id, mergeCommit);
      this.updateBranchHead(this.currentBranch, mergeCommit.id);
      
      return {
        success: true,
        commit: mergeCommit,
        conflicts,
        strategy,
        stats: {
          autoMerged: allConceptKeys.size + allBeliefKeys.size + allTopics.size - conflicts.length,
          conflicted: conflicts.length,
          fastForward: false
        }
      };
    }
    
    // Conflicts need manual resolution
    return {
      success: false,
      conflicts,
      strategy,
      stats: {
        autoMerged: allConceptKeys.size + allBeliefKeys.size + allTopics.size - conflicts.length,
        conflicted: conflicts.length,
        fastForward: false
      }
    };
  }
  
  private mergeValue<T>(
    type: MergeConflict['type'],
    key: string,
    ours: T | undefined,
    theirs: T | undefined,
    base: T | undefined,
    strategy: MergeStrategy
  ): { value?: T; conflict?: MergeConflict } {
    // No conflict cases
    if (ours === undefined && theirs === undefined) {
      return {};
    }
    if (ours === undefined) {
      return { value: theirs };
    }
    if (theirs === undefined) {
      return { value: ours };
    }
    if (JSON.stringify(ours) === JSON.stringify(theirs)) {
      return { value: ours };
    }
    
    // Both changed - conflict
    let autoResolution: T | undefined;
    let confidence = 0;
    
    switch (strategy) {
      case 'ours':
        autoResolution = ours;
        confidence = 1;
        break;
        
      case 'theirs':
        autoResolution = theirs;
        confidence = 1;
        break;
        
      case 'confidence':
        if (type === 'concept') {
          const oursConf = (ours as ConceptVersion).confidence || 0;
          const theirsConf = (theirs as ConceptVersion).confidence || 0;
          autoResolution = oursConf >= theirsConf ? ours : theirs;
          confidence = Math.abs(oursConf - theirsConf) / Math.max(oursConf, theirsConf, 0.01);
        } else if (type === 'belief') {
          const oursConf = (ours as BeliefVersion).confidence || 0;
          const theirsConf = (theirs as BeliefVersion).confidence || 0;
          autoResolution = oursConf >= theirsConf ? ours : theirs;
          confidence = Math.abs(oursConf - theirsConf) / Math.max(oursConf, theirsConf, 0.01);
        } else if (type === 'understanding') {
          const oursVal = ours as number;
          const theirsVal = theirs as number;
          autoResolution = (oursVal >= theirsVal ? ours : theirs);
          confidence = Math.abs(oursVal - theirsVal);
        }
        break;
        
      case 'union':
        if (type === 'concept') {
          autoResolution = this.unionConcepts(ours as ConceptVersion, theirs as ConceptVersion) as T;
          confidence = 0.7;
        } else if (type === 'belief') {
          autoResolution = this.unionBeliefs(ours as BeliefVersion, theirs as BeliefVersion) as T;
          confidence = 0.7;
        } else {
          // For understanding, take max
          autoResolution = Math.max(ours as number, theirs as number) as T;
          confidence = 0.9;
        }
        break;
        
      case 'manual':
        // No auto-resolution
        break;
    }
    
    return {
      value: autoResolution,
      conflict: {
        type,
        key,
        ours,
        theirs,
        base,
        autoResolution,
        confidence
      }
    };
  }
  
  private unionConcepts(a: ConceptVersion, b: ConceptVersion): ConceptVersion {
    return {
      name: a.name,
      definition: a.definition.length > b.definition.length ? a.definition : b.definition,
      semanticVector: a.semanticVector.length > 0 ? a.semanticVector : b.semanticVector,
      examples: [...new Set([...a.examples, ...b.examples])],
      relations: new Map([...a.relations, ...b.relations]),
      confidence: Math.max(a.confidence, b.confidence),
      source: 'merged'
    };
  }
  
  private unionBeliefs(a: BeliefVersion, b: BeliefVersion): BeliefVersion {
    return {
      statement: a.statement,
      confidence: (a.confidence + b.confidence) / 2,
      evidence: [...new Set([...a.evidence, ...b.evidence])],
      derivedFrom: [...new Set([...a.derivedFrom, ...b.derivedFrom])],
      challenges: [...new Set([...a.challenges, ...b.challenges])]
    };
  }
  
  private findMergeBase(commitA: string, commitB: string): ContextCommit | undefined {
    // Simple BFS to find common ancestor
    const ancestorsA = new Set<string>();
    const queue = [commitA];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      ancestorsA.add(current);
      const commit = this.commits.get(current);
      if (commit) {
        queue.push(...commit.parentIds);
      }
    }
    
    // Find first ancestor of B that's in A's ancestry
    const queueB = [commitB];
    while (queueB.length > 0) {
      const current = queueB.shift()!;
      if (ancestorsA.has(current)) {
        return this.commits.get(current);
      }
      const commit = this.commits.get(current);
      if (commit) {
        queueB.push(...commit.parentIds);
      }
    }
    
    return undefined;
  }
  
  private isAncestor(potentialAncestor: string, descendant: string): boolean {
    let current = this.commits.get(descendant);
    while (current) {
      if (current.id === potentialAncestor) return true;
      if (current.parentIds.length === 0) return false;
      current = this.commits.get(current.parentIds[0]);
    }
    return false;
  }
  
  // --------------------------------------------------------------------------
  // History & Navigation
  // --------------------------------------------------------------------------
  
  /**
   * Get commit history (like git log)
   */
  log(options: {
    limit?: number;
    since?: number;
    until?: number;
    author?: string;
    grep?: string;
  } = {}): ContextCommit[] {
    const commits: ContextCommit[] = [];
    const visited = new Set<string>();
    const queue = [this.getHead().id];
    
    while (queue.length > 0 && (options.limit === undefined || commits.length < options.limit)) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      
      const commit = this.commits.get(id);
      if (!commit) continue;
      
      // Apply filters
      if (options.since && commit.timestamp < options.since) continue;
      if (options.until && commit.timestamp > options.until) continue;
      if (options.author && commit.author !== options.author) continue;
      if (options.grep && !commit.message.toLowerCase().includes(options.grep.toLowerCase())) continue;
      
      commits.push(commit);
      queue.push(...commit.parentIds);
    }
    
    return commits.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Revert to a previous commit (creates new commit with old state)
   */
  revert(commitId: string, message?: string): ContextCommit {
    const target = this.getCommit(commitId);
    if (!target) {
      throw new Error(`Commit '${commitId}' not found`);
    }
    
    const current = this.getHead();
    
    const revertCommit: ContextCommit = {
      id: this.computeCommitId({
        concepts: target.concepts,
        beliefs: target.beliefs,
        understanding: target.understanding
      }),
      parentIds: [current.id],
      timestamp: Date.now(),
      author: this.agentId,
      concepts: new Map(target.concepts),
      beliefs: new Map(target.beliefs),
      understanding: new Map(target.understanding),
      message: message || `Revert to ${commitId.slice(0, 8)}`,
      tags: ['revert']
    };
    
    this.commits.set(revertCommit.id, revertCommit);
    this.updateBranchHead(this.currentBranch, revertCommit.id);
    
    return revertCommit;
  }
  
  /**
   * Cherry-pick a commit onto current branch
   */
  cherryPick(commitId: string): ContextCommit {
    const source = this.getCommit(commitId);
    if (!source) {
      throw new Error(`Commit '${commitId}' not found`);
    }
    
    const current = this.getHead();
    
    // Get diff from source's parent
    const sourceParent = source.parentIds[0] ? this.getCommit(source.parentIds[0]) : null;
    
    if (!sourceParent) {
      throw new Error('Cannot cherry-pick root commit');
    }
    
    // Apply the diff to current
    const diff = this.diff(sourceParent.id, source.id);
    
    const newConcepts = new Map(current.concepts);
    for (const [name, concept] of diff.concepts.added) {
      newConcepts.set(name, concept);
    }
    for (const name of diff.concepts.removed) {
      newConcepts.delete(name);
    }
    for (const [name, mod] of diff.concepts.modified) {
      newConcepts.set(name, mod.after);
    }
    
    const newBeliefs = new Map(current.beliefs);
    for (const [statement, belief] of diff.beliefs.added) {
      newBeliefs.set(statement, belief);
    }
    for (const statement of diff.beliefs.removed) {
      newBeliefs.delete(statement);
    }
    for (const [statement, mod] of diff.beliefs.modified) {
      newBeliefs.set(statement, mod.after);
    }
    
    const newUnderstanding = new Map(current.understanding);
    for (const [topic, conf] of diff.understanding.newTopics) {
      newUnderstanding.set(topic, conf);
    }
    for (const topic of diff.understanding.forgottenTopics) {
      newUnderstanding.delete(topic);
    }
    for (const [topic, change] of [...diff.understanding.increased, ...diff.understanding.decreased]) {
      const current = newUnderstanding.get(topic) || 0;
      newUnderstanding.set(topic, current + (change.to - change.from));
    }
    
    const cherryCommit: ContextCommit = {
      id: this.computeCommitId({
        concepts: newConcepts,
        beliefs: newBeliefs,
        understanding: newUnderstanding
      }),
      parentIds: [current.id],
      timestamp: Date.now(),
      author: this.agentId,
      concepts: newConcepts,
      beliefs: newBeliefs,
      understanding: newUnderstanding,
      message: `Cherry-pick: ${source.message}`,
      tags: ['cherry-pick']
    };
    
    this.commits.set(cherryCommit.id, cherryCommit);
    this.updateBranchHead(this.currentBranch, cherryCommit.id);
    
    return cherryCommit;
  }
  
  // --------------------------------------------------------------------------
  // Tags
  // --------------------------------------------------------------------------
  
  createTag(name: string, commitId?: string, message?: string): void {
    const target = commitId || this.getHead().id;
    this.tags.set(name, target);
    
    // Also add to commit's tags
    const commit = this.commits.get(target);
    if (commit && !commit.tags.includes(name)) {
      commit.tags.push(name);
    }
  }
  
  getTag(name: string): string | undefined {
    return this.tags.get(name);
  }
  
  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------
  
  private computeCommitId(content: {
    concepts: Map<string, ConceptVersion>;
    beliefs: Map<string, BeliefVersion>;
    understanding: Map<string, number>;
  }): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify({
      concepts: Array.from(content.concepts.entries()),
      beliefs: Array.from(content.beliefs.entries()),
      understanding: Array.from(content.understanding.entries()),
      timestamp: Date.now()
    }));
    return hash.digest('hex');
  }
  
  /**
   * Export repository state for serialization
   */
  export(): {
    commits: [string, ContextCommit][];
    branches: [string, ContextBranch][];
    tags: [string, string][];
    currentBranch: string;
  } {
    return {
      commits: Array.from(this.commits.entries()),
      branches: Array.from(this.branches.entries()),
      tags: Array.from(this.tags.entries()),
      currentBranch: this.currentBranch
    };
  }
  
  /**
   * Import repository state from serialized data
   */
  static import(
    agentId: string,
    data: ReturnType<ContextRepository['export']>
  ): ContextRepository {
    const repo = new ContextRepository(agentId);
    
    repo.commits = new Map(data.commits.map(([id, c]) => [
      id,
      {
        ...c,
        concepts: new Map(Object.entries(c.concepts || {})),
        beliefs: new Map(Object.entries(c.beliefs || {})),
        understanding: new Map(Object.entries(c.understanding || {}))
      }
    ]));
    repo.branches = new Map(data.branches);
    repo.tags = new Map(data.tags);
    repo.currentBranch = data.currentBranch;
    
    return repo;
  }
  
  /**
   * Get status summary (like git status)
   */
  status(): {
    branch: string;
    head: string;
    headMessage: string;
    staged: { concepts: number; beliefs: number; understanding: number };
    ahead: number;
    behind: number;
  } {
    const head = this.getHead();
    const branch = this.branches.get(this.currentBranch)!;
    
    let ahead = 0;
    let behind = 0;
    
    if (branch.upstream) {
      const upstream = this.branches.get(branch.upstream);
      if (upstream) {
        // Count commits ahead/behind upstream
        const upstreamCommit = this.commits.get(upstream.head);
        if (upstreamCommit) {
          // Simple check: is head ancestor of upstream?
          if (this.isAncestor(head.id, upstream.head)) {
            behind = this.countCommitsBetween(head.id, upstream.head);
          } else if (this.isAncestor(upstream.head, head.id)) {
            ahead = this.countCommitsBetween(upstream.head, head.id);
          }
        }
      }
    }
    
    return {
      branch: this.currentBranch,
      head: head.id.slice(0, 8),
      headMessage: head.message,
      staged: {
        concepts: this.workingState.concepts?.size || 0,
        beliefs: this.workingState.beliefs?.size || 0,
        understanding: this.workingState.understanding?.size || 0
      },
      ahead,
      behind
    };
  }
  
  private countCommitsBetween(from: string, to: string): number {
    let count = 0;
    let current = this.commits.get(to);
    while (current && current.id !== from) {
      count++;
      current = current.parentIds[0] ? this.commits.get(current.parentIds[0]) : undefined;
    }
    return count;
  }
}

// ============================================================================
// Handshake Integration
// ============================================================================

/**
 * Sync versioning state between agents during handshake
 */
export interface VersioningSyncMessage {
  type: 'version-sync';
  agentId: string;
  branches: string[];
  headCommits: Map<string, string>;  // Branch → commit ID
  commonAncestors?: string[];        // Known shared commits
}

/**
 * Request to pull context from another agent
 */
export interface ContextPullRequest {
  type: 'context-pull';
  fromAgent: string;
  toAgent: string;
  branch: string;
  sinceCommit?: string;
}

/**
 * Response with commits to pull
 */
export interface ContextPullResponse {
  type: 'context-pull-response';
  commits: ContextCommit[];
  hasMore: boolean;
  nextSince?: string;
}

/**
 * Coordinate context versioning across agents
 */
export class DistributedVersioning {
  private localRepo: ContextRepository;
  private remotes: Map<string, { agentId: string; lastSync: number; heads: Map<string, string> }> = new Map();
  
  constructor(localRepo: ContextRepository) {
    this.localRepo = localRepo;
  }
  
  /**
   * Register a remote agent
   */
  addRemote(name: string, agentId: string): void {
    this.remotes.set(name, {
      agentId,
      lastSync: 0,
      heads: new Map()
    });
  }
  
  /**
   * Generate sync message for handshake
   */
  createSyncMessage(): VersioningSyncMessage {
    const exported = this.localRepo.export();
    return {
      type: 'version-sync',
      agentId: exported.currentBranch, // Using branch as identifier in this context
      branches: exported.branches.map(([name]) => name),
      headCommits: new Map(exported.branches.map(([name, branch]) => [name, branch.head]))
    };
  }
  
  /**
   * Process incoming sync message
   */
  processSyncMessage(message: VersioningSyncMessage): {
    needsPull: string[];
    needsPush: string[];
    inSync: string[];
  } {
    const result = { needsPull: [] as string[], needsPush: [] as string[], inSync: [] as string[] };
    
    for (const [branch, remoteHead] of message.headCommits) {
      const localBranch = this.localRepo.export().branches.find(([name]) => name === branch);
      
      if (!localBranch) {
        result.needsPull.push(branch);
      } else if (localBranch[1].head === remoteHead) {
        result.inSync.push(branch);
      } else {
        // Check ancestry
        const localHead = localBranch[1].head;
        const localCommit = this.localRepo.getCommit(localHead);
        const remoteCommit = this.localRepo.getCommit(remoteHead);
        
        if (!remoteCommit) {
          result.needsPull.push(branch);
        } else if (!localCommit) {
          result.needsPush.push(branch);
        } else {
          // Both exist, check ancestry
          result.needsPull.push(branch);
          result.needsPush.push(branch);
        }
      }
    }
    
    return result;
  }
  
  /**
   * Create pull request for missing commits
   */
  createPullRequest(remoteName: string, branch: string): ContextPullRequest {
    const remote = this.remotes.get(remoteName);
    if (!remote) throw new Error(`Remote '${remoteName}' not found`);
    
    const localBranch = this.localRepo.export().branches.find(([name]) => name === branch);
    
    return {
      type: 'context-pull',
      fromAgent: remote.agentId,
      toAgent: this.localRepo.export().currentBranch,
      branch,
      sinceCommit: localBranch?.[1].head
    };
  }
}

// ============================================================================
// Usage Example
// ============================================================================

export function createCollaborationSession(agentA: string, agentB: string): {
  repoA: ContextRepository;
  repoB: ContextRepository;
  sync: () => MergeResult;
} {
  const repoA = new ContextRepository(agentA);
  const repoB = new ContextRepository(agentB);
  
  // Simulate separate understanding development
  return {
    repoA,
    repoB,
    sync: () => {
      // Create collaboration branch
      const branchName = `collab-${agentA}-${agentB}`;
      
      if (!repoA.export().branches.find(([name]) => name === branchName)) {
        repoA.createBranch(branchName);
      }
      
      // Export B's state and merge into A
      const bExport = repoB.export();
      const bHead = repoB.getHead();
      
      // Stage B's concepts into A's collaboration branch
      repoA.checkout(branchName);
      for (const [name, concept] of bHead.concepts) {
        repoA.stageConcept(name, concept);
      }
      for (const [statement, belief] of bHead.beliefs) {
        repoA.stageBelief(statement, belief);
      }
      for (const [topic, conf] of bHead.understanding) {
        repoA.stageUnderstanding(topic, conf);
      }
      repoA.commit(`Sync from ${agentB}`);
      
      // Merge back to main
      repoA.checkout('main');
      return repoA.merge(branchName, 'confidence');
    }
  };
}
