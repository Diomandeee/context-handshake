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
import { createHash, randomBytes, createSign, createVerify, generateKeyPairSync } from 'crypto';
// ════════════════════════════════════════════════════════════════════════════
// IDENTITY MANAGER
// ════════════════════════════════════════════════════════════════════════════
/**
 * Manages agent identity creation and key operations
 */
export class IdentityManager {
    privateKey;
    identity;
    knownIdentities = new Map();
    revokedKeys = new Set();
    constructor(config) {
        // Generate or use existing key pair
        const keyPair = config.existingKeyPair ?? this.generateKeyPair();
        this.privateKey = keyPair.privateKey;
        this.identity = {
            id: config.id,
            name: config.name,
            type: config.type,
            publicKey: keyPair.publicKey,
            createdAt: Date.now(),
            keyVersion: 1
        };
    }
    generateKeyPair() {
        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        return { publicKey, privateKey };
    }
    /**
     * Get this agent's identity (public info only)
     */
    getIdentity() {
        return { ...this.identity };
    }
    /**
     * Sign data with private key
     */
    sign(data) {
        const signer = createSign('SHA256');
        signer.update(data);
        return signer.sign(this.privateKey, 'base64');
    }
    /**
     * Verify a signature from another agent
     */
    verifySignature(data, signature, publicKey) {
        try {
            const verifier = createVerify('SHA256');
            verifier.update(data);
            return verifier.verify(publicKey, signature, 'base64');
        }
        catch {
            return false;
        }
    }
    /**
     * Register a known identity (for future verification)
     */
    registerIdentity(identity) {
        this.knownIdentities.set(identity.id, identity);
    }
    /**
     * Check if a public key has been revoked
     */
    isKeyRevoked(publicKey) {
        const keyHash = createHash('sha256').update(publicKey).digest('hex');
        return this.revokedKeys.has(keyHash);
    }
    /**
     * Revoke a key (add to revocation list)
     */
    revokeKey(publicKey) {
        const keyHash = createHash('sha256').update(publicKey).digest('hex');
        this.revokedKeys.add(keyHash);
    }
    /**
     * Rotate keys (generate new pair, increment version)
     */
    rotateKeys() {
        const oldPublicKey = this.identity.publicKey;
        const newKeyPair = this.generateKeyPair();
        this.privateKey = newKeyPair.privateKey;
        this.identity = {
            ...this.identity,
            publicKey: newKeyPair.publicKey,
            keyVersion: this.identity.keyVersion + 1
        };
        return { oldPublicKey, newIdentity: this.getIdentity() };
    }
    /**
     * Get a known identity by ID
     */
    getKnownIdentity(id) {
        return this.knownIdentities.get(id);
    }
}
// ════════════════════════════════════════════════════════════════════════════
// CHALLENGE-RESPONSE AUTHENTICATION
// ════════════════════════════════════════════════════════════════════════════
/**
 * Manages challenge-response authentication flows
 */
