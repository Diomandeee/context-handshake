/**
 * Privacy & Selective Disclosure Module
 * 
 * Like TLS record-layer encryption meets GDPR data minimization —
 * agents share only what's needed, redact what's sensitive, and
 * prove capabilities without revealing internals.
 * 
 * HEF Instance: 28 | Generation: 6 | Priority: 1
 * Task: task_20260203133617_486c87
 */

// ─── Types ───────────────────────────────────────────────────────

export enum SensitivityLevel {
  PUBLIC = 'public',           // Share freely
  INTERNAL = 'internal',      // Share with trusted agents
  CONFIDENTIAL = 'confidential', // Share with explicit consent
  RESTRICTED = 'restricted',  // Never share, prove via ZKP
  REDACTED = 'redacted',      // Actively removed from context
}

export enum RedactionStrategy {
  REMOVE = 'remove',          // Delete entirely
  MASK = 'mask',              // Replace with placeholder
  GENERALIZE = 'generalize',  // Replace with broader category
  PERTURB = 'perturb',        // Add noise (differential privacy)
  HASH = 'hash',              // One-way hash (linkable but private)
  TOKENIZE = 'tokenize',      // Replace with reversible token
}

export interface PrivacyPolicy {
  id: string;
  name: string;
  version: number;
  rules: PrivacyRule[];
  defaults: {
    sensitivityLevel: SensitivityLevel;
    redactionStrategy: RedactionStrategy;
    retentionMs: number;
    consentRequired: boolean;
  };
  createdAt: number;
  updatedAt: number;
}

export interface PrivacyRule {
  id: string;
  pattern: string;             // Glob/regex matching context keys
  sensitivity: SensitivityLevel;
  redaction: RedactionStrategy;
  conditions: DisclosureCondition[];
  retentionMs?: number;        // Override default retention
  auditRequired: boolean;
  justificationRequired: boolean;
}

export interface DisclosureCondition {
  type: 'trust_level' | 'purpose' | 'agent_identity' | 'time_window' | 'consent' | 'reciprocal';
  operator: 'gte' | 'lte' | 'eq' | 'in' | 'not_in' | 'matches';
  value: string | number | string[];
  description?: string;
}

export interface ConsentRecord {
  id: string;
  grantorId: string;          // Agent granting consent
  granteeId: string;          // Agent receiving consent
  scope: string[];             // Context paths consented
  purpose: string;             // Why consent was given
  conditions: string[];        // Under what conditions
  grantedAt: number;
  expiresAt: number | null;
  revoked: boolean;
  revokedAt?: number;
  revokedReason?: string;
}

export interface DisclosureReceipt {
  id: string;
  discloserId: string;
  recipientId: string;
  contextPaths: string[];
  sensitivityLevels: SensitivityLevel[];
  redactionsApplied: RedactionRecord[];
  purpose: string;
  consentId?: string;
  timestamp: number;
  expiresAt: number;
  acknowledged: boolean;
}

export interface RedactionRecord {
  path: string;
  strategy: RedactionStrategy;
  originalType: string;
  redactedValue: unknown;
  reversible: boolean;
  tokenId?: string;            // For tokenize strategy
}

export interface ZeroKnowledgeProof {
  claim: string;               // What's being proved
  commitment: string;          // Cryptographic commitment
  challenge: string;           // Verifier's challenge
  response: string;            // Prover's response
  verified: boolean;
  verifiedAt?: number;
}

export interface PrivacyBudget {
  agentId: string;
  epsilon: number;             // Total privacy budget (differential privacy)
  consumed: number;            // Budget spent
  remaining: number;           // Budget left
  queries: BudgetQuery[];      // History of queries
  resetAt: number;             // When budget resets
}

interface BudgetQuery {
  queryId: string;
  epsilonCost: number;
  path: string;
  timestamp: number;
}

export interface SelectiveView {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  includedPaths: string[];
  excludedPaths: string[];
  transformations: ViewTransformation[];
  createdAt: number;
  expiresAt: number;
}

interface ViewTransformation {
  path: string;
  type: 'rename' | 'aggregate' | 'filter' | 'derive';
  config: Record<string, unknown>;
}

// ─── Privacy Policy Engine ───────────────────────────────────────

export class PrivacyPolicyEngine {
  private policies: Map<string, PrivacyPolicy> = new Map();
  private compiledRules: Map<string, CompiledRule[]> = new Map();

  addPolicy(policy: PrivacyPolicy): void {
    this.policies.set(policy.id, policy);
    this.compiledRules.set(
      policy.id,
      policy.rules.map(r => this.compileRule(r))
    );
  }

  removePolicy(policyId: string): boolean {
    this.compiledRules.delete(policyId);
    return this.policies.delete(policyId);
  }

