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
export {
  TrustMemory,
  TrustTier,
  TrustCapabilities,
  TRUST_CAPABILITIES,
  selectHandshakeType,
  createFastReconnect,
} from './trust';

// Gen 7: Memory-Aware Handshake
export {
  MemoryHandshake,
  resolveConflict,
} from './memory-handshake';

// Context utilities
export {
  hashContext,
  generateNonce,
  generateSessionId,
  buildMentalModel,
  extractConcepts,
  serializeContext,
  deserializeContext,
  compressContext,
} from './context';

// Alignment analysis
export {
  analyzeAlignment,
  quickAlignmentScore,
} from './alignment';

// Handshake state machine
export {
  ContextHandshake,
  performHandshake,
  formatHandshakeLog,
} from './handshake';

// Model merging
export {
  mergeModels,
  updateMergedModel,
} from './merge';

// Session management
export {
  ActiveSession,
  SessionStore,
  formatSession,
} from './session';

// Gen 8: Streaming Handshakes
export {
  StreamingHandshake,
  ContextChunker,
  StreamChunk,
  StreamSession,
  StreamStatus,
  StreamHandshakeResult,
  AlignmentSnapshot,
  DivergenceFlag,
  BandwidthConfig,
  DEFAULT_BANDWIDTH,
  visualizeStreamProgress,
  demoStreamingHandshake,
} from './streaming';

// Gen 6 Instance 28: Negotiation Protocol
export {
  NegotiationEngine,
  NegotiationProposal,
  NegotiationResponse,
  NegotiationSession,
  NegotiationRound,
  NegotiationConfig,
  NegotiationStrategy,
  StrategyProfile,
  Divergence,
  ResolvedDivergence,
  HandshakeWithNegotiation,
  handshakeWithNegotiation,
} from './negotiation';

// Gen 6 Instance 28: Multi-party Handshakes
export {
  MultipartyEngine,
  MultipartySession,
  MultipartyConfig,
  MultipartyPhase,
  MultipartyMetrics,
  PartyInfo,
  PartyRole,
  PartyStatus,
  TopologyStrategy,
  AlignmentMatrix,
  quickMultipartySync,
  swarmHandshake,
  isGroupAligned,
  getLeastAlignedPair,
} from './multiparty';

// Gen 6 Instance 28: Context Fingerprinting
export {
  ContextFingerprinting,
  ContextFingerprint,
  FingerprintComparison,
  DeltaSync,
  FingerprintCache,
  CollaboratorHistory,
  QuickSyncSession,
  QuickSyncMessage,
} from './fingerprinting';

// Gen 6 Instance 28: Context Compression
export {
  ContextCompressor,
  StreamingCompressor,
  CompressionTracker,
  CompressedContext,
  CompressionConfig,
  CompressionStats,
  CompressionMethod,
  SHARED_DICTIONARY,
  calculateSemanticSimilarity,
} from './compression';

// Gen 6 Instance 28: Resilience & Recovery
export {
  ResilientHandshakeExecutor,
  CheckpointManager,
  CircuitBreaker,
  GracefulDegradation,
  HealthMonitor,
  HandshakeCheckpoint,
  FailureEvent,
  FailureType,
  RecoveryStrategy,
  RecoveryPlan,
  DegradationLevel,
  CircuitState,
  ResilienceConfig,
  HealthStatus,
  DEFAULT_RESILIENCE_CONFIG,
  DEGRADATION_LEVELS,
  determineRecoveryStrategy,
} from './resilience';

// Gen 6 Instance 28: Keepalive & Drift Detection
export {
  KeepaliveManager,
  DriftAnalyzer,
  KeepaliveProbe,
  KeepaliveResponse,
  KeepaliveConfig,
  KeepaliveSession,
  DriftVector,
  DriftCause,
  DriftEvent,
  DriftPattern,
  ConceptSnapshot,
  CorrectionPatch,
  DEFAULT_KEEPALIVE_CONFIG,
  createKeepaliveManager,
  createDriftAnalyzer,
} from './keepalive';