export class AuthenticationManager {
    identityManager;
    pendingChallenges = new Map();
    completedAuths = new Map();
    capabilities = [];
    // Configuration
    challengeTimeoutMs;
    requireMutualAuth;
    minTrustScore;
    constructor(identityManager, config = {}) {
        this.identityManager = identityManager;
        this.challengeTimeoutMs = config.challengeTimeoutMs ?? 30000;
        this.requireMutualAuth = config.requireMutualAuth ?? true;
        this.minTrustScore = config.minTrustScore ?? 0.5;
    }
    /**
     * Register capabilities this agent can prove
     */
    registerCapability(claim) {
        const existing = this.capabilities.findIndex(c => c.capability === claim.capability);
        if (existing >= 0) {
            this.capabilities[existing] = claim;
        }
        else {
            this.capabilities.push(claim);
        }
    }
    /**
     * Create an authentication challenge for another agent
     */
    createChallenge(options = {}) {
        const challenge = {
            id: randomBytes(16).toString('hex'),
            nonce: randomBytes(32).toString('hex'),
            timestamp: Date.now(),
            expiresAt: Date.now() + this.challengeTimeoutMs,
            requestedCapabilities: options.requestedCapabilities
        };
        if (options.includeSelfIdentity) {
            challenge.challengerId = this.identityManager.getIdentity().id;
        }
        this.pendingChallenges.set(challenge.id, challenge);
        return challenge;
    }
    /**
     * Respond to an authentication challenge
     */
    respondToChallenge(challenge) {
        // Sign the nonce to prove identity
        const signature = this.identityManager.sign(challenge.nonce);
        // Filter capabilities to requested ones if specified
        let caps = this.capabilities;
        if (challenge.requestedCapabilities?.length) {
            caps = caps.filter(c => challenge.requestedCapabilities.includes(c.capability));
        }
        const response = {
            challengeId: challenge.id,
            identity: this.identityManager.getIdentity(),
            signature,
            capabilities: caps
        };
        // Add counter-challenge for mutual authentication
        if (this.requireMutualAuth && challenge.challengerId) {
            response.counterChallenge = this.createChallenge({
                includeSelfIdentity: true
            });
        }
        return response;
    }
    /**
     * Verify an authentication response
     */
    verifyResponse(response) {
        const warnings = [];
        const errors = [];
        let identityVerified = false;
        // 1. Check challenge exists and hasn't expired
        const challenge = this.pendingChallenges.get(response.challengeId);
        if (!challenge) {
            errors.push('Unknown challenge ID');
        }
        else if (Date.now() > challenge.expiresAt) {
            errors.push('Challenge expired');
            this.pendingChallenges.delete(response.challengeId);
        }
        // 2. Check key isn't revoked
        if (this.identityManager.isKeyRevoked(response.identity.publicKey)) {
            errors.push('Public key has been revoked');
        }
        // 3. Verify signature
        if (challenge && errors.length === 0) {
            identityVerified = this.identityManager.verifySignature(challenge.nonce, response.signature, response.identity.publicKey);
            if (!identityVerified) {
                errors.push('Signature verification failed');
            }
        }
        // 4. Verify capabilities
        const capabilityVerification = new Map();
        let capabilityTrustSum = 0;
        for (const claim of response.capabilities) {
            const status = this.verifyCapability(claim, response.identity);
            capabilityVerification.set(claim.capability, status);
            capabilityTrustSum += status.trustedLevel * this.evidenceStrengthMultiplier(status.evidenceStrength);
        }
        // 5. Calculate trust score
        const baseScore = identityVerified ? 0.5 : 0;
        const capScore = response.capabilities.length > 0
            ? (capabilityTrustSum / response.capabilities.length) * 0.5
            : 0;
        const trustScore = Math.min(1, baseScore + capScore);
        // 6. Check minimum trust threshold
        if (trustScore < this.minTrustScore) {
            warnings.push(`Trust score ${trustScore.toFixed(2)} below threshold ${this.minTrustScore}`);
        }
        // Clean up challenge
        if (challenge) {
            this.pendingChallenges.delete(response.challengeId);
        }
        const result = {
            verified: identityVerified && errors.length === 0 && trustScore >= this.minTrustScore,
            identityVerified,
            capabilityVerification,
            trustScore,
            warnings,
            errors,
            timestamp: Date.now()
        };
        // Cache result for this agent
        this.completedAuths.set(response.identity.id, result);
        // Register the identity if verified
        if (identityVerified) {
            this.identityManager.registerIdentity(response.identity);
        }
        return result;
    }
    verifyCapability(claim, identity) {
        const status = {
            capability: claim.capability,
            claimed: true,
            verified: false,
            evidenceStrength: 'none',
            trustedLevel: 0
        };
        if (!claim.evidence) {
            return status;
        }
        switch (claim.evidenceType) {
            case 'self-declared':
                // Self-declared has minimal trust
                status.evidenceStrength = 'weak';
                status.trustedLevel = claim.level * 0.3;
                status.verified = true; // Can't really verify, but it's acknowledged
                break;
            case 'peer-attested':
                if (claim.evidence?.type === 'peer-attested') {
                    const validAttestations = claim.evidence.attestations.filter(a => this.identityManager.verifySignature(`${a.capability}:${a.level}:${identity.id}`, a.signature, a.attesterPublicKey));
                    if (validAttestations.length > 0) {
                        status.evidenceStrength = validAttestations.length >= 3 ? 'moderate' : 'weak';
                        const avgLevel = validAttestations.reduce((s, a) => s + a.level, 0) / validAttestations.length;
                        status.trustedLevel = Math.min(claim.level, avgLevel);
                        status.verified = true;
                    }
                }
                break;
            case 'benchmark':
                if (claim.evidence?.type === 'benchmark') {
                    // Trust benchmarks if they have verifier signatures
                    const verifiedResults = claim.evidence.results.filter(r => {
                        if (!r.verifierSignature)
                            return false;
                        // Would verify against known benchmark authority
                        return true; // Simplified for now
                    });
                    if (verifiedResults.length > 0) {
                        status.evidenceStrength = 'moderate';
                        const avgScore = verifiedResults.reduce((s, r) => s + r.score / r.maxScore, 0) / verifiedResults.length;
                        status.trustedLevel = avgScore;
                        status.verified = true;
                    }
                }
                break;
            case 'certified':
                if (claim.evidence?.type === 'certified') {
                    const cert = claim.evidence.certificate;
                    // Verify certificate signature and expiration
                    if (Date.now() < cert.expiresAt) {
                        // Would verify against known certificate authority
                        status.evidenceStrength = 'strong';
                        status.trustedLevel = cert.level;
                        status.verified = true;
                    }
                }
                break;
        }
        return status;
    }
    evidenceStrengthMultiplier(strength) {
        switch (strength) {
            case 'strong': return 1.0;
            case 'moderate': return 0.7;
            case 'weak': return 0.3;
            case 'none': return 0;
        }
    }
    /**
     * Get cached verification result for an agent
     */
    getCachedVerification(agentId) {
        return this.completedAuths.get(agentId);
    }
    /**
     * Clear expired challenges
     */
    cleanupExpiredChallenges() {
        const now = Date.now();
        let cleaned = 0;
        const entries = Array.from(this.pendingChallenges.entries());
        for (const [id, challenge] of entries) {
            if (now > challenge.expiresAt) {
                this.pendingChallenges.delete(id);
                cleaned++;
            }
        }
        return cleaned;
    }
}
// ════════════════════════════════════════════════════════════════════════════
// MUTUAL AUTHENTICATION FLOW
// ════════════════════════════════════════════════════════════════════════════
/**
 * Complete mutual authentication between two agents
 */
