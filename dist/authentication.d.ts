/**
 * Authentication & Verification for Context Handshakes
 *
 * Like mTLS for AI minds — verify identity and capabilities before
 * trusting another agent's context. Prevents impersonation, ensures
 * capability claims are genuine, and builds cryptographic trust chains.
 *
 * HEF Evolution Gen 6 | Instance 28
 * Task ID: task_20260201214048_208fbc
 *
 * Evolution techniques: G07 (Analogy Mining - mTLS/PKI), R08 (Integrate),
 * S04 (Cross-Domain Transfer)
 */
/**
 * Agent identity with cryptographic backing
 */
export interface AgentIdentity {
    /** Unique agent identifier */
    id: string;
    /** Human-readable name */
    name: string;
    /** Agent type/role */
    type: 'orchestrator' | 'specialist' | 'worker' | 'auditor' | 'unknown';
    /** Public key for verification (PEM format) */
    publicKey: string;
    /** Identity creation timestamp */
    createdAt: number;
    /** Key rotation version */
    keyVersion: number;
    /** Optional: issuing authority if in a trust chain */
    issuer?: string;
    /** Metadata (non-verified claims) */
    metadata?: Record<string, unknown>;
}
/**
 * Capability claim with evidence
 */
export interface CapabilityClaim {
    /** Capability identifier */
    capability: string;
    /** Proficiency level 0-1 */
    level: number;
    /** Evidence type */
    evidenceType: 'self-declared' | 'peer-attested' | 'benchmark' | 'certified';
    /** Evidence payload (varies by type) */
    evidence?: CapabilityEvidence;
    /** When this capability was last verified */
    verifiedAt?: number;
}
/**
 * Evidence supporting a capability claim
 */
export type CapabilityEvidence = {
    type: 'self-declared';
    description: string;
} | {
    type: 'peer-attested';
    attestations: PeerAttestation[];
} | {
    type: 'benchmark';
    results: BenchmarkResult[];
} | {
    type: 'certified';
    certificate: CapabilityCertificate;
};
interface PeerAttestation {
    attesterId: string;
    attesterPublicKey: string;
    capability: string;
    level: number;
    signature: string;
    timestamp: number;
}
interface BenchmarkResult {
    benchmarkId: string;
    score: number;
    maxScore: number;
    timestamp: number;
    verifierSignature?: string;
}
interface CapabilityCertificate {
    issuerId: string;
    capability: string;
    level: number;
    issuedAt: number;
    expiresAt: number;
    signature: string;
}
/**
 * Authentication challenge for proving identity
 */
export interface AuthChallenge {
    /** Challenge ID */
    id: string;
    /** Random nonce to sign */
    nonce: string;
    /** Timestamp (for replay prevention) */
    timestamp: number;
    /** Challenge expires after this time */
    expiresAt: number;
    /** Optional: specific capabilities to prove */
    requestedCapabilities?: string[];
    /** Challenger's identity (for mutual auth) */
    challengerId?: string;
}
/**
 * Response to an authentication challenge
 */
export interface AuthResponse {
    /** Matching challenge ID */
    challengeId: string;
    /** Agent's identity */
    identity: AgentIdentity;
    /** Signature of challenge nonce */
    signature: string;
    /** Claimed capabilities with evidence */
    capabilities: CapabilityClaim[];
    /** Counter-challenge for mutual authentication */
    counterChallenge?: AuthChallenge;
}
/**
 * Verification result
 */
export interface VerificationResult {
    /** Overall verification passed */
    verified: boolean;
    /** Identity verification status */
    identityVerified: boolean;
    /** Capabilities verification breakdown */
    capabilityVerification: Map<string, CapabilityVerificationStatus>;
    /** Trust score 0-1 */
    trustScore: number;
    /** Any warnings (non-fatal issues) */
    warnings: string[];
    /** Errors if verification failed */
    errors: string[];
    /** Verification timestamp */
    timestamp: number;
}
interface CapabilityVerificationStatus {
    capability: string;
    claimed: boolean;
    verified: boolean;
    evidenceStrength: 'none' | 'weak' | 'moderate' | 'strong';
    trustedLevel: number;
}
/**
 * Trust chain for hierarchical verification
 */
export interface TrustChain {
    /** Root authority */
    root: TrustAnchor;
    /** Intermediate certificates */
    intermediates: TrustCertificate[];
    /** Leaf (the agent being verified) */
    leaf: AgentIdentity;
}
interface TrustAnchor {
    id: string;
    name: string;
    publicKey: string;
    type: 'self' | 'organization' | 'network';
}
interface TrustCertificate {
    subject: string;
    issuer: string;
    publicKey: string;
    signature: string;
    issuedAt: number;
    expiresAt: number;
    capabilities?: string[];
}
/**
 * Manages agent identity creation and key operations
 */