// Gen 6 Instance 28: Authentication & Verification
export {
  IdentityManager,
  AuthenticationManager,
  MutualAuthenticator,
  TrustChainVerifier,
  AttestationManager,
  AuthenticatedHandshake,
  AgentIdentity,
  CapabilityClaim,
  CapabilityEvidence,
  AuthChallenge,
  AuthResponse,
  VerificationResult,
  TrustChain,
  generateAgentId,
  createCapabilityEvidence,
  selfDeclaredCapability,
} from './authentication';

// Gen 6 Instance 28: Context Versioning (Git-like mental model history)
export {
  ContextRepository,
  DistributedVersioning,
  createCollaborationSession,
  ContextCommit,
  ConceptVersion,
  BeliefVersion,
  ContextBranch,
  ContextDiff,
  MergeConflict,
  MergeResult,
  MergeStrategy,
  VersioningSyncMessage,
  ContextPullRequest,
  ContextPullResponse,
} from './versioning';

// Gen 6 Instance 28: Flow Control & Backpressure (TCP-like for mental models)
export {
  FlowControlManager,
  AdaptiveFlowController,
  AgingPriorityQueue,
  ContextChunk,
  ContextPayload,
  ChunkPriority,
  ContextAck,
  SelectiveAck,
  WindowAdvertisement,
  BackpressureSignal,
  FlowState,
  FlowControlConfig,
  FlowControlMetrics,
} from './flow-control';

// Gen 6 Instance 28: Connection Termination & Graceful Shutdown (TCP FIN/FIN-ACK)
export {
  // State Machine
  TerminationStateMachine,
  TerminationState,
  TerminationReason,
  TerminationUrgency,
  // Messages
  FinMessage,
  FinAckMessage,
  TerminationAckMessage,
  // State & Items
  FinalStateSnapshot,
  OutstandingItems,
  SessionArchive,
  // Builders
  StateSnapshotBuilder,
  OutstandingItemsCollector,
  // Managers
  GracefulTerminationManager,
  HandoffManager,
  HandoffPackage,
  HandoffAcceptance,
  // Config
  TerminationConfig,
  DEFAULT_TERMINATION_CONFIG,
  // Quick functions
  quickTerminate,
  abortSession,
  // Visualization
  visualizeTermination,
  visualizeOutstanding,
  demoTermination,
} from './termination';

// Gen 6 Instance 28: Connection Pooling & Multiplexing (HTTP/2-like)
export {
  // Core pool
  ConnectionPool,
  getPool,
  quickStream,
  visualizePool,
  // Scheduler
  PriorityScheduler,
  // Types
  StreamId,
  PoolKey,
  StreamState,
  ConnectionState,
  StreamPriority,
  MultiplexedStream,
  ContextFragment,
  StreamError,
  StreamErrorCode,
  PooledConnection,
  SessionContext,
  ConnectionMetrics,
  PoolConfig,
  DEFAULT_POOL_CONFIG,
  AcquireOptions,
  PoolStats,
  PoolState,
  // Errors
  PoolError,
  PoolExhaustedError,
  PoolTimeoutError,
  ConnectionNotReadyError,
  StreamLimitError,
  StreamNotFoundError,
  StreamClosedError,
} from './pooling';

// Gen 6 Instance 28: Quality of Service (DSCP-like for mental models)
export {
  // Core
  QoSManager,
  ContextClassifier,
  PriorityQueue,
  TrafficShaper,
  SLAMonitor,
  // Types
  TrafficClass,
  ContextType,
  QoSMarking,
  QoSPacket,
  QueueConfig,
  TrafficPolicy,
  SLA,
  QoSStats,
  SLAViolation,
} from './qos';

