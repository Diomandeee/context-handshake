/**
 * Context Handshake Protocol
 *
 * AI-to-AI context synchronization before collaboration
 * Like TCP's three-way handshake, but for mental models
 *
 * Gen 7 additions:
 * - Trust Memory: Agents remember past collaborations
 * - Progressive Trust: Capabilities unlock over time
 * - Fast Reconnection: Instant handshakes for trusted partners
 * - Trust-Based Conflict Resolution
 *
 * Gen 8 additions:
 * - Streaming Handshakes: Progressive context sync for large models
 * - Chunked Transfer: Split large contexts into priority-ordered chunks
 * - Real-time Alignment: Progressive alignment scores during stream
 * - Early Termination: Stop early if alignment drops below threshold
 */
// Core protocol types
export * from './protocol';
// Gen 7: Trust Evolution
export { TrustMemory, TrustTier, TRUST_CAPABILITIES, selectHandshakeType, createFastReconnect, } from './trust';
// Gen 7: Memory-Aware Handshake
export { MemoryHandshake, resolveConflict, } from './memory-handshake';
// Context utilities
export { hashContext, generateNonce, generateSessionId, buildMentalModel, extractConcepts, serializeContext, deserializeContext, compressContext, } from './context';
// Alignment analysis
export { analyzeAlignment, quickAlignmentScore, } from './alignment';
// Handshake state machine
export { ContextHandshake, performHandshake, formatHandshakeLog, } from './handshake';
// Model merging
export { mergeModels, updateMergedModel, } from './merge';
// Session management
export { ActiveSession, SessionStore, formatSession, } from './session';
// Gen 8: Streaming Handshakes
export { StreamingHandshake, ContextChunker, DEFAULT_BANDWIDTH, visualizeStreamProgress, demoStreamingHandshake, } from './streaming';
// Gen 6 Instance 28: Negotiation Protocol
export { NegotiationEngine, handshakeWithNegotiation, } from './negotiation';
// Gen 6 Instance 28: Multi-party Handshakes
export { MultipartyEngine, quickMultipartySync, swarmHandshake, isGroupAligned, getLeastAlignedPair, } from './multiparty';
// Gen 6 Instance 28: Context Fingerprinting
export { ContextFingerprinting, } from './fingerprinting';
// Gen 6 Instance 28: Context Compression
export { ContextCompressor, StreamingCompressor, CompressionTracker, SHARED_DICTIONARY, calculateSemanticSimilarity, } from './compression';
// Gen 6 Instance 28: Resilience & Recovery
export { ResilientHandshakeExecutor, CheckpointManager, CircuitBreaker, GracefulDegradation, HealthMonitor, DEFAULT_RESILIENCE_CONFIG, DEGRADATION_LEVELS, determineRecoveryStrategy, } from './resilience';
// Gen 6 Instance 28: Keepalive & Drift Detection
export { KeepaliveManager, DriftAnalyzer, DEFAULT_KEEPALIVE_CONFIG, createKeepaliveManager, createDriftAnalyzer, } from './keepalive';
// Gen 6 Instance 28: Authentication & Verification
export { IdentityManager, AuthenticationManager, MutualAuthenticator, TrustChainVerifier, AttestationManager, AuthenticatedHandshake, generateAgentId, createCapabilityEvidence, selfDeclaredCapability, } from './authentication';
// Gen 6 Instance 28: Context Versioning (Git-like mental model history)
export { ContextRepository, DistributedVersioning, createCollaborationSession, } from './versioning';
// Gen 6 Instance 28: Flow Control & Backpressure (TCP-like for mental models)
export { FlowControlManager, AdaptiveFlowController, AgingPriorityQueue, ChunkPriority, } from './flow-control';
// Gen 6 Instance 28: Connection Termination & Graceful Shutdown (TCP FIN/FIN-ACK)
export { 
// State Machine
TerminationStateMachine, TerminationState, TerminationReason, TerminationUrgency, 
// Builders
StateSnapshotBuilder, OutstandingItemsCollector, 
// Managers
GracefulTerminationManager, HandoffManager, DEFAULT_TERMINATION_CONFIG, 
// Quick functions
quickTerminate, abortSession, 
// Visualization
visualizeTermination, visualizeOutstanding, demoTermination, } from './termination';
// Gen 6 Instance 28: Connection Pooling & Multiplexing (HTTP/2-like)
export { 
// Core pool
ConnectionPool, getPool, quickStream, visualizePool, 
// Scheduler
PriorityScheduler, StreamState, ConnectionState, StreamErrorCode, DEFAULT_POOL_CONFIG, 
// Errors
PoolError, PoolExhaustedError, PoolTimeoutError, ConnectionNotReadyError, StreamLimitError, StreamNotFoundError, StreamClosedError, } from './pooling';
// Gen 6 Instance 28: Quality of Service (DSCP-like for mental models)
export { 
// Core
QoSManager, ContextClassifier, PriorityQueue, TrafficShaper, SLAMonitor, 
// Types
TrafficClass, ContextType, } from './qos';
// Gen 6 Instance 28: Observability (Tracing, Metrics, Logging, Alerts)
export { 
// Tracing
Tracer, 
// Metrics
MetricsRegistry, 
// Logging
HandshakeLogger, 
// Health
HealthMonitor as ObservabilityHealthMonitor, 
// Alerts
AlertManager, 
// Unified
HandshakeObservability, HandshakeObserver, SpanHandle, createObservability, formatDuration, formatBytes, } from './observability';
// Gen 6 Instance 28: Congestion Control (TCP Reno/Cubic/BBR for cognitive bandwidth)
export { 
// Controllers
CongestionController, RenoCongestionController, CubicCongestionController, BbrCongestionController, AdaptiveCongestionController, 
// Utilities
RttEstimator, createCongestionController, createCongestionAwareSession, } from './congestion-control';
// Gen 6 Instance 28: Delta Synchronization (CRDT-based context diffing)
export { 
// Core managers
DeltaSyncManager, VectorClockManager, BloomFilterManager, MerkleTreeManager, DeltaOperationLog, ConflictResolver, createDeltaSync, demonstrateDeltaSync, } from './delta-sync';
/**
 * Quick start example:
 *
 * ```typescript
 * import { ContextHandshake, buildMentalModel, performHandshake } from 'context-handshake';
 *
 * // Build context for each agent
 * const agentA = {
 *   agentId: 'clawd-main',
 *   capabilities: ['code', 'research'],
 *   mentalModel: buildMentalModel({
 *     taskDescription: 'Build a web scraper',
 *     concepts: { 'scraper': 'Tool to extract web data' },
 *     goals: ['Create working scraper', 'Handle pagination'],
 *   }),
 *   preferredStyle: 'concise',
 * };
 *
 * const agentB = {
 *   agentId: 'sub-agent-alpha',
 *   capabilities: ['code', 'automation'],
 *   mentalModel: buildMentalModel({
 *     taskDescription: 'Implement web data extraction',
 *     concepts: { 'extraction': 'Pull data from HTML' },
 *     goals: ['Parse HTML', 'Output JSON'],
 *   }),
 *   preferredStyle: 'technical',
 * };
 *
 * // Perform handshake
 * const result = await performHandshake(agentA, agentB);
 *
 * if ('error' in result) {
 *   console.error('Handshake failed:', result.error);
 * } else {
 *   console.log('Session established:', result.session.sessionId);
 *   console.log('Alignment score:', result.alignment.score);
 * }
 * ```
 */