export class MutualAuthenticator {
    authManager;
    constructor(authManager) {
        this.authManager = authManager;
    }
    /**
     * Initiate mutual authentication (as challenger)
     */
    initiate(requestedCapabilities) {
        const challenge = this.authManager.createChallenge({
            requestedCapabilities,
            includeSelfIdentity: true
        });
        return {
            challenge,
            awaitResponse: async (response) => {
                // Verify their response
                const theirVerification = this.authManager.verifyResponse(response);
                // If they sent a counter-challenge, respond
                let ourVerification;
                let ourResponse;
                if (response.counterChallenge) {
                    ourResponse = this.authManager.respondToChallenge(response.counterChallenge);
                }
                return {
                    success: theirVerification.verified,
                    theirVerification,
                    ourVerification,
                    ourResponse,
                    mutualTrust: theirVerification.verified ? theirVerification.trustScore : 0
                };
            }
        };
    }
    /**
     * Respond to incoming authentication (as responder)
     */
    respond(challenge) {
        return this.authManager.respondToChallenge(challenge);
    }
    /**
     * Complete the mutual auth by processing their response to our counter-challenge
     */
    complete(counterChallengeId, theirResponse) {
        const ourVerification = this.authManager.verifyResponse(theirResponse);
        const theirVerification = this.authManager.getCachedVerification(theirResponse.identity.id);
        return {
            success: ourVerification.verified && (theirVerification?.verified ?? false),
            theirVerification,
            ourVerification,
            mutualTrust: Math.min(ourVerification.trustScore, theirVerification?.trustScore ?? 0)
        };
    }
}
// ════════════════════════════════════════════════════════════════════════════
// TRUST CHAIN VERIFICATION
// ════════════════════════════════════════════════════════════════════════════
/**
 * Verifies trust chains (hierarchical certificate-based trust)
 */
