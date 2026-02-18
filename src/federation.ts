/**
 * Context Federation Protocol
 * 
 * Like SAML/OAuth/OpenID Connect but for AI mental models.
 * Enables cross-domain context sharing where agents from different
 * "organizations" (agent clusters, frameworks, deployments) can
 * collaborate without requiring direct bilateral trust.
 * 
 * Key concepts:
 * - Federation Domain: A group of agents under shared governance
 * - Identity Provider (IdP): Domain authority that attests agent identities
 * - Context Provider (CP): Service that brokers context sharing across domains
 * - Consent Framework: Agents control what context they share and with whom
 * - Attribute Release Policy: Rules governing which context attributes cross domains
 * - Trust Federation: Domains establish mutual trust via metadata exchange
 * 
 * Network analogy: BGP for mental models — autonomous systems (domains)
 * exchange routing information (context) through peering agreements.
 * 
 * Evolution: Gen 6, Instance 28
 * Techniques: G15 (Analogy: OAuth/SAML → context federation),
 *             R05 (Constraint: consent-based attribute release),
 *             G08 (Cross-Domain: bridging agent ecosystems)
 */

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

/** Unique domain identifier */
export type DomainId = string;

/** Unique federation session identifier */
export type FederationSessionId = string;

/** Context attribute categories for release policies */
export type ContextAttributeCategory =
  | 'identity'        // Agent name, role, version
  | 'capabilities'    // What the agent can do
  | 'knowledge'       // Domain knowledge, facts, beliefs
  | 'preferences'     // Communication style, priorities
  | 'history'         // Past collaboration summaries
  | 'trust-scores'    // Trust metrics from other collaborations
  | 'mental-model'    // Full mental model snapshot
  | 'task-context'    // Current task understanding
  | 'custom';         // Extension point

/** Trust level between federated domains */
export enum FederationTrustLevel {
  NONE = 0,           // No trust established
  DISCOVERED = 1,     // Metadata exchanged, not verified
  VERIFIED = 2,       // Cryptographic verification complete
  TRUSTED = 3,        // Successful collaborations recorded
  ALLIED = 4,         // Full mutual trust, streamlined sharing
}

/** Consent decision for attribute release */
export enum ConsentDecision {
  ALLOW = 'allow',
  DENY = 'deny',
  ASK = 'ask',          // Require explicit per-request approval
  ALLOW_ONCE = 'once',  // Allow for this session only
  REDACTED = 'redacted', // Share but with sensitive parts removed
}

/** Federation protocol message types */
export enum FederationMessageType {
  // Discovery
  METADATA_REQUEST = 'metadata_request',
  METADATA_RESPONSE = 'metadata_response',
  
  // Trust establishment
  TRUST_PROPOSAL = 'trust_proposal',
  TRUST_ACCEPTANCE = 'trust_acceptance',
  TRUST_REJECTION = 'trust_rejection',
  
  // Context exchange
  CONTEXT_REQUEST = 'context_request',
  CONTEXT_GRANT = 'context_grant',
  CONTEXT_DENY = 'context_deny',
  
  // Consent
  CONSENT_CHALLENGE = 'consent_challenge',
  CONSENT_RESPONSE = 'consent_response',
  
  // Session management
  SESSION_INITIATE = 'session_initiate',
  SESSION_ACCEPT = 'session_accept',
  SESSION_TERMINATE = 'session_terminate',
  
  // Attribute release
  ATTRIBUTE_OFFER = 'attribute_offer',
  ATTRIBUTE_ACCEPT = 'attribute_accept',
  ATTRIBUTE_REJECT = 'attribute_reject',
}

/** Domain metadata — like SAML metadata XML but for agent domains */
export interface DomainMetadata {
  domainId: DomainId;
  name: string;
  description: string;
  
  /** Domain governance model */
  governance: {
    type: 'centralized' | 'federated' | 'autonomous';
    authority?: string;
    policies: string[];
  };
  
  /** Capabilities this domain's agents collectively offer */
  domainCapabilities: string[];
  
  /** Supported protocol versions */
  protocolVersions: string[];
  
  /** Endpoint for federation messages */
  endpoint: string;
  
  /** Public key for domain-level signatures */
  publicKey: string;
  
  /** Agent count and types */
  agentManifest: {
    totalAgents: number;
    agentTypes: string[];
    specializations: string[];
  };
  
  /** Default attribute release policy for the domain */
  defaultPolicy: AttributeReleasePolicy;
  
  /** When this metadata was last updated */
  lastUpdated: number;
  
  /** Metadata signature for tamper detection */
  signature: string;
}

/** Policy governing what context attributes can cross domain boundaries */
export interface AttributeReleasePolicy {
  policyId: string;
  domainId: DomainId;
  
  /** Per-category default decisions */
  categoryDefaults: Map<ContextAttributeCategory, ConsentDecision>;
  
  /** Specific overrides for particular requesting domains */
  domainOverrides: Map<DomainId, Map<ContextAttributeCategory, ConsentDecision>>;
  
  /** Minimum trust level required for each category */
  trustRequirements: Map<ContextAttributeCategory, FederationTrustLevel>;
  
  /** Maximum detail level per category (0-1, where 1 is full fidelity) */
  detailCaps: Map<ContextAttributeCategory, number>;
  
  /** Time-to-live for shared context (ms) — after which it should be purged */
  contextTTL: number;
  
  /** Whether to allow context to be further shared (transitive sharing) */
  allowTransitiveSharing: boolean;
  
  /** Require explicit consent for first-time sharing with new domains */
  requireExplicitConsent: boolean;
}

/** A context attribute package prepared for cross-domain sharing */
export interface FederatedContextAttribute {
  attributeId: string;
  category: ContextAttributeCategory;
  
  /** The actual context data (potentially redacted) */
  value: unknown;
  
  /** Hash of the full (unredacted) value for integrity verification */
  fullValueHash: string;
  
  /** Detail level (0-1) this was shared at */
  detailLevel: number;
  
  /** Whether this was redacted from the original */
  isRedacted: boolean;
  
  /** Fields that were removed during redaction */
  redactedFields?: string[];
  
  /** Provenance chain — which domains this context has passed through */
  provenance: DomainId[];
  
  /** Expiration timestamp */
  expiresAt: number;
  