// Gen 6 Instance 28: Observability (Tracing, Metrics, Logging, Alerts)
export {
  // Tracing
  Tracer,
  Trace,
  Span,
  SpanKind,
  SpanStatus,
  SpanEvent,
  SpanLink,
  TraceContext,
  TraceExport,
  SpanExport,
  // Metrics
  MetricsRegistry,
  MetricType,
  Metric,
  MetricPoint,
  HistogramBucket,
  HistogramValue,
  MetricsExport,
  MetricsSummary,
  // Logging
  HandshakeLogger,
  LogLevel,
  LogEntry,
  LogFilter,
  BoundLogger,
  // Health
  HealthMonitor as ObservabilityHealthMonitor,
  HealthCheck,
  HealthStatus as ObservabilityHealthStatus,
  HealthReport,
  // Alerts
  AlertManager,
  Alert,
  AlertRule,
  // Unified
  HandshakeObservability,
  HandshakeObserver,
  SpanHandle,
  DashboardData,
  ObservabilityExport,
  createObservability,
  formatDuration,
  formatBytes,
} from './observability';

// Gen 6 Instance 28: Congestion Control (TCP Reno/Cubic/BBR for cognitive bandwidth)
export {
  // Controllers
  CongestionController,
  RenoCongestionController,
  CubicCongestionController,
  BbrCongestionController,
  AdaptiveCongestionController,
  // Utilities
  RttEstimator,
  createCongestionController,
  createCongestionAwareSession,
  // Types
  CongestionAlgorithm,
  CongestionState,
  CognitiveLoadSignal,
  BandwidthEstimate,
  CongestionEvent,
  CongestionWindow,
  CongestionMetrics,
  CongestionConfig,
  CongestionAwareSession,
} from './congestion-control';

// Gen 6 Instance 28: Delta Synchronization (CRDT-based context diffing)
export {
  // Core managers
  DeltaSyncManager,
  VectorClockManager,
  BloomFilterManager,
  MerkleTreeManager,
  DeltaOperationLog,
  ConflictResolver,
  createDeltaSync,
  demonstrateDeltaSync,
  // Types
  VectorClock,
  DeltaOperation,
  MerkleNode,
  BloomFilter,
  DeltaBatch,
  SyncState,
  DiffResult,
  ConflictInfo,
  DeltaSyncConfig,
} from './delta-sync';

// Gen 6 Instance 28: Empathy Protocol (Theory of Mind for AI-to-AI)
export {
  // Core
  EmpathyManager,
  createEmpathyManager,
  enrichContextWithEmpathy,
  adaptMessage,
  // Types - Cognitive State
  CognitiveState,
  UncertaintyZone,
  // Types - Bridging
  EmpathicBridge,
  UnderstandingGap,
  GapEvidence,
  BridgingContext,
  Explanation,
  VocabularyMapping,
  ExplicitAssumption,
  ConceptExample,
  TriggerCondition,
  // Types - Prediction
  PredictiveNeed,
  PreparedResponse,
  PredictionBasis,
  // Types - Emotional
  EmotionalContagion,
  EmotionalState,
  ContagionResponse,
  CommunicationAdjustment,
  // Types - Agent Model
  AgentModel,
  CommunicationPreferences,
  // Types - Events & Config
  EmpathyEvent,
  EmpathyEventHandler,
  EmpathyConfig,
  EmpathyReport,
  MessageObservation,
  AdaptedMessage,
} from './empathy';

// Gen 6 Instance 28: Circuit Breaker (Failure isolation for collaboration partners)
export {
  // Core
  CircuitBreakerManager,
  AdaptiveCircuitBreakerManager,
  // Middleware
  withCircuitBreaker,
  // Selection
  selectBestAgent,
  // Types
  CircuitState as CBCircuitState,
  FailureReason,
  FailureRecord,
  CircuitBreakerConfig,
  CircuitSnapshot,
  CircuitEvent,
  CircuitEventListener,
  CircuitBreakerResult,
} from './circuit-breaker';

// Gen 6 Instance 28: Context Speculation (TCP Fast Open for mental models)
export {
  // Core
  ContextSpeculationEngine,
  SpeculativeHandshake,
  createSpeculationEngine,
  // Types - Patterns
  ContextPattern,
  ConceptFrequency,
  TemporalPattern,
  SuccessCorrelation,
  // Types - Speculation
  SpeculativeContext,
  PredictedConcept,
  SpeculationResult,
  // Types - Learning
  PatternLearning,
  // Types - Analysis
  SpeculationAnalysis,
  PatternExport,
  SpeculationStats,
  SpeculationOptions,
} from './speculation';

