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
export * from './protocol';
export { TrustMemory, TrustTier, TrustCapabilities, TRUST_CAPABILITIES, selectHandshakeType, createFastReconnect, } from './trust';
export { MemoryHandshake, resolveConflict, } from './memory-handshake';
export { hashContext, generateNonce, generateSessionId, buildMentalModel, extractConcepts, serializeContext, deserializeContext, compressContext, } from './context';
export { analyzeAlignment, quickAlignmentScore, } from './alignment';
export { ContextHandshake, performHandshake, formatHandshakeLog, } from './handshake';
export { mergeModels, updateMergedModel, } from './merge';
export { ActiveSession, SessionStore, formatSession, } from './session';
export { StreamingHandshake, ContextChunker, StreamChunk, StreamSession, StreamStatus, StreamHandshakeResult, AlignmentSnapshot, DivergenceFlag, BandwidthConfig, DEFAULT_BANDWIDTH, visualizeStreamProgress, demoStreamingHandshake, } from './streaming';
export { NegotiationEngine, NegotiationProposal, NegotiationResponse, NegotiationSession, NegotiationRound, NegotiationConfig, NegotiationStrategy, StrategyProfile, Divergence, ResolvedDivergence, HandshakeWithNegotiation, handshakeWithNegotiation, } from './negotiation';
export { MultipartyEngine, MultipartySession, MultipartyConfig, MultipartyPhase, MultipartyMetrics, PartyInfo, PartyRole, PartyStatus, TopologyStrategy, AlignmentMatrix, quickMultipartySync, swarmHandshake, isGroupAligned, getLeastAlignedPair, } from './multiparty';
export { ContextFingerprinting, ContextFingerprint, FingerprintComparison, DeltaSync, FingerprintCache, CollaboratorHistory, QuickSyncSession, QuickSyncMessage, } from './fingerprinting';
export { ContextCompressor, StreamingCompressor, CompressionTracker, CompressedContext, CompressionConfig, CompressionStats, CompressionMethod, SHARED_DICTIONARY, calculateSemanticSimilarity, } from './compression';
export { ResilientHandshakeExecutor, CheckpointManager, CircuitBreaker, GracefulDegradation, HealthMonitor, HandshakeCheckpoint, FailureEvent, FailureType, RecoveryStrategy, RecoveryPlan, DegradationLevel, CircuitState, ResilienceConfig, HealthStatus, DEFAULT_RESILIENCE_CONFIG, DEGRADATION_LEVELS, determineRecoveryStrategy, } from './resilience';
export { KeepaliveManager, DriftAnalyzer, KeepaliveProbe, KeepaliveResponse, KeepaliveConfig, KeepaliveSession, DriftVector, DriftCause, DriftEvent, DriftPattern, ConceptSnapshot, CorrectionPatch, DEFAULT_KEEPALIVE_CONFIG, createKeepaliveManager, createDriftAnalyzer, } from './keepalive';
export { IdentityManager, AuthenticationManager, MutualAuthenticator, TrustChainVerifier, AttestationManager, AuthenticatedHandshake, AgentIdentity, CapabilityClaim, CapabilityEvidence, AuthChallenge, AuthResponse, VerificationResult, TrustChain, generateAgentId, createCapabilityEvidence, selfDeclaredCapability, } from './authentication';
export { ContextRepository, DistributedVersioning, createCollaborationSession, ContextCommit, ConceptVersion, BeliefVersion, ContextBranch, ContextDiff, MergeConflict, MergeResult, MergeStrategy, VersioningSyncMessage, ContextPullRequest, ContextPullResponse, } from './versioning';
export { FlowControlManager, AdaptiveFlowController, AgingPriorityQueue, ContextChunk, ContextPayload, ChunkPriority, ContextAck, SelectiveAck, WindowAdvertisement, BackpressureSignal, FlowState, FlowControlConfig, FlowControlMetrics, } from './flow-control';
export { TerminationStateMachine, TerminationState, TerminationReason, TerminationUrgency, FinMessage, FinAckMessage, TerminationAckMessage, FinalStateSnapshot, OutstandingItems, SessionArchive, StateSnapshotBuilder, OutstandingItemsCollector, GracefulTerminationManager, HandoffManager, HandoffPackage, HandoffAcceptance, TerminationConfig, DEFAULT_TERMINATION_CONFIG, quickTerminate, abortSession, visualizeTermination, visualizeOutstanding, demoTermination, } from './termination';
export { ConnectionPool, getPool, quickStream, visualizePool, PriorityScheduler, StreamId, PoolKey, StreamState, ConnectionState, StreamPriority, MultiplexedStream, ContextFragment, StreamError, StreamErrorCode, PooledConnection, SessionContext, ConnectionMetrics, PoolConfig, DEFAULT_POOL_CONFIG, AcquireOptions, PoolStats, PoolState, PoolError, PoolExhaustedError, PoolTimeoutError, ConnectionNotReadyError, StreamLimitError, StreamNotFoundError, StreamClosedError, } from './pooling';
export { QoSManager, ContextClassifier, PriorityQueue, TrafficShaper, SLAMonitor, TrafficClass, ContextType, QoSMarking, QoSPacket, QueueConfig, TrafficPolicy, SLA, QoSStats, SLAViolation, } from './qos';
export { Tracer, Trace, Span, SpanKind, SpanStatus, SpanEvent, SpanLink, TraceContext, TraceExport, SpanExport, MetricsRegistry, MetricType, Metric, MetricPoint, HistogramBucket, HistogramValue, MetricsExport, MetricsSummary, HandshakeLogger, LogLevel, LogEntry, LogFilter, BoundLogger, HealthMonitor as ObservabilityHealthMonitor, HealthCheck, HealthStatus as ObservabilityHealthStatus, HealthReport, AlertManager, Alert, AlertRule, HandshakeObservability, HandshakeObserver, SpanHandle, DashboardData, ObservabilityExport, createObservability, formatDuration, formatBytes, } from './observability';
export { CongestionController, RenoCongestionController, CubicCongestionController, BbrCongestionController, AdaptiveCongestionController, RttEstimator, createCongestionController, createCongestionAwareSession, CongestionAlgorithm, CongestionState, CognitiveLoadSignal, BandwidthEstimate, CongestionEvent, CongestionWindow, CongestionMetrics, CongestionConfig, CongestionAwareSession, } from './congestion-control';
export { DeltaSyncManager, VectorClockManager, BloomFilterManager, MerkleTreeManager, DeltaOperationLog, ConflictResolver, createDeltaSync, demonstrateDeltaSync, VectorClock, DeltaOperation, MerkleNode, BloomFilter, DeltaBatch, SyncState, DiffResult, ConflictInfo, DeltaSyncConfig, } from './delta-sync';
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