  /** Can this be shared transitively? */
  transitiveOk: boolean;
}

/** Federation trust relationship between two domains */
export interface FederationTrust {
  sourceDomain: DomainId;
  targetDomain: DomainId;
  level: FederationTrustLevel;
  
  /** When trust was first established */
  establishedAt: number;
  
  /** When trust level was last changed */
  lastUpdated: number;
  
  /** Number of successful cross-domain collaborations */
  successfulCollaborations: number;
  
  /** Number of failed or problematic collaborations */
  failedCollaborations: number;
  
  /** Running trust score (0-1) based on collaboration history */
  trustScore: number;
  
  /** Specific concerns or notes about this relationship */
  notes: string[];
  
  /** Whether this trust is bidirectional (confirmed by both sides) */
  bidirectional: boolean;
}

/** A cross-domain collaboration session */
export interface FederationSession {
  sessionId: FederationSessionId;
  
  /** Participating domains */
  domains: DomainId[];
  
  /** Which agents from each domain are involved */
  participants: Map<DomainId, string[]>;
  
  /** Shared context attributes (filtered by release policies) */
  sharedContext: Map<DomainId, FederatedContextAttribute[]>;
  
  /** Session state */
  state: 'initiating' | 'negotiating' | 'active' | 'suspending' | 'terminated';
  
  /** Consent records for this session */
  consentLog: ConsentRecord[];
  
  /** Active attribute release policies per domain */
  activePolicies: Map<DomainId, AttributeReleasePolicy>;
  
  /** Session metrics */
  metrics: FederationSessionMetrics;
  
  /** Created timestamp */
  createdAt: number;
  
  /** Last activity timestamp */
  lastActivity: number;
}

/** Record of a consent decision */
export interface ConsentRecord {
  timestamp: number;
  requestingDomain: DomainId;
  providingDomain: DomainId;
  category: ContextAttributeCategory;
  decision: ConsentDecision;
  reason?: string;
  /** Was this an automatic decision (from policy) or manual? */
  automatic: boolean;
}

/** Metrics for a federation session */
export interface FederationSessionMetrics {
  /** Attributes shared per domain */
  attributesShared: Map<DomainId, number>;
  
  /** Attributes denied per domain */
  attributesDenied: Map<DomainId, number>;
  
  /** Consent challenges issued */
  consentChallenges: number;
  
  /** Average detail level of shared attributes */
  averageDetailLevel: number;
  
  /** Total bytes exchanged */
  bytesExchanged: number;
  
  /** Latency of federation operations (ms) */
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
}

/** Federation event for observability */
export interface FederationEvent {
  type: 'domain_discovered' | 'trust_established' | 'trust_upgraded' | 'trust_downgraded'
    | 'session_started' | 'session_ended' | 'context_shared' | 'context_denied'
    | 'consent_granted' | 'consent_denied' | 'policy_violated' | 'context_expired';
  timestamp: number;
  domains: DomainId[];
  details: Record<string, unknown>;
}

export type FederationEventHandler = (event: FederationEvent) => void;

/** Configuration for the federation manager */
export interface FederationConfig {
  /** This domain's metadata */
  localDomain: DomainMetadata;
  
  /** How long to cache remote domain metadata (ms) */
  metadataCacheTTL: number;
  
  /** Maximum concurrent federation sessions */
  maxSessions: number;
  
  /** Default context TTL if not specified by policy (ms) */
  defaultContextTTL: number;
  
  /** Minimum trust level to initiate a session */
  minSessionTrustLevel: FederationTrustLevel;
  
  /** Enable automatic trust upgrades based on collaboration success */
  autoTrustUpgrade: boolean;
  
  /** Threshold for automatic trust upgrade (success rate) */
  trustUpgradeThreshold: number;
  
  /** Enable automatic trust downgrade on failures */
  autoTrustDowngrade: boolean;
  
  /** Threshold for automatic trust downgrade (failure rate) */
  trustDowngradeThreshold: number;
  
  /** Maximum provenance chain length (prevents infinite transitive sharing) */
  maxProvenanceDepth: number;
  
  /** Enable detailed event logging */
  verbose: boolean;
}

// ─────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────

export const DEFAULT_FEDERATION_CONFIG: Partial<FederationConfig> = {
  metadataCacheTTL: 3600_000,        // 1 hour
  maxSessions: 50,
  defaultContextTTL: 86400_000,      // 24 hours
  minSessionTrustLevel: FederationTrustLevel.VERIFIED,
  autoTrustUpgrade: true,
  trustUpgradeThreshold: 0.85,
  autoTrustDowngrade: true,
  trustDowngradeThreshold: 0.30,
  maxProvenanceDepth: 5,
  verbose: false,
};

// ─────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────

/** Generate a unique federation session ID */
function generateFederationSessionId(): FederationSessionId {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `fed_${timestamp}_${random}`;
}