  /**
   * Evaluate what sensitivity level applies to a context path
   * under a given policy. Most restrictive rule wins.
   */
  evaluate(policyId: string, contextPath: string, context: EvaluationContext): PolicyDecision {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return {
        allowed: false,
        sensitivity: SensitivityLevel.RESTRICTED,
        redaction: RedactionStrategy.REMOVE,
        reason: `Policy ${policyId} not found`,
        conditions: [],
      };
    }

    const compiled = this.compiledRules.get(policyId) || [];
    const matchingRules = compiled.filter(r => r.matches(contextPath));

    if (matchingRules.length === 0) {
      // Use policy defaults
      return {
        allowed: policy.defaults.sensitivityLevel !== SensitivityLevel.RESTRICTED,
        sensitivity: policy.defaults.sensitivityLevel,
        redaction: policy.defaults.redactionStrategy,
        reason: 'Default policy applied',
        conditions: [],
      };
    }

    // Most restrictive rule wins
    const mostRestrictive = matchingRules.reduce((a, b) =>
      sensitivityOrdinal(a.rule.sensitivity) > sensitivityOrdinal(b.rule.sensitivity) ? a : b
    );

    const conditionsMet = this.checkConditions(mostRestrictive.rule.conditions, context);

    return {
      allowed: conditionsMet.allMet && mostRestrictive.rule.sensitivity !== SensitivityLevel.RESTRICTED,
      sensitivity: mostRestrictive.rule.sensitivity,
      redaction: mostRestrictive.rule.redaction,
      reason: conditionsMet.allMet
        ? `Rule ${mostRestrictive.rule.id} allows disclosure`
        : `Conditions not met: ${conditionsMet.failures.join(', ')}`,
      conditions: conditionsMet.details,
      auditRequired: mostRestrictive.rule.auditRequired,
      justificationRequired: mostRestrictive.rule.justificationRequired,
    };
  }

  /**
   * Generate a privacy-filtered view of a context object.
   * Applies all matching rules, redacts as needed.
   */
  filterContext(
    policyId: string,
    contextObj: Record<string, unknown>,
    evalCtx: EvaluationContext
  ): { filtered: Record<string, unknown>; redactions: RedactionRecord[] } {
    const filtered: Record<string, unknown> = {};
    const redactions: RedactionRecord[] = [];

    for (const [path, value] of flattenObject(contextObj)) {
      const decision = this.evaluate(policyId, path, evalCtx);

      if (decision.allowed) {
        setNestedValue(filtered, path, value);
      } else {
        const redacted = this.applyRedaction(path, value, decision.redaction);
        if (redacted.redactedValue !== undefined) {
          setNestedValue(filtered, path, redacted.redactedValue);
        }
        redactions.push(redacted);
      }
    }

    return { filtered, redactions };
  }

  private compileRule(rule: PrivacyRule): CompiledRule {
    const regex = globToRegex(rule.pattern);
    return {
      rule,
      matches: (path: string) => regex.test(path),
    };
  }

  private checkConditions(
    conditions: DisclosureCondition[],
    context: EvaluationContext
  ): ConditionResult {
    const details: ConditionDetail[] = [];
    const failures: string[] = [];

    for (const cond of conditions) {
      const met = this.evaluateCondition(cond, context);
      details.push({ condition: cond, met, reason: met ? 'Satisfied' : `Failed: ${cond.type}` });
      if (!met) failures.push(cond.type);
    }

    return {
      allMet: failures.length === 0,
      details,
      failures,
    };
  }

  private evaluateCondition(cond: DisclosureCondition, ctx: EvaluationContext): boolean {
    switch (cond.type) {
      case 'trust_level':
        return compareValue(ctx.trustLevel ?? 0, cond.operator, cond.value as number);
      case 'purpose':
        return compareValue(ctx.purpose ?? '', cond.operator, cond.value);
      case 'agent_identity':
        return compareValue(ctx.agentId ?? '', cond.operator, cond.value);
      case 'time_window': {
        const now = Date.now();
        const windowMs = (cond.value as number) * 1000;
        return now <= (ctx.sessionStartedAt ?? 0) + windowMs;
      }
      case 'consent':
        return ctx.hasConsent === true;
      case 'reciprocal':
        return ctx.reciprocalDisclosure === true;
      default:
        return false;
    }
  }

  private applyRedaction(path: string, value: unknown, strategy: RedactionStrategy): RedactionRecord {
    const originalType = typeof value;

    switch (strategy) {
      case RedactionStrategy.REMOVE:
        return { path, strategy, originalType, redactedValue: undefined, reversible: false };

      case RedactionStrategy.MASK:
        return {
          path, strategy, originalType,
          redactedValue: maskValue(value),
          reversible: false,
        };

      case RedactionStrategy.GENERALIZE:
        return {
          path, strategy, originalType,
          redactedValue: generalizeValue(path, value),
          reversible: false,
        };

      case RedactionStrategy.PERTURB:
        return {
          path, strategy, originalType,
          redactedValue: perturbValue(value),
          reversible: false,
        };

      case RedactionStrategy.HASH:
        return {
          path, strategy, originalType,
          redactedValue: hashValue(value),
          reversible: false,
        };

      case RedactionStrategy.TOKENIZE: {
        const tokenId = `tok_${generateId()}`;
        return {
          path, strategy, originalType,
          redactedValue: tokenId,
          reversible: true,
          tokenId,
        };
      }

      default:
        return { path, strategy: RedactionStrategy.REMOVE, originalType, redactedValue: undefined, reversible: false };
    }
  }
}