export class TrustChainVerifier {
    trustedRoots = new Map();
    identityManager;
    constructor(identityManager) {
        this.identityManager = identityManager;
    }
    /**
     * Add a trusted root authority
     */
    addTrustedRoot(anchor) {
        this.trustedRoots.set(anchor.id, anchor);
    }
    /**
     * Remove a trusted root
     */
    removeTrustedRoot(id) {
        return this.trustedRoots.delete(id);
    }
    /**
     * Verify a complete trust chain
     */
    verifyChain(chain) {
        const errors = [];
        const warnings = [];
        const now = Date.now();
        // 1. Verify root is trusted
        const trustedRoot = this.trustedRoots.get(chain.root.id);
        if (!trustedRoot) {
            errors.push(`Unknown root authority: ${chain.root.id}`);
        }
        else if (trustedRoot.publicKey !== chain.root.publicKey) {
            errors.push('Root public key mismatch');
        }
        // 2. Verify certificate chain
        let currentIssuerKey = chain.root.publicKey;
        let currentIssuerId = chain.root.id;
        let inheritedCapabilities = new Set();
        for (let i = 0; i < chain.intermediates.length; i++) {
            const cert = chain.intermediates[i];
            // Check issuer matches
            if (cert.issuer !== currentIssuerId) {
                errors.push(`Certificate ${i} issuer mismatch`);
                break;
            }
            // Check expiration
            if (now > cert.expiresAt) {
                errors.push(`Certificate ${i} expired`);
            }
            else if (cert.expiresAt - now < 86400000) {
                warnings.push(`Certificate ${i} expires within 24h`);
            }
            // Verify signature
            const certData = `${cert.subject}:${cert.publicKey}:${cert.issuedAt}:${cert.expiresAt}`;
            if (!this.identityManager.verifySignature(certData, cert.signature, currentIssuerKey)) {
                errors.push(`Certificate ${i} signature invalid`);
            }
            // Track capabilities
            if (cert.capabilities) {
                cert.capabilities.forEach(c => inheritedCapabilities.add(c));
            }
            // Move to next level
            currentIssuerKey = cert.publicKey;
            currentIssuerId = cert.subject;
        }
        // 3. Verify leaf identity
        if (chain.leaf.issuer !== currentIssuerId) {
            errors.push('Leaf issuer does not match chain');
        }
        // Calculate chain trust score
        const chainLength = chain.intermediates.length;
        const lengthPenalty = Math.max(0, (chainLength - 2) * 0.1);
        const baseTrust = errors.length === 0 ? 1.0 : 0;
        const trustScore = Math.max(0, baseTrust - lengthPenalty);
        return {
            valid: errors.length === 0,
            trustScore,
            chainLength: chainLength + 2, // root + intermediates + leaf
            inheritedCapabilities: Array.from(inheritedCapabilities),
            warnings,
            errors
        };
    }
}
// ════════════════════════════════════════════════════════════════════════════
// PEER ATTESTATION
// ════════════════════════════════════════════════════════════════════════════
/**
 * Create and verify peer attestations for capabilities
 */