// Gen 6 Instance 28: Context Federation (Cross-domain context sharing)
export {
  // Core Manager
  FederationManager,
  createFederationManager,
  // Domain Management
  DomainRegistry,
  createDomainMetadata,
  createDefaultPolicy,
  // Trust
  TrustFederationManager,
  FederationTrustLevel,
  // Consent
  ConsentEngine,
  ConsentDecision,
  // Context Brokering
  ContextBroker,
  // Sessions
  FederationSessionManager,
  // Message Types
  FederationMessageType,
  // Demo
  demoFederation,
  // Types
  type DomainId,
  type FederationSessionId,
  type ContextAttributeCategory,
  type DomainMetadata,
  type AttributeReleasePolicy,
  type FederatedContextAttribute,
  type FederationTrust,
  type FederationSession,
  type ConsentRecord,
  type FederationSessionMetrics,
  type FederationEvent,
  type FederationEventHandler,
  type FederationConfig,
} from './federation';

// Gen 6 Instance 28: Context Routing & Agent Discovery (DNS + BGP for AI minds)
export {
  // Core Router
  ContextRouter,
  createRouter,
  quickDiscover,
  demoRouting,
  // Registry
  AgentRegistry,
  // Route Table
  RouteTable,
  // Relay
  RelayAgent,
  // Enums
  DiscoveryMethod,
  AgentStatus,
  RouteHealth,
  // Types
  type AgentAddress,
  type NetworkId,
  type RouteId,
  type CapabilityTag,
  type CapabilityRecord,
  type AgentPresence,
  type Route,
  type RouteAnnouncement,
  type CapabilityQuery,
  type CapabilityMatch,
  type RoutingPolicy,
  type RoutingEvent,
  type RoutingEventHandler,
  type RelayTransform,
  type RelayConfig,
  type RouterConfig,
  type ContextPacket,
  type ContextAck as RoutingContextAck,
  type TopologySnapshot,
  // Defaults
  DEFAULT_ROUTING_POLICY,
  DEFAULT_RELAY_CONFIG,
  DEFAULT_ROUTER_CONFIG,
} from './routing';

// Gen 6 Instance 28: Context Lifecycle & Garbage Collection
export {
  // Core Manager
  ContextLifecycleManager,
  // Supporting Systems
  ReferenceGraph,
  GenerationalSpace,
  LeakDetector,
  FinalizerQueue,
  CompactionEngine,
  // Pre-configured Policies
  Policies,
  // Types
  type ContextState,
  type ContextHandle,
  type StateTransition,
  type GCPolicy,
  type GCResult,
  type GCError,
  type LeakDetectionReport,
  type LeakSuspect,
  type LifecycleEvent,
  type ReferenceEdge,
  type CompactionResult,
} from './lifecycle';

// Gen 6 Instance 28: Context Caching & Invalidation (HTTP-style caching for mental models)
export {
  // Core
  ContextCache,
  CachedHandshakeLayer,
  CachePartition,
  ETagGenerator,
  CachePresets,
  // Types
  type CacheDirectives,
  type ETag,
  type FreshnessStatus,
  type CacheEntry,
  type CacheLookup,
  type InvalidationEvent,
  type RevalidationRequest,
  type RevalidationResponse,
  type EvictionPolicy,
  type CacheStats,
  type CacheConfig,
} from './caching';

// Privacy & Selective Disclosure
export {
  PrivacyController,
  PrivacyPolicyEngine,
  ConsentManager,
  DifferentialPrivacyEngine,
  ZeroKnowledgeProver,
  SelectiveViewBuilder,
  DisclosureAuditor,
  DataMinimizationAdvisor,
  SensitivityLevel,
  RedactionStrategy,
  type PrivacyPolicy,
  type PrivacyRule,
  type DisclosureCondition,
  type ConsentRecord,
  type DisclosureReceipt,
  type RedactionRecord,
  type ZeroKnowledgeProof,
  type PrivacyBudget,
  type SelectiveView,
} from './privacy';

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