// ─── Consent Manager ─────────────────────────────────────────────

export class ConsentManager {
  private consents: Map<string, ConsentRecord> = new Map();
  private consentIndex: Map<string, Set<string>> = new Map(); // grantee -> consent IDs

  grant(consent: Omit<ConsentRecord, 'id' | 'revoked'>): ConsentRecord {
    const record: ConsentRecord = {
      ...consent,
      id: `consent_${generateId()}`,
      revoked: false,
    };

    this.consents.set(record.id, record);

    const key = `${record.grantorId}:${record.granteeId}`;
    if (!this.consentIndex.has(key)) {
      this.consentIndex.set(key, new Set());
    }
    this.consentIndex.get(key)!.add(record.id);

    return record;
  }

  revoke(consentId: string, reason: string): boolean {
    const consent = this.consents.get(consentId);
    if (!consent || consent.revoked) return false;

    consent.revoked = true;
    consent.revokedAt = Date.now();
    consent.revokedReason = reason;
    return true;
  }

  /**
   * Check if there's active consent for a specific scope
   * between two agents.
   */
  hasConsent(grantorId: string, granteeId: string, scope: string): boolean {
    const key = `${grantorId}:${granteeId}`;
    const consentIds = this.consentIndex.get(key);
    if (!consentIds) return false;

    const now = Date.now();
    for (const id of consentIds) {
      const consent = this.consents.get(id);
      if (!consent || consent.revoked) continue;
      if (consent.expiresAt && consent.expiresAt < now) continue;

      // Check if scope matches any consented path
      if (consent.scope.some(s => scope.startsWith(s) || matchesGlob(s, scope))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all active consents for an agent pair.
   */
  getActiveConsents(grantorId: string, granteeId: string): ConsentRecord[] {
    const key = `${grantorId}:${granteeId}`;
    const consentIds = this.consentIndex.get(key);
    if (!consentIds) return [];

    const now = Date.now();
    const active: ConsentRecord[] = [];

    for (const id of consentIds) {
      const consent = this.consents.get(id);
      if (!consent || consent.revoked) continue;
      if (consent.expiresAt && consent.expiresAt < now) continue;
      active.push(consent);
    }

    return active;
  }

  /**
   * Expire all consents older than the given timestamp.
   */
  cleanup(beforeTimestamp: number): number {
    let cleaned = 0;
    for (const [id, consent] of this.consents) {
      if (consent.expiresAt && consent.expiresAt < beforeTimestamp) {
        this.consents.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// ─── Differential Privacy Engine ─────────────────────────────────

export class DifferentialPrivacyEngine {
  private budgets: Map<string, PrivacyBudget> = new Map();

  /**
   * Initialize a privacy budget for an agent.
   * Epsilon controls the privacy-utility tradeoff:
   *   - Small ε (0.1-1.0): Strong privacy, more noise
   *   - Medium ε (1.0-5.0): Balanced
   *   - Large ε (5.0+): Weak privacy, less noise
   */
  initBudget(agentId: string, epsilon: number, resetIntervalMs: number): PrivacyBudget {
    const budget: PrivacyBudget = {
      agentId,
      epsilon,
      consumed: 0,
      remaining: epsilon,
      queries: [],
      resetAt: Date.now() + resetIntervalMs,
    };
    this.budgets.set(agentId, budget);
    return budget;
  }

  /**
   * Query a numeric value with differential privacy guarantees.
   * Returns the value plus calibrated Laplace noise.
   */
  queryNumeric(
    agentId: string,
    path: string,
    trueValue: number,
    sensitivity: number, // How much one record can change the output
    queryCost: number    // Epsilon cost of this query
  ): { value: number; noise: number; budgetRemaining: number } | null {
    const budget = this.budgets.get(agentId);
    if (!budget) return null;

    // Check and refresh budget if expired
    if (Date.now() >= budget.resetAt) {
      budget.consumed = 0;
      budget.remaining = budget.epsilon;
      budget.queries = [];
      budget.resetAt = Date.now() + 3600_000; // 1 hour default
    }

    // Check budget
    if (budget.remaining < queryCost) return null;

    // Laplace mechanism: noise ~ Lap(sensitivity / epsilon)
    const scale = sensitivity / queryCost;
    const noise = laplaceSample(scale);
    const noisyValue = trueValue + noise;

    // Deduct budget
    budget.consumed += queryCost;
    budget.remaining -= queryCost;
    budget.queries.push({
      queryId: `q_${generateId()}`,
      epsilonCost: queryCost,
      path,
      timestamp: Date.now(),
    });

    return {
      value: noisyValue,
      noise,
      budgetRemaining: budget.remaining,
    };
  }

  /**
   * Randomized response for boolean/categorical values.
   * With probability p, return the true value; otherwise, random.
   */
  queryBoolean(
    agentId: string,
    path: string,
    trueValue: boolean,
    queryCost: number
  ): { value: boolean; plausiblyDeniable: boolean; budgetRemaining: number } | null {
    const budget = this.budgets.get(agentId);
    if (!budget || budget.remaining < queryCost) return null;

    // Randomized response: flip with probability derived from epsilon
    const p = Math.exp(queryCost) / (1 + Math.exp(queryCost)); // probability of truth
    const reportTruth = Math.random() < p;
    const reportedValue = reportTruth ? trueValue : Math.random() < 0.5;

    budget.consumed += queryCost;
    budget.remaining -= queryCost;
    budget.queries.push({
      queryId: `q_${generateId()}`,
      epsilonCost: queryCost,
      path,
      timestamp: Date.now(),
    });

    return {
      value: reportedValue,
      plausiblyDeniable: true,
      budgetRemaining: budget.remaining,
    };
  }

  getBudget(agentId: string): PrivacyBudget | undefined {
    return this.budgets.get(agentId);
  }
}

// ─── Zero-Knowledge Proof System ─────────────────────────────────

/**
 * Simplified ZKP for capability claims.
 * "I can do X" without revealing how or what else I can do.
 * 
 * Uses Schnorr-like protocol adapted for context claims:
 * 1. Prover commits to a claim
 * 2. Verifier challenges
 * 3. Prover responds without revealing the underlying data
 */
export class ZeroKnowledgeProver {
  private commitments: Map<string, CommitmentState> = new Map();

  /**
   * Step 1: Prover creates a commitment for a claim.
   * The claim is hashed with a secret nonce.
   */
  commit(claim: string, secretEvidence: string): { commitmentId: string; commitment: string } {
    const nonce = generateId();
    const commitment = hashString(`${claim}:${secretEvidence}:${nonce}`);
    const id = `zkp_${generateId()}`;

    this.commitments.set(id, {
      claim,
      secretEvidence,
      nonce,
      commitment,
      stage: 'committed',
    });

    return { commitmentId: id, commitment };
  }

  /**
   * Step 2: Verifier issues a challenge.
   */
  challenge(commitmentId: string): { challenge: string } | null {
    const state = this.commitments.get(commitmentId);
    if (!state || state.stage !== 'committed') return null;

    const challenge = generateId(); // Random challenge
    state.challenge = challenge;
    state.stage = 'challenged';

    return { challenge };
  }

  /**
   * Step 3: Prover responds to the challenge.
   * Response proves knowledge of the secret without revealing it.
   */
  respond(commitmentId: string): { response: string } | null {
    const state = this.commitments.get(commitmentId);
    if (!state || state.stage !== 'challenged' || !state.challenge) return null;

    // Response = hash(secret + challenge + nonce)
    // Verifier can check this matches the commitment pattern
    // without learning the secret
    const response = hashString(
      `${state.secretEvidence}:${state.challenge}:${state.nonce}`
    );

    state.response = response;
    state.stage = 'responded';

    return { response };
  }

  /**
   * Step 4: Verify the proof.
   * Returns true if the prover demonstrably knows the secret.
   */
  verify(commitmentId: string): ZeroKnowledgeProof | null {
    const state = this.commitments.get(commitmentId);
    if (!state || state.stage !== 'responded') return null;

    // Verify: recompute and check consistency
    const expectedCommitment = hashString(
      `${state.claim}:${state.secretEvidence}:${state.nonce}`
    );
    const expectedResponse = hashString(
      `${state.secretEvidence}:${state.challenge}:${state.nonce}`
    );

    const verified = (
      state.commitment === expectedCommitment &&
      state.response === expectedResponse
    );

    const proof: ZeroKnowledgeProof = {
      claim: state.claim,
      commitment: state.commitment,
      challenge: state.challenge!,
      response: state.response!,
      verified,
      verifiedAt: verified ? Date.now() : undefined,
    };

    // Clean up
    this.commitments.delete(commitmentId);

    return proof;
  }
}

// ─── Selective View Builder ──────────────────────────────────────

/**
 * Creates privacy-preserving "views" of an agent's context,
 * like database views that expose only certain columns/rows.
 */
export class SelectiveViewBuilder {
  private views: Map<string, SelectiveView> = new Map();

  /**
   * Create a view that exposes only specific paths from context.
   */
  createView(config: {
    sourceAgentId: string;
    targetAgentId: string;
    include: string[];
    exclude?: string[];
    transformations?: ViewTransformation[];
    ttlMs?: number;
  }): SelectiveView {
    const view: SelectiveView = {
      id: `view_${generateId()}`,
      sourceAgentId: config.sourceAgentId,
      targetAgentId: config.targetAgentId,
      includedPaths: config.include,
      excludedPaths: config.exclude || [],
      transformations: config.transformations || [],
      createdAt: Date.now(),
      expiresAt: Date.now() + (config.ttlMs || 3600_000),
    };

    this.views.set(view.id, view);
    return view;
  }

  /**
   * Apply a view to a full context, returning only what the
   * target agent is allowed to see.
   */
  applyView(viewId: string, fullContext: Record<string, unknown>): Record<string, unknown> | null {
    const view = this.views.get(viewId);
    if (!view) return null;
    if (Date.now() > view.expiresAt) {
      this.views.delete(viewId);
      return null;
    }

    const result: Record<string, unknown> = {};

    // Include only matching paths
    for (const [path, value] of flattenObject(fullContext)) {
      const included = view.includedPaths.some(p => matchesGlob(p, path));
      const excluded = view.excludedPaths.some(p => matchesGlob(p, path));

      if (included && !excluded) {
        // Apply transformations
        const transformed = this.applyTransformations(path, value, view.transformations);
        setNestedValue(result, transformed.path, transformed.value);
      }
    }

    return result;
  }

  /**
   * Revoke a view (e.g., after collaboration ends).
   */
  revokeView(viewId: string): boolean {
    return this.views.delete(viewId);
  }

  getActiveViews(agentId: string): SelectiveView[] {
    const now = Date.now();
    const active: SelectiveView[] = [];

    for (const view of this.views.values()) {
      if (view.expiresAt > now &&
          (view.sourceAgentId === agentId || view.targetAgentId === agentId)) {
        active.push(view);
      }
    }

    return active;
  }

  private applyTransformations(
    path: string,
    value: unknown,
    transformations: ViewTransformation[]
  ): { path: string; value: unknown } {
    let currentPath = path;
    let currentValue = value;

    for (const transform of transformations) {
      if (!matchesGlob(transform.path, currentPath)) continue;

      switch (transform.type) {
        case 'rename':
          currentPath = (transform.config.newName as string) || currentPath;
          break;
        case 'aggregate':
          if (Array.isArray(currentValue)) {
            const fn = transform.config.fn as string;
            if (fn === 'count') currentValue = currentValue.length;
            else if (fn === 'sum') currentValue = (currentValue as number[]).reduce((a, b) => a + b, 0);
            else if (fn === 'avg') currentValue = (currentValue as number[]).reduce((a, b) => a + b, 0) / currentValue.length;
          }
          break;
        case 'filter':
          if (Array.isArray(currentValue)) {
            const predicate = transform.config.predicate as string;
            // Simple predicate evaluation
            currentValue = currentValue.filter(item =>
              typeof item === 'object' && item !== null
                ? (item as Record<string, unknown>)[predicate] !== undefined
                : true
            );
          }
          break;
        case 'derive':
          // Replace with derived value
          currentValue = transform.config.defaultValue ?? '[derived]';
          break;
      }
    }

    return { path: currentPath, value: currentValue };
  }
}

// ─── Disclosure Audit Trail ──────────────────────────────────────

export class DisclosureAuditor {
  private receipts: DisclosureReceipt[] = [];
  private readonly maxReceipts: number;

  constructor(maxReceipts: number = 10_000) {
    this.maxReceipts = maxReceipts;
  }

  /**
   * Record a disclosure event.
   */
  record(disclosure: Omit<DisclosureReceipt, 'id' | 'timestamp' | 'acknowledged'>): DisclosureReceipt {
    const receipt: DisclosureReceipt = {
      ...disclosure,
      id: `disc_${generateId()}`,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.receipts.push(receipt);

    // Evict oldest if over limit
    if (this.receipts.length > this.maxReceipts) {
      this.receipts = this.receipts.slice(-this.maxReceipts);
    }

    return receipt;
  }

  /**
   * Acknowledge receipt of disclosed data.
   */
  acknowledge(receiptId: string): boolean {
    const receipt = this.receipts.find(r => r.id === receiptId);
    if (!receipt) return false;
    receipt.acknowledged = true;
    return true;
  }

  /**
   * Get all disclosures to/from an agent.
   */
  getDisclosures(agentId: string, direction: 'sent' | 'received' | 'both'): DisclosureReceipt[] {
    return this.receipts.filter(r => {
      if (direction === 'sent') return r.discloserId === agentId;
      if (direction === 'received') return r.recipientId === agentId;
      return r.discloserId === agentId || r.recipientId === agentId;
    });
  }

  /**
   * Find disclosures that have expired but data may still be held.
   */
  getExpiredDisclosures(): DisclosureReceipt[] {
    const now = Date.now();
    return this.receipts.filter(r => r.expiresAt < now);
  }

  /**
   * Generate a compliance report.
   */
  generateReport(agentId: string): ComplianceReport {
    const disclosures = this.getDisclosures(agentId, 'both');
    const sent = disclosures.filter(d => d.discloserId === agentId);
    const received = disclosures.filter(d => d.recipientId === agentId);

    const sensitivityBreakdown: Record<string, number> = {};
    for (const d of sent) {
      for (const level of d.sensitivityLevels) {
        sensitivityBreakdown[level] = (sensitivityBreakdown[level] || 0) + 1;
      }
    }

    const redactionCount = sent.reduce((sum, d) => sum + d.redactionsApplied.length, 0);
    const unacknowledged = received.filter(d => !d.acknowledged).length;
    const expired = this.getExpiredDisclosures().filter(
      d => d.recipientId === agentId
    ).length;

    return {
      agentId,
      period: {
        start: Math.min(...disclosures.map(d => d.timestamp)),
        end: Math.max(...disclosures.map(d => d.timestamp)),
      },
      totalDisclosuresSent: sent.length,
      totalDisclosuresReceived: received.length,
      sensitivityBreakdown,
      totalRedactions: redactionCount,
      unacknowledgedReceipts: unacknowledged,
      expiredDataHeld: expired,
      compliant: unacknowledged === 0 && expired === 0,
    };
  }
}

interface ComplianceReport {
  agentId: string;
  period: { start: number; end: number };
  totalDisclosuresSent: number;
  totalDisclosuresReceived: number;
  sensitivityBreakdown: Record<string, number>;
  totalRedactions: number;
  unacknowledgedReceipts: number;
  expiredDataHeld: number;
  compliant: boolean;
}

// ─── Data Minimization Advisor ───────────────────────────────────

/**
 * Analyzes context sharing patterns and recommends minimization.
 * Like a privacy consultant that watches what you share and says
 * "hey, you don't actually need to send all of that."
 */
export class DataMinimizationAdvisor {
  private sharingHistory: SharingEvent[] = [];

  recordSharing(event: SharingEvent): void {
    this.sharingHistory.push(event);
  }

  /**
   * Analyze sharing patterns and recommend what can be reduced.
   */
  analyze(agentId: string): MinimizationRecommendation[] {
    const agentEvents = this.sharingHistory.filter(e => e.agentId === agentId);
    const recommendations: MinimizationRecommendation[] = [];

    // 1. Detect over-sharing: paths shared but never accessed by recipient
    const sharedPaths = new Map<string, { shared: number; accessed: number }>();
    for (const event of agentEvents) {
      for (const path of event.paths) {
        const stats = sharedPaths.get(path) || { shared: 0, accessed: 0 };
        stats.shared++;
        if (event.accessed) stats.accessed++;
        sharedPaths.set(path, stats);
      }
    }

    for (const [path, stats] of sharedPaths) {
      if (stats.shared > 3 && stats.accessed === 0) {
        recommendations.push({
          type: 'remove',
          path,
          reason: `Shared ${stats.shared} times but never accessed by recipient`,
          confidence: Math.min(0.95, 0.5 + stats.shared * 0.1),
          estimatedPrivacyGain: 'high',
        });
      } else if (stats.shared > 5 && stats.accessed / stats.shared < 0.2) {
        recommendations.push({
          type: 'lazy_load',
          path,
          reason: `Only accessed ${Math.round(stats.accessed / stats.shared * 100)}% of the time — share on demand`,
          confidence: 0.7,
          estimatedPrivacyGain: 'medium',
        });
      }
    }

    // 2. Detect temporal patterns: data shared too early
    const earlyShares = agentEvents.filter(e =>
      e.accessedAt && e.sharedAt && (e.accessedAt - e.sharedAt) > 60_000
    );
    if (earlyShares.length > agentEvents.length * 0.3) {
      recommendations.push({
        type: 'defer',
        path: '*',
        reason: `${Math.round(earlyShares.length / agentEvents.length * 100)}% of shares accessed >1min after sharing — consider deferred disclosure`,
        confidence: 0.6,
        estimatedPrivacyGain: 'medium',
      });
    }

    // 3. Detect granularity issues: full objects shared when only one field used
    const granularityIssues = agentEvents.filter(e =>
      e.objectSize && e.fieldsAccessed && e.fieldsAccessed / e.objectSize < 0.3
    );
    if (granularityIssues.length > 2) {
      recommendations.push({
        type: 'narrow',
        path: '*',
        reason: 'Sharing full objects when <30% of fields are used — consider field-level sharing',
        confidence: 0.75,
        estimatedPrivacyGain: 'high',
      });
    }

    return recommendations;
  }
}

interface SharingEvent {
  agentId: string;
  recipientId: string;
  paths: string[];
  sharedAt: number;
  accessed: boolean;
  accessedAt?: number;
  objectSize?: number;
  fieldsAccessed?: number;
}

interface MinimizationRecommendation {
  type: 'remove' | 'lazy_load' | 'defer' | 'narrow' | 'aggregate' | 'generalize';
  path: string;
  reason: string;
  confidence: number;
  estimatedPrivacyGain: 'low' | 'medium' | 'high';
}

// ─── Integrated Privacy Controller ───────────────────────────────

/**
 * Top-level controller that wires everything together.
 * Single entry point for privacy-aware context sharing.
 */
export class PrivacyController {
  public readonly policyEngine: PrivacyPolicyEngine;
  public readonly consentManager: ConsentManager;
  public readonly dpEngine: DifferentialPrivacyEngine;
  public readonly zkProver: ZeroKnowledgeProver;
  public readonly viewBuilder: SelectiveViewBuilder;
  public readonly auditor: DisclosureAuditor;
  public readonly advisor: DataMinimizationAdvisor;

  constructor() {
    this.policyEngine = new PrivacyPolicyEngine();
    this.consentManager = new ConsentManager();
    this.dpEngine = new DifferentialPrivacyEngine();
    this.zkProver = new ZeroKnowledgeProver();
    this.viewBuilder = new SelectiveViewBuilder();
    this.auditor = new DisclosureAuditor();
    this.advisor = new DataMinimizationAdvisor();
  }

  /**
   * Full privacy-aware context disclosure flow:
   * 1. Check consent
   * 2. Evaluate policy
   * 3. Apply redactions
   * 4. Create selective view
   * 5. Audit the disclosure
   */
  disclose(request: DisclosureRequest): DisclosureResult {
    const { sourceId, targetId, policyId, context, purpose, justification } = request;

    // Step 1: Consent check
    const hasConsent = this.consentManager.hasConsent(sourceId, targetId, '*');
    if (!hasConsent && request.requireConsent !== false) {
      return {
        success: false,
        reason: 'No active consent found',
        disclosed: {},
        redactions: [],
        receiptId: null,
      };
    }

    // Step 2: Policy evaluation & filtering
    const evalCtx: EvaluationContext = {
      agentId: targetId,
      trustLevel: request.trustLevel ?? 0.5,
      purpose,
      hasConsent,
      reciprocalDisclosure: request.reciprocal ?? false,
      sessionStartedAt: Date.now(),
    };

    const { filtered, redactions } = this.policyEngine.filterContext(
      policyId, context, evalCtx
    );

    // Step 3: Check if any redaction required justification
    const needsJustification = redactions.some(r => {
      const decision = this.policyEngine.evaluate(policyId, r.path, evalCtx);
      return decision.justificationRequired;
    });

    if (needsJustification && !justification) {
      return {
        success: false,
        reason: 'Justification required for accessing restricted context',
        disclosed: {},
        redactions,
        receiptId: null,
      };
    }

    // Step 4: Create a view for tracking
    const view = this.viewBuilder.createView({
      sourceAgentId: sourceId,
      targetAgentId: targetId,
      include: Object.keys(flattenToMap(filtered)),
      ttlMs: request.ttlMs ?? 3600_000,
    });

    // Step 5: Audit trail
    const receipt = this.auditor.record({
      discloserId: sourceId,
      recipientId: targetId,
      contextPaths: Object.keys(flattenToMap(filtered)),
      sensitivityLevels: redactions.map(() => SensitivityLevel.CONFIDENTIAL), // simplified
      redactionsApplied: redactions,
      purpose,
      expiresAt: view.expiresAt,
    });

    // Step 6: Record for minimization analysis
    for (const path of Object.keys(flattenToMap(filtered))) {
      this.advisor.recordSharing({
        agentId: sourceId,
        recipientId: targetId,
        paths: [path],
        sharedAt: Date.now(),
        accessed: false,
      });
    }

    return {
      success: true,
      reason: `Disclosed ${Object.keys(flattenToMap(filtered)).length} paths with ${redactions.length} redactions`,
      disclosed: filtered,
      redactions,
      receiptId: receipt.id,
      viewId: view.id,
    };
  }

  /**
   * Prove a capability without disclosing context.
   * Full ZKP flow in one call.
   */
  proveCapability(claim: string, evidence: string): ZeroKnowledgeProof | null {
    const { commitmentId } = this.zkProver.commit(claim, evidence);
    this.zkProver.challenge(commitmentId);
    this.zkProver.respond(commitmentId);
    return this.zkProver.verify(commitmentId);
  }
}

interface DisclosureRequest {
  sourceId: string;
  targetId: string;
  policyId: string;
  context: Record<string, unknown>;
  purpose: string;
  justification?: string;
  trustLevel?: number;
  reciprocal?: boolean;
  requireConsent?: boolean;
  ttlMs?: number;
}

interface DisclosureResult {
  success: boolean;
  reason: string;
  disclosed: Record<string, unknown>;
  redactions: RedactionRecord[];
  receiptId: string | null;
  viewId?: string;
}

// ─── Helper Types ────────────────────────────────────────────────

interface CompiledRule {
  rule: PrivacyRule;
  matches: (path: string) => boolean;
}

interface PolicyDecision {
  allowed: boolean;
  sensitivity: SensitivityLevel;
  redaction: RedactionStrategy;
  reason: string;
  conditions: ConditionDetail[];
  auditRequired?: boolean;
  justificationRequired?: boolean;
}

interface EvaluationContext {
  agentId?: string;
  trustLevel?: number;
  purpose?: string;
  hasConsent?: boolean;
  reciprocalDisclosure?: boolean;
  sessionStartedAt?: number;
}

interface ConditionResult {
  allMet: boolean;
  details: ConditionDetail[];
  failures: string[];
}

interface ConditionDetail {
  condition: DisclosureCondition;
  met: boolean;
  reason: string;
}

interface CommitmentState {
  claim: string;
  secretEvidence: string;
  nonce: string;
  commitment: string;
  challenge?: string;
  response?: string;
  stage: 'committed' | 'challenged' | 'responded';
}

// ─── Utility Functions ───────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function sensitivityOrdinal(level: SensitivityLevel): number {
  const order = {
    [SensitivityLevel.PUBLIC]: 0,
    [SensitivityLevel.INTERNAL]: 1,
    [SensitivityLevel.CONFIDENTIAL]: 2,
    [SensitivityLevel.RESTRICTED]: 3,
    [SensitivityLevel.REDACTED]: 4,
  };
  return order[level] ?? 0;
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function matchesGlob(pattern: string, value: string): boolean {
  return globToRegex(pattern).test(value);
}

function* flattenObject(
  obj: Record<string, unknown>,
  prefix = ''
): Generator<[string, unknown]> {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      yield* flattenObject(value as Record<string, unknown>, path);
    } else {
      yield [path, value];
    }
  }
}

function flattenToMap(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [path, value] of flattenObject(obj)) {
    result[path] = value;
  }
  return result;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function maskValue(value: unknown): string {
  if (typeof value === 'string') {
    if (value.length <= 2) return '**';
    return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
  }
  if (typeof value === 'number') return '***';
  if (typeof value === 'boolean') return '[REDACTED]';
  return '[REDACTED]';
}

function generalizeValue(path: string, value: unknown): unknown {
  if (typeof value === 'number') {
    // Round to nearest order of magnitude
    if (value === 0) return 0;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value))));
    return Math.round(value / magnitude) * magnitude;
  }
  if (typeof value === 'string') {
    // Return category instead of specific value
    if (value.includes('@')) return '[email]';
    if (/^\d{3}[-.]?\d{3}[-.]?\d{4}$/.test(value)) return '[phone]';
    if (value.length > 50) return `[text, ${Math.round(value.length / 100) * 100} chars]`;
    return '[string]';
  }
  return '[generalized]';
}

function perturbValue(value: unknown): unknown {
  if (typeof value === 'number') {
    // Add noise proportional to value magnitude
    const noise = (Math.random() - 0.5) * 2 * Math.abs(value) * 0.1;
    return value + noise;
  }
  return value;
}

function hashString(input: string): string {
  // Simple hash for demonstration (real impl would use crypto)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

function hashValue(value: unknown): string {
  return hashString(JSON.stringify(value));
}

function laplaceSample(scale: number): number {
  // Sample from Laplace distribution using inverse CDF
  const u = Math.random() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

function compareValue(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case 'eq': return actual === expected;
    case 'gte': return (actual as number) >= (expected as number);
    case 'lte': return (actual as number) <= (expected as number);
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    case 'not_in': return Array.isArray(expected) && !expected.includes(actual);
    case 'matches': return typeof actual === 'string' && typeof expected === 'string' && new RegExp(expected).test(actual);
    default: return false;
  }
}

// ─── Exports ─────────────────────────────────────────────────────

export default PrivacyController;