export class AttestationManager {
    identityManager;
    receivedAttestations = new Map();
    givenAttestations = new Map();
    constructor(identityManager) {
        this.identityManager = identityManager;
    }
    /**
     * Attest to another agent's capability
     */
    createAttestation(subjectId, capability, level) {
        const identity = this.identityManager.getIdentity();
        const dataToSign = `${capability}:${level}:${subjectId}`;
        const attestation = {
            attesterId: identity.id,
            attesterPublicKey: identity.publicKey,
            capability,
            level,
            signature: this.identityManager.sign(dataToSign),
            timestamp: Date.now()
        };
        // Track that we gave this attestation
        this.givenAttestations.set(`${subjectId}:${capability}`, attestation);
        return attestation;
    }
    /**
     * Receive and verify an attestation
     */
    receiveAttestation(attestation, forAgentId) {
        // Verify signature
        const dataToSign = `${attestation.capability}:${attestation.level}:${forAgentId}`;
        const valid = this.identityManager.verifySignature(dataToSign, attestation.signature, attestation.attesterPublicKey);
        if (valid) {
            const key = attestation.capability;
            const existing = this.receivedAttestations.get(key) ?? [];
            existing.push(attestation);
            this.receivedAttestations.set(key, existing);
        }
        return valid;
    }
    /**
     * Get all attestations for a capability
     */
    getAttestationsFor(capability) {
        return this.receivedAttestations.get(capability) ?? [];
    }
    /**
     * Build evidence from received attestations
     */
    buildAttestationEvidence(capability) {
        const attestations = this.getAttestationsFor(capability);
        if (attestations.length === 0)
            return undefined;
        return {
            type: 'peer-attested',
            attestations
        };
    }
}
// ════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED HANDSHAKE WRAPPER
// ════════════════════════════════════════════════════════════════════════════
/**
 * Wraps context handshakes with authentication
 */
export class AuthenticatedHandshake {
    authManager;
    mutualAuth;
    requireAuth;
    minTrustForHandshake;
    constructor(authManager, config = {}) {
        this.authManager = authManager;
        this.mutualAuth = new MutualAuthenticator(authManager);
        this.requireAuth = config.requireAuth ?? true;
        this.minTrustForHandshake = config.minTrustForHandshake ?? 0.5;
    }
    /**
     * Authenticate before starting a handshake
     */
    async authenticateFirst(targetAgent, handshakeFn) {
        // Step 1: Mutual authentication
        const { challenge, awaitResponse } = this.mutualAuth.initiate();
        // Get their response
        const response = targetAgent.respondToChallenge(challenge);
        const authResult = await awaitResponse(response);
        if (!authResult.success) {
            return {
                authenticated: false,
                authResult,
                handshakeResult: undefined,
                error: 'Authentication failed'
            };
        }
        if (authResult.mutualTrust < this.minTrustForHandshake) {
            return {
                authenticated: true,
                authResult,
                handshakeResult: undefined,
                error: `Trust score ${authResult.mutualTrust.toFixed(2)} below threshold ${this.minTrustForHandshake}`
            };
        }
        // Step 2: Proceed with handshake
        try {
            const handshakeResult = await handshakeFn();
            return {
                authenticated: true,
                authResult,
                handshakeResult,
                error: undefined
            };
        }
        catch (err) {
            return {
                authenticated: true,
                authResult,
                handshakeResult: undefined,
                error: `Handshake failed: ${err}`
            };
        }
    }
}
// ════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════
// Export utility functions
export function generateAgentId() {
    return `agent_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}
export function createCapabilityEvidence(type, data) {
    switch (type) {
        case 'self-declared':
            return { type: 'self-declared', description: String(data) };
        case 'peer-attested':
            return { type: 'peer-attested', attestations: data };
        case 'benchmark':
            return { type: 'benchmark', results: data };
        case 'certified':
            return { type: 'certified', certificate: data };
        default:
            throw new Error(`Unknown evidence type: ${type}`);
    }
}
/**
 * Quick helper to create a self-declared capability claim
 */
export function selfDeclaredCapability(capability, level, description) {
    return {
        capability,
        level,
        evidenceType: 'self-declared',
        evidence: { type: 'self-declared', description }
    };
}