/** Simple hash for context integrity */
function hashValue(value: unknown): string {
  const str = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/** Redact sensitive fields from a context value */
function redactValue(value: unknown, detailLevel: number): { redacted: unknown; removedFields: string[] } {
  if (typeof value !== 'object' || value === null) {
    return { redacted: value, removedFields: [] };
  }
  
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  const removedFields: string[] = [];
  
  // Keep only a proportion of fields based on detail level
  const keepCount = Math.max(1, Math.ceil(keys.length * detailLevel));
  const sortedKeys = [...keys].sort(); // Deterministic ordering
  
  const redacted: Record<string, unknown> = {};
  for (let i = 0; i < sortedKeys.length; i++) {
    if (i < keepCount) {
      redacted[sortedKeys[i]] = obj[sortedKeys[i]];
    } else {
      removedFields.push(sortedKeys[i]);
    }
  }
  
  return { redacted, removedFields };
}

/** Create default attribute release policy for a domain */
export function createDefaultPolicy(domainId: DomainId): AttributeReleasePolicy {
  const categoryDefaults = new Map<ContextAttributeCategory, ConsentDecision>();
  categoryDefaults.set('identity', ConsentDecision.ALLOW);
  categoryDefaults.set('capabilities', ConsentDecision.ALLOW);
  categoryDefaults.set('knowledge', ConsentDecision.ASK);
  categoryDefaults.set('preferences', ConsentDecision.ALLOW);
  categoryDefaults.set('history', ConsentDecision.REDACTED);
  categoryDefaults.set('trust-scores', ConsentDecision.DENY);
  categoryDefaults.set('mental-model', ConsentDecision.ASK);
  categoryDefaults.set('task-context', ConsentDecision.ALLOW_ONCE);
  categoryDefaults.set('custom', ConsentDecision.ASK);
  
  const trustRequirements = new Map<ContextAttributeCategory, FederationTrustLevel>();
  trustRequirements.set('identity', FederationTrustLevel.DISCOVERED);
  trustRequirements.set('capabilities', FederationTrustLevel.DISCOVERED);
  trustRequirements.set('knowledge', FederationTrustLevel.VERIFIED);
  trustRequirements.set('preferences', FederationTrustLevel.DISCOVERED);
  trustRequirements.set('history', FederationTrustLevel.TRUSTED);
  trustRequirements.set('trust-scores', FederationTrustLevel.ALLIED);
  trustRequirements.set('mental-model', FederationTrustLevel.TRUSTED);
  trustRequirements.set('task-context', FederationTrustLevel.VERIFIED);
  trustRequirements.set('custom', FederationTrustLevel.VERIFIED);
  
  const detailCaps = new Map<ContextAttributeCategory, number>();
  detailCaps.set('identity', 1.0);
  detailCaps.set('capabilities', 1.0);
  detailCaps.set('knowledge', 0.7);
  detailCaps.set('preferences', 0.8);
  detailCaps.set('history', 0.5);
  detailCaps.set('trust-scores', 0.3);
  detailCaps.set('mental-model', 0.6);
  detailCaps.set('task-context', 0.9);
  detailCaps.set('custom', 0.5);
  
  return {
    policyId: `policy_${domainId}_default`,
    domainId,
    categoryDefaults,
    domainOverrides: new Map(),
    trustRequirements,
    detailCaps,
    contextTTL: 86400_000,
    allowTransitiveSharing: false,
    requireExplicitConsent: true,
  };
}

// ─────────────────────────────────────────────────────
// Domain Registry
// ─────────────────────────────────────────────────────

/**
 * Registry of known federation domains.
 * Like a DNS registry but for agent domains.
 */
export class DomainRegistry {
  private domains = new Map<DomainId, DomainMetadata>();
  private metadataTimestamps = new Map<DomainId, number>();
  private cacheTTL: number;
  
  constructor(cacheTTL: number = 3600_000) {
    this.cacheTTL = cacheTTL;
  }
  
  /** Register or update a domain's metadata */
  register(metadata: DomainMetadata): void {
    this.domains.set(metadata.domainId, metadata);
    this.metadataTimestamps.set(metadata.domainId, Date.now());
  }
  
  /** Look up a domain by ID */
  lookup(domainId: DomainId): DomainMetadata | undefined {
    const timestamp = this.metadataTimestamps.get(domainId);
    if (timestamp && Date.now() - timestamp > this.cacheTTL) {
      // Stale metadata — still return it but flag for refresh
      const metadata = this.domains.get(domainId);
      if (metadata) {
        return { ...metadata, _stale: true } as DomainMetadata & { _stale: boolean };
      }
    }
    return this.domains.get(domainId);
  }
  
  /** Find domains matching capability requirements */
  findByCapabilities(required: string[]): DomainMetadata[] {
    const results: DomainMetadata[] = [];
    for (const metadata of this.domains.values()) {
      const matches = required.filter(cap => 
        metadata.domainCapabilities.includes(cap)
      );
      if (matches.length === required.length) {
        results.push(metadata);
      }
    }
    return results;
  }
  
  /** Find domains matching specializations */
  findBySpecialization(specialization: string): DomainMetadata[] {
    return Array.from(this.domains.values()).filter(m =>
      m.agentManifest.specializations.includes(specialization)
    );
  }
  
  /** Get all registered domains */
  listAll(): DomainMetadata[] {
    return Array.from(this.domains.values());
  }
  
  /** Remove a domain */
  remove(domainId: DomainId): boolean {
    this.metadataTimestamps.delete(domainId);
    return this.domains.delete(domainId);
  }
  
  /** Purge stale entries */
  purgeStale(): number {
    let purged = 0;
    const now = Date.now();
    for (const [id, timestamp] of this.metadataTimestamps) {
      if (now - timestamp > this.cacheTTL * 3) { // 3x TTL = hard purge
        this.domains.delete(id);
        this.metadataTimestamps.delete(id);
        purged++;
      }
    }
    return purged;
  }
}

// ─────────────────────────────────────────────────────
// Trust Federation Manager
// ─────────────────────────────────────────────────────

/**
 * Manages trust relationships between domains.
 * Like BGP peering — domains establish and maintain trust through
 * successful collaboration history.
 */
export class TrustFederationManager {
  private trusts = new Map<string, FederationTrust>();
  private config: FederationConfig;
  private onEvent: FederationEventHandler;
  
  constructor(config: FederationConfig, onEvent: FederationEventHandler = () => {}) {
    this.config = config;
    this.onEvent = onEvent;
  }
  
  /** Get the trust key for a domain pair (sorted for bidirectional) */
  private trustKey(domainA: DomainId, domainB: DomainId): string {
    return [domainA, domainB].sort().join('↔');
  }
  
  /** Get directional trust key */
  private directionalKey(from: DomainId, to: DomainId): string {
    return `${from}→${to}`;
  }
  
  /** Propose trust to another domain */
  proposeTrust(targetDomain: DomainId, initialLevel: FederationTrustLevel = FederationTrustLevel.DISCOVERED): FederationTrust {
    const key = this.directionalKey(this.config.localDomain.domainId, targetDomain);
    
    const trust: FederationTrust = {
      sourceDomain: this.config.localDomain.domainId,
      targetDomain,
      level: initialLevel,
      establishedAt: Date.now(),
      lastUpdated: Date.now(),
      successfulCollaborations: 0,
      failedCollaborations: 0,
      trustScore: 0.5, // Neutral starting point
      notes: [],
      bidirectional: false,
    };
    
    this.trusts.set(key, trust);
    
    this.onEvent({
      type: 'trust_established',
      timestamp: Date.now(),
      domains: [this.config.localDomain.domainId, targetDomain],
      details: { level: initialLevel, direction: 'outbound' },
    });
    
    return trust;
  }
  
  /** Accept trust proposal from another domain */
  acceptTrust(sourceDomain: DomainId, level: FederationTrustLevel): FederationTrust {
    const inboundKey = this.directionalKey(sourceDomain, this.config.localDomain.domainId);
    const outboundKey = this.directionalKey(this.config.localDomain.domainId, sourceDomain);
    
    // Create inbound trust record
    const inboundTrust: FederationTrust = {
      sourceDomain,
      targetDomain: this.config.localDomain.domainId,
      level,
      establishedAt: Date.now(),
      lastUpdated: Date.now(),
      successfulCollaborations: 0,
      failedCollaborations: 0,
      trustScore: 0.5,
      notes: [],
      bidirectional: false,
    };
    
    this.trusts.set(inboundKey, inboundTrust);
    
    // Check if we also have outbound trust → mark both as bidirectional
    const outboundTrust = this.trusts.get(outboundKey);
    if (outboundTrust) {
      outboundTrust.bidirectional = true;
      inboundTrust.bidirectional = true;
      outboundTrust.lastUpdated = Date.now();
    }
    
    this.onEvent({
      type: 'trust_established',
      timestamp: Date.now(),
      domains: [sourceDomain, this.config.localDomain.domainId],
      details: { level, direction: 'inbound', bidirectional: inboundTrust.bidirectional },
    });
    
    return inboundTrust;
  }
  
  /** Get trust level for a domain */
  getTrustLevel(domainId: DomainId): FederationTrustLevel {
    // Check both directions
    const outbound = this.trusts.get(
      this.directionalKey(this.config.localDomain.domainId, domainId)
    );
    const inbound = this.trusts.get(
      this.directionalKey(domainId, this.config.localDomain.domainId)
    );
    
    // Use the higher of the two trust levels
    const outLevel = outbound?.level ?? FederationTrustLevel.NONE;
    const inLevel = inbound?.level ?? FederationTrustLevel.NONE;
    
    return Math.max(outLevel, inLevel) as FederationTrustLevel;
  }
  
  /** Get full trust record for a domain */
  getTrust(domainId: DomainId): FederationTrust | undefined {
    return this.trusts.get(
      this.directionalKey(this.config.localDomain.domainId, domainId)
    ) ?? this.trusts.get(
      this.directionalKey(domainId, this.config.localDomain.domainId)
    );
  }
  
  /** Record a collaboration outcome and potentially adjust trust */
  recordCollaboration(domainId: DomainId, success: boolean, notes?: string): void {
    const outbound = this.trusts.get(
      this.directionalKey(this.config.localDomain.domainId, domainId)
    );
    const inbound = this.trusts.get(
      this.directionalKey(domainId, this.config.localDomain.domainId)
    );
    
    const records = [outbound, inbound].filter(Boolean) as FederationTrust[];
    
    for (const trust of records) {
      if (success) {
        trust.successfulCollaborations++;
      } else {
        trust.failedCollaborations++;
      }
      
      if (notes) {
        trust.notes.push(`[${new Date().toISOString()}] ${notes}`);
        // Keep only last 20 notes
        if (trust.notes.length > 20) {
          trust.notes = trust.notes.slice(-20);
        }
      }
      
      // Recalculate trust score
      const total = trust.successfulCollaborations + trust.failedCollaborations;
      trust.trustScore = total > 0 ? trust.successfulCollaborations / total : 0.5;
      trust.lastUpdated = Date.now();
      
      // Auto trust adjustment
      if (this.config.autoTrustUpgrade && trust.trustScore >= this.config.trustUpgradeThreshold && total >= 5) {
        const maxLevel = FederationTrustLevel.ALLIED;
        if (trust.level < maxLevel) {
          const oldLevel = trust.level;
          trust.level = Math.min(trust.level + 1, maxLevel) as FederationTrustLevel;
          this.onEvent({
            type: 'trust_upgraded',
            timestamp: Date.now(),
            domains: [trust.sourceDomain, trust.targetDomain],
            details: { from: oldLevel, to: trust.level, score: trust.trustScore },
          });
        }
      }
      
      if (this.config.autoTrustDowngrade && trust.trustScore <= this.config.trustDowngradeThreshold && total >= 3) {
        const minLevel = FederationTrustLevel.NONE;
        if (trust.level > minLevel) {
          const oldLevel = trust.level;
          trust.level = Math.max(trust.level - 1, minLevel) as FederationTrustLevel;
          this.onEvent({
            type: 'trust_downgraded',
            timestamp: Date.now(),
            domains: [trust.sourceDomain, trust.targetDomain],
            details: { from: oldLevel, to: trust.level, score: trust.trustScore },
          });
        }
      }
    }
  }
  
  /** Get all trust relationships */
  getAllTrusts(): FederationTrust[] {
    return Array.from(this.trusts.values());
  }
  
  /** Get domains at or above a given trust level */
  getTrustedDomains(minLevel: FederationTrustLevel): DomainId[] {
    const domains = new Set<DomainId>();
    for (const trust of this.trusts.values()) {
      if (trust.level >= minLevel) {
        if (trust.sourceDomain !== this.config.localDomain.domainId) {
          domains.add(trust.sourceDomain);
        }
        if (trust.targetDomain !== this.config.localDomain.domainId) {
          domains.add(trust.targetDomain);
        }
      }
    }
    return Array.from(domains);
  }
}

// ─────────────────────────────────────────────────────
// Consent Engine
// ─────────────────────────────────────────────────────

/**
 * Manages consent decisions for cross-domain context sharing.
 * Ensures agents maintain sovereignty over their context data.
 */
export class ConsentEngine {
  private log: ConsentRecord[] = [];
  private pendingConsent = new Map<string, {
    resolve: (decision: ConsentDecision) => void;
    timeout: ReturnType<typeof setTimeout>;
    request: { requestingDomain: DomainId; category: ContextAttributeCategory };
  }>();
  
  /** Prompt handler for manual consent decisions */
  private consentPromptHandler?: (
    requestingDomain: DomainId,
    category: ContextAttributeCategory,
    context: Record<string, unknown>
  ) => Promise<ConsentDecision>;
  
  constructor(
    promptHandler?: (
      requestingDomain: DomainId,
      category: ContextAttributeCategory,
      context: Record<string, unknown>
    ) => Promise<ConsentDecision>
  ) {
    this.consentPromptHandler = promptHandler;
  }
  
  /** Evaluate consent for an attribute release based on policy */
  async evaluate(
    policy: AttributeReleasePolicy,
    requestingDomain: DomainId,
    category: ContextAttributeCategory,
    trustLevel: FederationTrustLevel
  ): Promise<ConsentDecision> {
    // Check trust requirement first
    const requiredTrust = policy.trustRequirements.get(category) ?? FederationTrustLevel.VERIFIED;
    if (trustLevel < requiredTrust) {
      const record: ConsentRecord = {
        timestamp: Date.now(),
        requestingDomain,
        providingDomain: policy.domainId,
        category,
        decision: ConsentDecision.DENY,
        reason: `Trust level ${trustLevel} below required ${requiredTrust}`,
        automatic: true,
      };
      this.log.push(record);
      return ConsentDecision.DENY;
    }
    
    // Check domain-specific override
    const domainOverride = policy.domainOverrides.get(requestingDomain);
    if (domainOverride) {
      const override = domainOverride.get(category);
      if (override && override !== ConsentDecision.ASK) {
        const record: ConsentRecord = {
          timestamp: Date.now(),
          requestingDomain,
          providingDomain: policy.domainId,
          category,
          decision: override,
          reason: 'Domain-specific override',
          automatic: true,
        };
        this.log.push(record);
        return override;
      }
    }
    
    // Check category default
    const defaultDecision = policy.categoryDefaults.get(category) ?? ConsentDecision.ASK;
    
    if (defaultDecision !== ConsentDecision.ASK) {
      const record: ConsentRecord = {
        timestamp: Date.now(),
        requestingDomain,
        providingDomain: policy.domainId,
        category,
        decision: defaultDecision,
        reason: 'Category default policy',
        automatic: true,
      };
      this.log.push(record);
      return defaultDecision;
    }
    
    // Need manual consent — invoke prompt handler
    if (this.consentPromptHandler) {
      const decision = await this.consentPromptHandler(requestingDomain, category, {
        trustLevel,
        policyId: policy.policyId,
      });
      
      const record: ConsentRecord = {
        timestamp: Date.now(),
        requestingDomain,
        providingDomain: policy.domainId,
        category,
        decision,
        reason: 'Manual consent decision',
        automatic: false,
      };
      this.log.push(record);
      return decision;
    }
    
    // No prompt handler — default deny for safety
    const record: ConsentRecord = {
      timestamp: Date.now(),
      requestingDomain,
      providingDomain: policy.domainId,
      category,
      decision: ConsentDecision.DENY,
      reason: 'No consent handler available, defaulting to deny',
      automatic: true,
    };
    this.log.push(record);
    return ConsentDecision.DENY;
  }
  
  /** Get consent log */
  getLog(): ConsentRecord[] {
    return [...this.log];
  }
  
  /** Get consent stats */
  getStats(): { total: number; allowed: number; denied: number; redacted: number; manual: number } {
    return {
      total: this.log.length,
      allowed: this.log.filter(r => r.decision === ConsentDecision.ALLOW || r.decision === ConsentDecision.ALLOW_ONCE).length,
      denied: this.log.filter(r => r.decision === ConsentDecision.DENY).length,
      redacted: this.log.filter(r => r.decision === ConsentDecision.REDACTED).length,
      manual: this.log.filter(r => !r.automatic).length,
    };
  }
}

// ─────────────────────────────────────────────────────
// Context Broker
// ─────────────────────────────────────────────────────

/**
 * Brokers context exchange between federated domains.
 * Applies attribute release policies, handles redaction,
 * manages provenance chains, and enforces TTLs.
 */
export class ContextBroker {
  private config: FederationConfig;
  private consentEngine: ConsentEngine;
  private trustManager: TrustFederationManager;
  private onEvent: FederationEventHandler;
  
  /** Cache of prepared context attributes */
  private attributeCache = new Map<string, { attribute: FederatedContextAttribute; cachedAt: number }>();
  
  constructor(
    config: FederationConfig,
    consentEngine: ConsentEngine,
    trustManager: TrustFederationManager,
    onEvent: FederationEventHandler = () => {}
  ) {
    this.config = config;
    this.consentEngine = consentEngine;
    this.trustManager = trustManager;
    this.onEvent = onEvent;
  }
  
  /**
   * Prepare a context attribute for cross-domain sharing.
   * Applies consent checks, detail level caps, redaction, and provenance.
   */
  async prepareAttribute(
    category: ContextAttributeCategory,
    value: unknown,
    requestingDomain: DomainId,
    policy: AttributeReleasePolicy
  ): Promise<FederatedContextAttribute | null> {
    // Evaluate consent
    const trustLevel = this.trustManager.getTrustLevel(requestingDomain);
    const consent = await this.consentEngine.evaluate(policy, requestingDomain, category, trustLevel);
    
    if (consent === ConsentDecision.DENY) {
      this.onEvent({
        type: 'context_denied',
        timestamp: Date.now(),
        domains: [this.config.localDomain.domainId, requestingDomain],
        details: { category, reason: 'consent_denied' },
      });
      return null;
    }
    
    // Determine detail level
    const maxDetail = policy.detailCaps.get(category) ?? 0.5;
    
    // Redact if needed
    let finalValue = value;
    let isRedacted = false;
    let redactedFields: string[] | undefined;
    
    if (consent === ConsentDecision.REDACTED || maxDetail < 1.0) {
      const result = redactValue(value, maxDetail);
      finalValue = result.redacted;
      isRedacted = result.removedFields.length > 0;
      redactedFields = result.removedFields.length > 0 ? result.removedFields : undefined;
    }
    
    const attribute: FederatedContextAttribute = {
      attributeId: `attr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      category,
      value: finalValue,
      fullValueHash: hashValue(value),
      detailLevel: maxDetail,
      isRedacted,
      redactedFields,
      provenance: [this.config.localDomain.domainId],
      expiresAt: Date.now() + (policy.contextTTL || this.config.defaultContextTTL),
      transitiveOk: policy.allowTransitiveSharing,
    };
    
    this.onEvent({
      type: 'context_shared',
      timestamp: Date.now(),
      domains: [this.config.localDomain.domainId, requestingDomain],
      details: { category, detailLevel: maxDetail, isRedacted, attributeId: attribute.attributeId },
    });
    
    return attribute;
  }
  
  /**
   * Validate a received federated attribute.
   * Checks provenance depth, expiration, and transitive sharing rules.
   */
  validateAttribute(attribute: FederatedContextAttribute): { valid: boolean; reason?: string } {
    // Check expiration
    if (Date.now() > attribute.expiresAt) {
      return { valid: false, reason: 'Attribute has expired' };
    }
    
    // Check provenance depth
    if (attribute.provenance.length > this.config.maxProvenanceDepth) {
      return { valid: false, reason: `Provenance chain too deep (${attribute.provenance.length} > ${this.config.maxProvenanceDepth})` };
    }
    
    // Check for circular provenance
    const uniqueDomains = new Set(attribute.provenance);
    if (uniqueDomains.size < attribute.provenance.length) {
      return { valid: false, reason: 'Circular provenance detected' };
    }
    
    // Check transitive sharing permission
    if (attribute.provenance.length > 1 && !attribute.transitiveOk) {
      return { valid: false, reason: 'Transitive sharing not permitted for this attribute' };
    }
    
    return { valid: true };
  }
  
  /**
   * Forward a received attribute to another domain (transitive sharing).
   * Adds local domain to provenance chain and validates permissions.
   */
  forwardAttribute(
    attribute: FederatedContextAttribute,
    targetDomain: DomainId
  ): FederatedContextAttribute | null {
    if (!attribute.transitiveOk) {
      return null;
    }
    
    // Add ourselves to provenance
    const forwarded: FederatedContextAttribute = {
      ...attribute,
      provenance: [...attribute.provenance, this.config.localDomain.domainId],
    };
    
    // Validate the forwarded version
    const validation = this.validateAttribute(forwarded);
    if (!validation.valid) {
      return null;
    }
    
    return forwarded;
  }
  
  /** Purge expired attributes from cache */
  purgeExpired(): number {
    let purged = 0;
    const now = Date.now();
    for (const [key, entry] of this.attributeCache) {
      if (now > entry.attribute.expiresAt) {
        this.attributeCache.delete(key);
        purged++;
        this.onEvent({
          type: 'context_expired',
          timestamp: now,
          domains: [this.config.localDomain.domainId],
          details: { attributeId: entry.attribute.attributeId, category: entry.attribute.category },
        });
      }
    }
    return purged;
  }
}

// ─────────────────────────────────────────────────────
// Federation Session Manager
// ─────────────────────────────────────────────────────

/**
 * Manages cross-domain collaboration sessions.
 * Like an OAuth session but for ongoing multi-agent collaboration.
 */
export class FederationSessionManager {
  private sessions = new Map<FederationSessionId, FederationSession>();
  private config: FederationConfig;
  private trustManager: TrustFederationManager;
  private contextBroker: ContextBroker;
  private onEvent: FederationEventHandler;
  
  constructor(
    config: FederationConfig,
    trustManager: TrustFederationManager,
    contextBroker: ContextBroker,
    onEvent: FederationEventHandler = () => {}
  ) {
    this.config = config;
    this.trustManager = trustManager;
    this.contextBroker = contextBroker;
    this.onEvent = onEvent;
  }
  
  /** Initiate a federation session with other domains */
  async initiate(
    targetDomains: DomainId[],
    localAgents: string[],
    initialContext: Map<ContextAttributeCategory, unknown>
  ): Promise<FederationSession | { error: string }> {
    // Check we're not exceeding session limits
    if (this.sessions.size >= this.config.maxSessions) {
      return { error: `Maximum sessions (${this.config.maxSessions}) reached` };
    }
    
    // Verify minimum trust with all target domains
    for (const domain of targetDomains) {
      const trustLevel = this.trustManager.getTrustLevel(domain);
      if (trustLevel < this.config.minSessionTrustLevel) {
        return {
          error: `Insufficient trust with domain ${domain}: ${trustLevel} < ${this.config.minSessionTrustLevel}`,
        };
      }
    }
    
    const sessionId = generateFederationSessionId();
    const now = Date.now();
    
    // Prepare shared context through the broker
    const localPolicy = this.config.localDomain.defaultPolicy;
    const sharedAttributes: FederatedContextAttribute[] = [];
    
    for (const [category, value] of initialContext) {
      // Prepare for each target domain
      for (const targetDomain of targetDomains) {
        const attribute = await this.contextBroker.prepareAttribute(
          category, value, targetDomain, localPolicy
        );
        if (attribute) {
          sharedAttributes.push(attribute);
        }
      }
    }
    
    // Build participants map
    const participants = new Map<DomainId, string[]>();
    participants.set(this.config.localDomain.domainId, localAgents);
    for (const domain of targetDomains) {
      participants.set(domain, []); // Populated when they accept
    }
    
    // Build shared context map
    const sharedContext = new Map<DomainId, FederatedContextAttribute[]>();
    sharedContext.set(this.config.localDomain.domainId, sharedAttributes);
    
    // Build active policies map
    const activePolicies = new Map<DomainId, AttributeReleasePolicy>();
    activePolicies.set(this.config.localDomain.domainId, localPolicy);
    
    const session: FederationSession = {
      sessionId,
      domains: [this.config.localDomain.domainId, ...targetDomains],
      participants,
      sharedContext,
      state: 'initiating',
      consentLog: [],
      activePolicies,
      metrics: {
        attributesShared: new Map([[this.config.localDomain.domainId, sharedAttributes.length]]),
        attributesDenied: new Map(),
        consentChallenges: 0,
        averageDetailLevel: sharedAttributes.length > 0
          ? sharedAttributes.reduce((sum, a) => sum + a.detailLevel, 0) / sharedAttributes.length
          : 0,
        bytesExchanged: 0,
        latencyP50: 0,
        latencyP95: 0,
        latencyP99: 0,
      },
      createdAt: now,
      lastActivity: now,
    };
    
    this.sessions.set(sessionId, session);
    
    this.onEvent({
      type: 'session_started',
      timestamp: now,
      domains: session.domains,
      details: { sessionId, attributesShared: sharedAttributes.length },
    });
    
    return session;
  }
  
  /** Accept a federation session invite and share local context */
  async accept(
    sessionId: FederationSessionId,
    localAgents: string[],
    localContext: Map<ContextAttributeCategory, unknown>,
    localPolicy: AttributeReleasePolicy
  ): Promise<FederationSession | { error: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { error: `Session ${sessionId} not found` };
    }
    
    if (session.state !== 'initiating' && session.state !== 'negotiating') {
      return { error: `Session in invalid state: ${session.state}` };
    }
    
    const localDomain = this.config.localDomain.domainId;
    
    // Add our agents
    session.participants.set(localDomain, localAgents);
    
    // Share our context
    const sharedAttributes: FederatedContextAttribute[] = [];
    for (const [category, value] of localContext) {
      for (const domain of session.domains) {
        if (domain === localDomain) continue;
        const attribute = await this.contextBroker.prepareAttribute(
          category, value, domain, localPolicy
        );
        if (attribute) {
          sharedAttributes.push(attribute);
        }
      }
    }
    
    session.sharedContext.set(localDomain, sharedAttributes);
    session.activePolicies.set(localDomain, localPolicy);
    session.metrics.attributesShared.set(localDomain, sharedAttributes.length);
    
    // Check if all domains have accepted
    const allAccepted = session.domains.every(d => {
      const agents = session.participants.get(d);
      return agents && agents.length > 0;
    });
    
    session.state = allAccepted ? 'active' : 'negotiating';
    session.lastActivity = Date.now();
    
    return session;
  }
  
  /** Terminate a federation session */
  terminate(sessionId: FederationSessionId, reason?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.state = 'terminated';
    session.lastActivity = Date.now();
    
    // Record collaboration outcome in trust
    for (const domain of session.domains) {
      if (domain !== this.config.localDomain.domainId) {
        const success = reason !== 'failure' && reason !== 'violation';
        this.trustManager.recordCollaboration(domain, success, reason);
      }
    }
    
    this.onEvent({
      type: 'session_ended',
      timestamp: Date.now(),
      domains: session.domains,
      details: { sessionId, reason, metrics: this.serializeMetrics(session.metrics) },
    });
    
    return true;
  }
  
  /** Get a session by ID */
  getSession(sessionId: FederationSessionId): FederationSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  /** List active sessions */
  getActiveSessions(): FederationSession[] {
    return Array.from(this.sessions.values()).filter(s => s.state === 'active');
  }
  
  /** Get all sessions involving a specific domain */
  getSessionsByDomain(domainId: DomainId): FederationSession[] {
    return Array.from(this.sessions.values()).filter(s => s.domains.includes(domainId));
  }
  
  /** Serialize metrics for events (Map → object) */
  private serializeMetrics(metrics: FederationSessionMetrics): Record<string, unknown> {
    return {
      attributesShared: Object.fromEntries(metrics.attributesShared),
      attributesDenied: Object.fromEntries(metrics.attributesDenied),
      consentChallenges: metrics.consentChallenges,
      averageDetailLevel: metrics.averageDetailLevel,
      bytesExchanged: metrics.bytesExchanged,
    };
  }
}

// ─────────────────────────────────────────────────────
// Unified Federation Manager
// ─────────────────────────────────────────────────────

/**
 * Top-level manager that ties together all federation components.
 * Entry point for cross-domain agent collaboration.
 * 
 * Usage:
 * ```typescript
 * const fed = createFederationManager({
 *   localDomain: myDomainMetadata,
 *   // ... config
 * });
 * 
 * // Discover another domain
 * fed.discoverDomain(remoteDomainMetadata);
 * 
 * // Establish trust
 * fed.proposeTrust(remoteDomainId);
 * 
 * // Start a federated session
 * const session = await fed.initiateFederatedSession(
 *   [remoteDomainId],
 *   ['agent-1'],
 *   contextToShare
 * );
 * ```
 */
export class FederationManager {
  readonly registry: DomainRegistry;
  readonly trust: TrustFederationManager;
  readonly consent: ConsentEngine;
  readonly broker: ContextBroker;
  readonly sessions: FederationSessionManager;
  
  private config: FederationConfig;
  private eventLog: FederationEvent[] = [];
  private eventHandlers: FederationEventHandler[] = [];
  
  constructor(config: FederationConfig) {
    this.config = { ...DEFAULT_FEDERATION_CONFIG, ...config } as FederationConfig;
    
    const eventDispatcher: FederationEventHandler = (event) => {
      this.eventLog.push(event);
      // Keep last 1000 events
      if (this.eventLog.length > 1000) {
        this.eventLog = this.eventLog.slice(-1000);
      }
      for (const handler of this.eventHandlers) {
        try { handler(event); } catch { /* swallow handler errors */ }
      }
    };
    
    this.registry = new DomainRegistry(this.config.metadataCacheTTL);
    this.trust = new TrustFederationManager(this.config, eventDispatcher);
    this.consent = new ConsentEngine();
    this.broker = new ContextBroker(this.config, this.consent, this.trust, eventDispatcher);
    this.sessions = new FederationSessionManager(this.config, this.trust, this.broker, eventDispatcher);
    
    // Register ourselves
    this.registry.register(this.config.localDomain);
  }
  
  /** Register an event handler */
  onEvent(handler: FederationEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }
  
  /** Discover and register a remote domain */
  discoverDomain(metadata: DomainMetadata): void {
    this.registry.register(metadata);
  }
  
  /** Propose trust to a domain */
  proposeTrust(domainId: DomainId, level?: FederationTrustLevel): FederationTrust {
    return this.trust.proposeTrust(domainId, level);
  }
  
  /** Accept trust from a domain */
  acceptTrust(domainId: DomainId, level: FederationTrustLevel): FederationTrust {
    return this.trust.acceptTrust(domainId, level);
  }
  
  /** Initiate a cross-domain collaboration */
  async initiateFederatedSession(
    targetDomains: DomainId[],
    localAgents: string[],
    context: Map<ContextAttributeCategory, unknown>
  ): Promise<FederationSession | { error: string }> {
    return this.sessions.initiate(targetDomains, localAgents, context);
  }
  
  /** Accept a federation session invite */
  async acceptSession(
    sessionId: FederationSessionId,
    localAgents: string[],
    context: Map<ContextAttributeCategory, unknown>,
    policy?: AttributeReleasePolicy
  ): Promise<FederationSession | { error: string }> {
    const effectivePolicy = policy ?? this.config.localDomain.defaultPolicy;
    return this.sessions.accept(sessionId, localAgents, context, effectivePolicy);
  }
  
  /** End a federation session */
  terminateSession(sessionId: FederationSessionId, reason?: string): boolean {
    return this.sessions.terminate(sessionId, reason);
  }
  
  /** Find domains that can help with specific capabilities */
  findDomains(capabilities: string[]): DomainMetadata[] {
    return this.registry.findByCapabilities(capabilities);
  }
  
  /** Get recent federation events */
  getEventLog(limit: number = 50): FederationEvent[] {
    return this.eventLog.slice(-limit);
  }
  
  /** Get federation health summary */
  getHealth(): {
    registeredDomains: number;
    trustedDomains: number;
    activeSessions: number;
    consentStats: ReturnType<ConsentEngine['getStats']>;
    recentEvents: number;
  } {
    return {
      registeredDomains: this.registry.listAll().length,
      trustedDomains: this.trust.getTrustedDomains(FederationTrustLevel.VERIFIED).length,
      activeSessions: this.sessions.getActiveSessions().length,
      consentStats: this.consent.getStats(),
      recentEvents: this.eventLog.length,
    };
  }
}

// ─────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────

/** Create a federation manager with sensible defaults */
export function createFederationManager(
  config: Partial<FederationConfig> & { localDomain: DomainMetadata }
): FederationManager {
  const fullConfig: FederationConfig = {
    ...DEFAULT_FEDERATION_CONFIG,
    ...config,
  } as FederationConfig;
  
  return new FederationManager(fullConfig);
}

/** Create domain metadata quickly */
export function createDomainMetadata(
  id: DomainId,
  name: string,
  opts: {
    description?: string;
    capabilities?: string[];
    specializations?: string[];
    endpoint?: string;
    governance?: DomainMetadata['governance'];
  } = {}
): DomainMetadata {
  return {
    domainId: id,
    name,
    description: opts.description ?? `${name} agent domain`,
    governance: opts.governance ?? { type: 'autonomous', policies: ['default'] },
    domainCapabilities: opts.capabilities ?? [],
    protocolVersions: ['1.0'],
    endpoint: opts.endpoint ?? `federation://${id}`,
    publicKey: `pk_${id}_${Date.now().toString(36)}`, // Placeholder
    agentManifest: {
      totalAgents: 1,
      agentTypes: ['general'],
      specializations: opts.specializations ?? [],
    },
    defaultPolicy: createDefaultPolicy(id),
    lastUpdated: Date.now(),
    signature: hashValue({ id, name, ts: Date.now() }),
  };
}

// ─────────────────────────────────────────────────────
// Demo / Visualization
// ─────────────────────────────────────────────────────

/** Demonstrate the federation protocol */
export async function demoFederation(): Promise<string> {
  const lines: string[] = [];
  const log = (msg: string) => lines.push(msg);
  
  log('═══════════════════════════════════════════');
  log('   Context Federation Protocol Demo');
  log('   BGP for Mental Models');
  log('═══════════════════════════════════════════');
  log('');
  
  // Create two domains
  const domainA = createDomainMetadata('clawdbot-main', 'Clawdbot Main', {
    capabilities: ['code', 'research', 'planning'],
    specializations: ['typescript', 'devops'],
  });
  
  const domainB = createDomainMetadata('research-cluster', 'Research Cluster', {
    capabilities: ['research', 'analysis', 'synthesis'],
    specializations: ['ml', 'data-science'],
  });
  
  log('📍 Domain A: ' + domainA.name);
  log('   Capabilities: ' + domainA.domainCapabilities.join(', '));
  log('📍 Domain B: ' + domainB.name);
  log('   Capabilities: ' + domainB.domainCapabilities.join(', '));
  log('');
  
  // Create federation manager for Domain A
  const fedA = createFederationManager({ localDomain: domainA });
  
  // Track events
  fedA.onEvent((event) => {
    log(`  📡 [${event.type}] ${event.domains.join(' ↔ ')}`);
  });
  
  // Discovery
  log('🔍 Step 1: Domain Discovery');
  fedA.discoverDomain(domainB);
  log('   Domain B registered in Domain A\'s registry');
  log('');
  
  // Trust establishment
  log('🤝 Step 2: Trust Establishment');
  fedA.proposeTrust('research-cluster', FederationTrustLevel.VERIFIED);
  fedA.acceptTrust('research-cluster', FederationTrustLevel.VERIFIED);
  log('   Bidirectional trust established at VERIFIED level');
  log('');
  
  // Start session
  log('🚀 Step 3: Federated Session');
  const context = new Map<ContextAttributeCategory, unknown>();
  context.set('identity', { name: 'clawd-main', role: 'orchestrator' });
  context.set('capabilities', { skills: ['typescript', 'planning'], tools: ['browser', 'exec'] });
  context.set('task-context', { task: 'Research ML optimization techniques', priority: 'high' });
  
  const session = await fedA.initiateFederatedSession(
    ['research-cluster'],
    ['clawd-main'],
    context
  );
  
  if ('error' in session) {
    log('   ❌ Session failed: ' + session.error);
  } else {
    log('   ✅ Session ' + session.sessionId + ' created');
    log('   State: ' + session.state);
    
    const localAttrs = session.sharedContext.get('clawdbot-main') ?? [];
    log('   Attributes shared: ' + localAttrs.length);
    
    for (const attr of localAttrs) {
      log(`     • ${attr.category}: detail=${attr.detailLevel}, redacted=${attr.isRedacted}`);
    }
  }
  
  log('');
  
  // Health check
  log('💚 Federation Health:');
  const health = fedA.getHealth();
  log(`   Registered domains: ${health.registeredDomains}`);
  log(`   Trusted domains: ${health.trustedDomains}`);
  log(`   Active sessions: ${health.activeSessions}`);
  log(`   Consent: ${health.consentStats.allowed} allowed, ${health.consentStats.denied} denied`);
  
  log('');
  log('═══════════════════════════════════════════');
  log('  "Like BGP peers exchanging routes,');
  log('   federated agents exchange mental models');
  log('   — but only what policy allows."');
  log('═══════════════════════════════════════════');
  
  return lines.join('\n');
}