export declare class IdentityManager {
    private privateKey;
    private identity;
    private knownIdentities;
    private revokedKeys;
    constructor(config: {
        id: string;
        name: string;
        type: AgentIdentity['type'];
        existingKeyPair?: {
            publicKey: string;
            privateKey: string;
        };
    });
    private generateKeyPair;
    /**
     * Get this agent's identity (public info only)
     */
    getIdentity(): AgentIdentity;
    /**
     * Sign data with private key
     */
    sign(data: string): string;
    /**
     * Verify a signature from another agent
     */
    verifySignature(data: string, signature: string, publicKey: string): boolean;
    /**
     * Register a known identity (for future verification)
     */
    registerIdentity(identity: AgentIdentity): void;
    /**
     * Check if a public key has been revoked
     */
    isKeyRevoked(publicKey: string): boolean;
    /**
     * Revoke a key (add to revocation list)
     */
    revokeKey(publicKey: string): void;
    /**
     * Rotate keys (generate new pair, increment version)
     */
    rotateKeys(): {
        oldPublicKey: string;
        newIdentity: AgentIdentity;
    };
    /**
     * Get a known identity by ID
     */
    getKnownIdentity(id: string): AgentIdentity | undefined;
}
/**
 * Manages challenge-response authentication flows
 */
export declare class AuthenticationManager {
    private identityManager;
    private pendingChallenges;
    private completedAuths;
    private capabilities;
    private challengeTimeoutMs;
    private requireMutualAuth;
    private minTrustScore;
    constructor(identityManager: IdentityManager, config?: {
        challengeTimeoutMs?: number;
        requireMutualAuth?: boolean;
        minTrustScore?: number;
    });
    /**
     * Register capabilities this agent can prove
     */
    registerCapability(claim: CapabilityClaim): void;
    /**
     * Create an authentication challenge for another agent
     */
    createChallenge(options?: {
        requestedCapabilities?: string[];
        includeSelfIdentity?: boolean;
    }): AuthChallenge;
    /**
     * Respond to an authentication challenge
     */
    respondToChallenge(challenge: AuthChallenge): AuthResponse;
    /**
     * Verify an authentication response
     */
    verifyResponse(response: AuthResponse): VerificationResult;
    private verifyCapability;
    private evidenceStrengthMultiplier;
    /**
     * Get cached verification result for an agent
     */
    getCachedVerification(agentId: string): VerificationResult | undefined;
    /**
     * Clear expired challenges
     */
    cleanupExpiredChallenges(): number;
}
/**
 * Complete mutual authentication between two agents
 */
export declare class MutualAuthenticator {
    private authManager;
    constructor(authManager: AuthenticationManager);
    /**
     * Initiate mutual authentication (as challenger)
     */
    initiate(requestedCapabilities?: string[]): {
        challenge: AuthChallenge;
        awaitResponse: (response: AuthResponse) => Promise<MutualAuthResult>;
    };
    /**
     * Respond to incoming authentication (as responder)
     */
    respond(challenge: AuthChallenge): AuthResponse;
    /**
     * Complete the mutual auth by processing their response to our counter-challenge
     */
    complete(counterChallengeId: string, theirResponse: AuthResponse): MutualAuthResult;
}
interface MutualAuthResult {
    success: boolean;
    theirVerification?: VerificationResult;
    ourVerification?: VerificationResult;
    ourResponse?: AuthResponse;
    mutualTrust: number;
}
/**
 * Verifies trust chains (hierarchical certificate-based trust)
 */
export declare class TrustChainVerifier {
    private trustedRoots;
    private identityManager;
    constructor(identityManager: IdentityManager);
    /**
     * Add a trusted root authority
     */
    addTrustedRoot(anchor: TrustAnchor): void;
    /**
     * Remove a trusted root
     */
    removeTrustedRoot(id: string): boolean;
    /**
     * Verify a complete trust chain
     */
    verifyChain(chain: TrustChain): TrustChainVerificationResult;
}
interface TrustChainVerificationResult {
    valid: boolean;
    trustScore: number;
    chainLength: number;
    inheritedCapabilities: string[];
    warnings: string[];
    errors: string[];
}
/**
 * Create and verify peer attestations for capabilities
 */
export declare class AttestationManager {
    private identityManager;
    private receivedAttestations;
    private givenAttestations;
    constructor(identityManager: IdentityManager);
    /**
     * Attest to another agent's capability
     */
    createAttestation(subjectId: string, capability: string, level: number): PeerAttestation;
    /**
     * Receive and verify an attestation
     */
    receiveAttestation(attestation: PeerAttestation, forAgentId: string): boolean;
    /**
     * Get all attestations for a capability
     */
    getAttestationsFor(capability: string): PeerAttestation[];
    /**
     * Build evidence from received attestations
     */
    buildAttestationEvidence(capability: string): CapabilityEvidence | undefined;
}
/**
 * Wraps context handshakes with authentication
 */
export declare class AuthenticatedHandshake {
    private authManager;
    private mutualAuth;
    private requireAuth;
    private minTrustForHandshake;
    constructor(authManager: AuthenticationManager, config?: {
        requireAuth?: boolean;
        minTrustForHandshake?: number;
    });
    /**
     * Authenticate before starting a handshake
     */
    authenticateFirst<T>(targetAgent: {
        respondToChallenge: (c: AuthChallenge) => AuthResponse;
    }, handshakeFn: () => Promise<T>): Promise<AuthenticatedHandshakeResult<T>>;
}
interface AuthenticatedHandshakeResult<T> {
    authenticated: boolean;
    authResult: MutualAuthResult;
    handshakeResult: T | undefined;
    error: string | undefined;
}
export declare function generateAgentId(): string;
export declare function createCapabilityEvidence(type: CapabilityClaim['evidenceType'], data: unknown): CapabilityEvidence;
/**
 * Quick helper to create a self-declared capability claim
 */
export declare function selfDeclaredCapability(capability: string, level: number, description: string): CapabilityClaim;
export {};
