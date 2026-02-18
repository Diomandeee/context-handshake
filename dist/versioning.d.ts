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
/**
 * A snapshot of mental model state at a point in time
 */
export interface ContextCommit {
    id: string;
    parentIds: string[];
    timestamp: number;
    author: string;
    concepts: Map<string, ConceptVersion>;
    beliefs: Map<string, BeliefVersion>;
    understanding: Map<string, number>;
    message: string;
    tags: string[];
    signature?: string;
}
/**
 * Versioned concept with semantic tracking
 */
export interface ConceptVersion {
    name: string;
    definition: string;
    semanticVector: number[];
    examples: string[];
    relations: Map<string, string>;
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
    derivedFrom: string[];
    challenges: string[];
}
/**
 * Branch pointer for tracking parallel understanding
 */
export interface ContextBranch {
    name: string;
    head: string;
    upstream?: string;
    protected: boolean;
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
        modified: Map<string, {
            before: ConceptVersion;
            after: ConceptVersion;
            similarity: number;
        }>;
    };
    beliefs: {
        added: Map<string, BeliefVersion>;
        removed: Set<string>;
        modified: Map<string, {
            before: BeliefVersion;
            after: BeliefVersion;
            strengthened: boolean;
        }>;
    };
    understanding: {
        increased: Map<string, {
            from: number;
            to: number;
        }>;
        decreased: Map<string, {
            from: number;
            to: number;
        }>;
        newTopics: Map<string, number>;
        forgottenTopics: Set<string>;
    };
    stats: {
        additions: number;
        deletions: number;
        modifications: number;
        semanticShift: number;
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
    base?: any;
    autoResolution?: any;
    confidence: number;
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
export type MergeStrategy = 'ours' | 'theirs' | 'union' | 'confidence' | 'recency' | 'semantic' | 'manual';
export declare class ContextRepository {
    private commits;
    private branches;
    private tags;
    private currentBranch;
    private workingState;
    private agentId;
    private defaultStrategy;
    constructor(agentId: string);
    private initializeRepository;
    /**
     * Stage a concept change
     */
    stageConcept(name: string, concept: ConceptVersion): void;
    /**
     * Stage a belief change
     */
    stageBelief(statement: string, belief: BeliefVersion): void;
    /**
     * Stage understanding change
     */
    stageUnderstanding(topic: string, confidence: number): void;
    /**
     * Create a new commit from staged changes
     */
    commit(message: string, tags?: string[]): ContextCommit;
    /**
     * Get current HEAD commit
     */
    getHead(): ContextCommit;
    /**
     * Get commit by ID (short or full)
     */
    getCommit(id: string): ContextCommit | undefined;
    /**
     * Create a new branch at current HEAD
     */
    createBranch(name: string, fromCommit?: string): ContextBranch;
    /**
     * Switch to a different branch
     */
    checkout(branchName: string): void;
    /**
     * Delete a branch
     */
    deleteBranch(name: string): boolean;
    private updateBranchHead;
    /**
     * Compute diff between two commits
     */
    diff(fromCommitId: string, toCommitId: string): ContextDiff;
    private computeConceptSimilarity;
    private computeOverallShift;
    /**
     * Merge another branch into current branch
     */
    merge(sourceBranch: string, strategy?: MergeStrategy, message?: string): MergeResult;
    private mergeValue;
    private unionConcepts;
    private unionBeliefs;
    private findMergeBase;
    private isAncestor;
    /**
     * Get commit history (like git log)
     */
    log(options?: {
        limit?: number;
        since?: number;
        until?: number;
        author?: string;
        grep?: string;
    }): ContextCommit[];
    /**
     * Revert to a previous commit (creates new commit with old state)
     */
    revert(commitId: string, message?: string): ContextCommit;
    /**
     * Cherry-pick a commit onto current branch
     */
    cherryPick(commitId: string): ContextCommit;
    createTag(name: string, commitId?: string, message?: string): void;
    getTag(name: string): string | undefined;
    private computeCommitId;
    /**
     * Export repository state for serialization
     */
    export(): {
        commits: [string, ContextCommit][];
        branches: [string, ContextBranch][];
        tags: [string, string][];
        currentBranch: string;
    };
    /**
     * Import repository state from serialized data
     */
    static import(agentId: string, data: ReturnType<ContextRepository['export']>): ContextRepository;
    /**
     * Get status summary (like git status)
     */
    status(): {
        branch: string;
        head: string;
        headMessage: string;
        staged: {
            concepts: number;
            beliefs: number;
            understanding: number;
        };
        ahead: number;
        behind: number;
    };
    private countCommitsBetween;
}
/**
 * Sync versioning state between agents during handshake
 */
export interface VersioningSyncMessage {
    type: 'version-sync';
    agentId: string;
    branches: string[];
    headCommits: Map<string, string>;
    commonAncestors?: string[];
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
export declare class DistributedVersioning {
    private localRepo;
    private remotes;
    constructor(localRepo: ContextRepository);
    /**
     * Register a remote agent
     */
    addRemote(name: string, agentId: string): void;
    /**
     * Generate sync message for handshake
     */
    createSyncMessage(): VersioningSyncMessage;
    /**
     * Process incoming sync message
     */
    processSyncMessage(message: VersioningSyncMessage): {
        needsPull: string[];
        needsPush: string[];
        inSync: string[];
    };
    /**
     * Create pull request for missing commits
     */
    createPullRequest(remoteName: string, branch: string): ContextPullRequest;
}
export declare function createCollaborationSession(agentA: string, agentB: string): {
    repoA: ContextRepository;
    repoB: ContextRepository;
    sync: () => MergeResult;
};
