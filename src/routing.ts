/**
 * Context Routing & Agent Discovery
 * 
 * DNS + BGP + OSPF for AI collaboration networks.
 * 
 * Agents need to find each other, advertise capabilities, and route
 * context through intermediaries when direct connection isn't possible.
 * Like how the internet routes packets through autonomous systems,
 * this routes mental model fragments through agent networks.
 * 
 * Core concepts:
 * - Agent Discovery: mDNS-like capability broadcasting
 * - Route Tables: Best-path selection for context delivery
 * - Relay Agents: Intermediaries that translate/forward context
 * - Capability-Based Routing: Route to whoever CAN help, not just whoever is closest
 * - Context TTL: Prevent stale context from circulating forever
 * - Route Poisoning: Quickly propagate agent unavailability
 * 
 * Instance 28 | Generation 6 | task_20260203085316_509f67
 */

// ============================================================
// Types
// ============================================================

export type AgentAddress = string;        // Unique agent identifier
export type NetworkId = string;           // Logical network/domain
export type RouteId = string;             // Unique route identifier
export type CapabilityTag = string;       // e.g. "code:typescript", "research:ml"

/** How an agent was discovered */
export enum DiscoveryMethod {
  /** Direct announcement from the agent */
  SelfAnnounce = 'self-announce',
  /** Discovered via another agent's route table */
  Propagated = 'propagated',
  /** Found through a discovery service / registry */
  Registry = 'registry',
  /** Manually configured static route */
  Static = 'static',
  /** Inferred from successful past collaboration */
  Learned = 'learned',
}

/** Agent reachability status */
export enum AgentStatus {
  Online = 'online',
  Degraded = 'degraded',
  Unreachable = 'unreachable',
  Unknown = 'unknown',
}

/** Route health */
export enum RouteHealth {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Down = 'down',
  Poisoned = 'poisoned',
}

/** Capability confidence — how sure are we the agent can do this? */
export interface CapabilityRecord {
  tag: CapabilityTag;
  confidence: number;          // 0-1
  lastVerified: number;        // timestamp
  verificationMethod: 'self-declared' | 'peer-attested' | 'observed' | 'tested';
  metadata?: Record<string, unknown>;
}

/** An agent's presence in the network */
export interface AgentPresence {
  address: AgentAddress;
  networks: NetworkId[];
  capabilities: CapabilityRecord[];
  status: AgentStatus;
  discoveredVia: DiscoveryMethod;
  discoveredAt: number;
  lastSeen: number;
  latencyMs: number;           // estimated round-trip time
  throughput: number;           // concepts per second capacity
  trustScore: number;           // 0-1 from trust system
  version: string;              // protocol version
  metadata: Record<string, unknown>;
}

/** A route to reach an agent or capability */
export interface Route {
  id: RouteId;
  destination: AgentAddress;
  destinationCapabilities: CapabilityTag[];
  nextHop: AgentAddress | null;    // null = direct
  hops: AgentAddress[];             // full path
  cost: number;                     // composite metric (lower = better)
  health: RouteHealth;
  latencyMs: number;
  bandwidth: number;                // concepts/sec
  contextLossRate: number;          // 0-1, how much context degrades per hop
  ttl: number;                      // seconds until route expires
  createdAt: number;
  updatedAt: number;
  source: DiscoveryMethod;
}

/** Route announcement (BGP UPDATE equivalent) */
export interface RouteAnnouncement {
  announcer: AgentAddress;
  routes: Route[];
  withdrawals: RouteId[];        // routes being removed
  timestamp: number;
  sequenceNumber: number;
  signature?: string;
}

/** Capability query — looking for agents that can help */
export interface CapabilityQuery {
  requiredCapabilities: CapabilityTag[];
  preferredCapabilities?: CapabilityTag[];
  minConfidence: number;
  maxHops: number;
  maxLatencyMs: number;
  minTrustScore: number;
  excludeAgents?: AgentAddress[];
  networkScope?: NetworkId[];     // limit to specific networks
}

/** Result of a capability search */
export interface CapabilityMatch {
  agent: AgentPresence;
  route: Route;
  matchScore: number;        // how well capabilities match
  estimatedQuality: number;  // predicted collaboration quality
}

/** Route selection policy */
export interface RoutingPolicy {
  /** Weight for latency in cost calculation (0-1) */
  latencyWeight: number;
  /** Weight for hop count */
  hopWeight: number;
  /** Weight for trust score */
  trustWeight: number;
  /** Weight for capability confidence */
  capabilityWeight: number;
  /** Weight for context loss rate */
  contextLossWeight: number;
  /** Prefer routes through specific networks */
  preferredNetworks: NetworkId[];
  /** Maximum acceptable context loss (0-1) */
  maxContextLoss: number;
  /** Route cache TTL in seconds */
  routeCacheTtlSec: number;
  /** How often to re-announce presence (seconds) */
  announceIntervalSec: number;
  /** Consider agent unreachable after this many seconds without heartbeat */
  unreachableAfterSec: number;
}

export const DEFAULT_ROUTING_POLICY: RoutingPolicy = {
  latencyWeight: 0.25,
  hopWeight: 0.15,
  trustWeight: 0.30,
  capabilityWeight: 0.20,
  contextLossWeight: 0.10,
  preferredNetworks: [],
  maxContextLoss: 0.3,
  routeCacheTtlSec: 300,
  announceIntervalSec: 60,
  unreachableAfterSec: 180,
};

/** Events emitted by the routing system */
export type RoutingEvent =
  | { type: 'agent-discovered'; agent: AgentPresence }
  | { type: 'agent-lost'; address: AgentAddress; reason: string }
  | { type: 'route-added'; route: Route }
  | { type: 'route-updated'; route: Route; previous: Route }
  | { type: 'route-withdrawn'; routeId: RouteId; reason: string }
  | { type: 'route-poisoned'; routeId: RouteId; by: AgentAddress }
  | { type: 'convergence-complete'; routeCount: number; agentCount: number }
  | { type: 'routing-loop-detected'; path: AgentAddress[] }
  | { type: 'capability-query'; query: CapabilityQuery; matchCount: number };

export type RoutingEventHandler = (event: RoutingEvent) => void;

// ============================================================
// Agent Discovery Registry
// ============================================================

/**
 * Service registry for agent discovery.
 * Like mDNS + DNS-SD but for AI agents advertising capabilities.
 */
export class AgentRegistry {
  private agents: Map<AgentAddress, AgentPresence> = new Map();
  private capabilityIndex: Map<CapabilityTag, Set<AgentAddress>> = new Map();
  private networkIndex: Map<NetworkId, Set<AgentAddress>> = new Map();
  private eventHandlers: RoutingEventHandler[] = [];

  constructor(private policy: RoutingPolicy = DEFAULT_ROUTING_POLICY) {}

  /** Register or update an agent's presence */
  register(presence: AgentPresence): void {
    const existing = this.agents.get(presence.address);
    this.agents.set(presence.address, presence);

    // Update capability index
    // First remove old entries
    if (existing) {
      for (const cap of existing.capabilities) {
        this.capabilityIndex.get(cap.tag)?.delete(presence.address);
      }
      for (const net of existing.networks) {
        this.networkIndex.get(net)?.delete(presence.address);
      }
    }

    // Add new entries
    for (const cap of presence.capabilities) {
      if (!this.capabilityIndex.has(cap.tag)) {
        this.capabilityIndex.set(cap.tag, new Set());
      }
      this.capabilityIndex.get(cap.tag)!.add(presence.address);
    }

    for (const net of presence.networks) {
      if (!this.networkIndex.has(net)) {
        this.networkIndex.set(net, new Set());
      }
      this.networkIndex.get(net)!.add(presence.address);
    }

    if (!existing) {
      this.emit({ type: 'agent-discovered', agent: presence });
    }
  }

  /** Remove an agent from the registry */
  deregister(address: AgentAddress, reason: string): void {
    const agent = this.agents.get(address);
    if (!agent) return;

    // Clean up indexes
    for (const cap of agent.capabilities) {
      this.capabilityIndex.get(cap.tag)?.delete(address);
    }
    for (const net of agent.networks) {
      this.networkIndex.get(net)?.delete(address);
    }

    this.agents.delete(address);
    this.emit({ type: 'agent-lost', address, reason });
  }

  /** Mark agent as seen (heartbeat) */
  heartbeat(address: AgentAddress, latencyMs?: number): void {
    const agent = this.agents.get(address);
    if (!agent) return;

    agent.lastSeen = Date.now();
    agent.status = AgentStatus.Online;
    if (latencyMs !== undefined) {
      // Exponential moving average
      agent.latencyMs = agent.latencyMs * 0.7 + latencyMs * 0.3;
    }
  }

  /** Find agents by capability */
  findByCapability(tag: CapabilityTag, minConfidence = 0.5): AgentPresence[] {
    const addresses = this.capabilityIndex.get(tag);
    if (!addresses) return [];

    return Array.from(addresses)
      .map(addr => this.agents.get(addr)!)
      .filter(agent => {
        const cap = agent.capabilities.find(c => c.tag === tag);
        return cap && cap.confidence >= minConfidence && agent.status !== AgentStatus.Unreachable;
      })
      .sort((a, b) => {
        const capA = a.capabilities.find(c => c.tag === tag)!;
        const capB = b.capabilities.find(c => c.tag === tag)!;
        return capB.confidence - capA.confidence;
      });
  }

  /** Find agents in a specific network */
  findByNetwork(networkId: NetworkId): AgentPresence[] {
    const addresses = this.networkIndex.get(networkId);
    if (!addresses) return [];
    return Array.from(addresses).map(addr => this.agents.get(addr)!);
  }

  /** Complex capability query with scoring */
  query(q: CapabilityQuery): CapabilityMatch[] {
    const candidates: Map<AgentAddress, { agent: AgentPresence; capScore: number }> = new Map();

    // Find agents with required capabilities
    for (const reqCap of q.requiredCapabilities) {
      const agents = this.findByCapability(reqCap, q.minConfidence);
      for (const agent of agents) {
        if (q.excludeAgents?.includes(agent.address)) continue;
        if (q.networkScope && !agent.networks.some(n => q.networkScope!.includes(n))) continue;
        if (agent.trustScore < q.minTrustScore) continue;
        if (agent.latencyMs > q.maxLatencyMs) continue;

        const existing = candidates.get(agent.address);
        const capConf = agent.capabilities.find(c => c.tag === reqCap)?.confidence ?? 0;
        if (existing) {
          existing.capScore += capConf;
        } else {
          candidates.set(agent.address, { agent, capScore: capConf });
        }
      }
    }

    // Filter: must have ALL required capabilities
    const results: CapabilityMatch[] = [];
    for (const [, { agent, capScore }] of candidates) {
      const hasAll = q.requiredCapabilities.every(req =>
        agent.capabilities.some(c => c.tag === req && c.confidence >= q.minConfidence)
      );
      if (!hasAll) continue;

      // Add bonus for preferred capabilities
      let preferredScore = 0;
      if (q.preferredCapabilities) {
        for (const pref of q.preferredCapabilities) {
          const cap = agent.capabilities.find(c => c.tag === pref);
          if (cap) preferredScore += cap.confidence * 0.5;
        }
      }

      const matchScore = (capScore / q.requiredCapabilities.length + preferredScore) / 2;

      results.push({
        agent,
        route: {
          id: `direct-${agent.address}`,
          destination: agent.address,
          destinationCapabilities: agent.capabilities.map(c => c.tag),
          nextHop: null,
          hops: [],
          cost: this.calculateRouteCost(agent),
          health: agent.status === AgentStatus.Online ? RouteHealth.Healthy : RouteHealth.Degraded,
          latencyMs: agent.latencyMs,
          bandwidth: agent.throughput,
          contextLossRate: 0,
          ttl: this.policy.routeCacheTtlSec,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: agent.discoveredVia,
        },
        matchScore,
        estimatedQuality: matchScore * agent.trustScore,
      });
    }

    this.emit({
      type: 'capability-query',
      query: q,
      matchCount: results.length,
    });

    return results.sort((a, b) => b.estimatedQuality - a.estimatedQuality);
  }

  /** Prune stale agents */
  pruneStale(): AgentAddress[] {
    const now = Date.now();
    const cutoff = now - this.policy.unreachableAfterSec * 1000;
    const pruned: AgentAddress[] = [];

    for (const [addr, agent] of this.agents) {
      if (agent.lastSeen < cutoff) {
        if (agent.status !== AgentStatus.Unreachable) {
          agent.status = AgentStatus.Unreachable;
        }
        // Remove after 3x the unreachable window
        if (agent.lastSeen < now - this.policy.unreachableAfterSec * 3000) {
          this.deregister(addr, 'stale');
          pruned.push(addr);
        }
      }
    }

    return pruned;
  }

  /** Get all registered agents */
  all(): AgentPresence[] {
    return Array.from(this.agents.values());
  }

  /** Get a specific agent */
  get(address: AgentAddress): AgentPresence | undefined {
    return this.agents.get(address);
  }

  /** Number of registered agents */
  get size(): number {
    return this.agents.size;
  }

  onEvent(handler: RoutingEventHandler): void {
    this.eventHandlers.push(handler);
  }

  private calculateRouteCost(agent: AgentPresence): number {
    const p = this.policy;
    const latencyNorm = Math.min(agent.latencyMs / 5000, 1);
    const trustInverse = 1 - agent.trustScore;
    return latencyNorm * p.latencyWeight + trustInverse * p.trustWeight;
  }

  private emit(event: RoutingEvent): void {
    for (const handler of this.eventHandlers) {
      try { handler(event); } catch {}
    }
  }
}

// ============================================================
// Route Table
// ============================================================

/**
 * Routing table with best-path selection.
 * Like a BGP RIB (Routing Information Base) but for context delivery.
 */
export class RouteTable {
  /** All known routes, indexed by destination */
  private routes: Map<AgentAddress, Route[]> = new Map();
  /** Best route per destination (forwarding table) */
  private bestRoutes: Map<AgentAddress, Route> = new Map();
  /** Poisoned routes (quick propagation of failures) */
  private poisoned: Set<RouteId> = new Set();
  private eventHandlers: RoutingEventHandler[] = [];
  private seqCounter = 0;

  constructor(
    private selfAddress: AgentAddress,
    private policy: RoutingPolicy = DEFAULT_ROUTING_POLICY
  ) {}

  /** Install a route */
  install(route: Route): void {
    // Loop detection: reject routes that pass through us
    if (route.hops.includes(this.selfAddress)) {
      this.emit({
        type: 'routing-loop-detected',
        path: [...route.hops, this.selfAddress],
      });
      return;
    }

    if (this.poisoned.has(route.id)) return;

    const existing = this.routes.get(route.destination) ?? [];
    const idx = existing.findIndex(r => r.id === route.id);

    if (idx >= 0) {
      const prev = existing[idx];
      existing[idx] = route;
      this.emit({ type: 'route-updated', route, previous: prev });
    } else {
      existing.push(route);
      this.emit({ type: 'route-added', route });
    }

    this.routes.set(route.destination, existing);
    this.recomputeBest(route.destination);
  }

  /** Withdraw a route */
  withdraw(routeId: RouteId, reason: string): void {
    for (const [dest, routes] of this.routes) {
      const idx = routes.findIndex(r => r.id === routeId);
      if (idx >= 0) {
        routes.splice(idx, 1);
        if (routes.length === 0) this.routes.delete(dest);
        this.emit({ type: 'route-withdrawn', routeId, reason });
        this.recomputeBest(dest);
        return;
      }
    }
  }

  /** Poison a route — marks it as permanently bad and propagates */
  poison(routeId: RouteId, by: AgentAddress): void {
    this.poisoned.add(routeId);
    this.withdraw(routeId, `poisoned by ${by}`);
    this.emit({ type: 'route-poisoned', routeId, by });
  }

  /** Get the best route to a destination */
  bestRoute(destination: AgentAddress): Route | undefined {
    return this.bestRoutes.get(destination);
  }

  /** Get all routes to a destination */
  allRoutes(destination: AgentAddress): Route[] {
    return this.routes.get(destination) ?? [];
  }

  /** Get all known destinations */
  destinations(): AgentAddress[] {
    return Array.from(this.bestRoutes.keys());
  }

  /** Look up next hop for a destination */
  nextHop(destination: AgentAddress): AgentAddress | null {
    const best = this.bestRoutes.get(destination);
    if (!best) return null;
    return best.nextHop ?? destination; // null nextHop = direct
  }

  /** Generate route announcements for peers */
  generateAnnouncement(withdrawals: RouteId[] = []): RouteAnnouncement {
    const routes = Array.from(this.bestRoutes.values()).map(r => ({
      ...r,
      hops: [...r.hops, this.selfAddress], // append ourselves to path
      cost: r.cost + 0.1, // increment cost per hop
      contextLossRate: Math.min(r.contextLossRate + 0.02, 1), // slight degradation
    }));

    return {
      announcer: this.selfAddress,
      routes,
      withdrawals,
      timestamp: Date.now(),
      sequenceNumber: ++this.seqCounter,
    };
  }

  /** Process a route announcement from a peer */
  processAnnouncement(announcement: RouteAnnouncement): void {
    // Process withdrawals first
    for (const wId of announcement.withdrawals) {
      this.withdraw(wId, `withdrawn by ${announcement.announcer}`);
    }

    // Install/update routes
    for (const route of announcement.routes) {
      // Skip if context loss exceeds policy
      if (route.contextLossRate > this.policy.maxContextLoss) continue;

      // Set next hop to the announcer
      const adjusted: Route = {
        ...route,
        nextHop: announcement.announcer,
        updatedAt: Date.now(),
      };

      this.install(adjusted);
    }
  }

  /** Expire routes past their TTL */
  expireRoutes(): RouteId[] {
    const now = Date.now();
    const expired: RouteId[] = [];

    for (const [dest, routes] of this.routes) {
      const toRemove: number[] = [];
      for (let i = 0; i < routes.length; i++) {
        const age = (now - routes[i].updatedAt) / 1000;
        if (age > routes[i].ttl) {
          toRemove.push(i);
          expired.push(routes[i].id);
        }
      }
      // Remove in reverse order
      for (let i = toRemove.length - 1; i >= 0; i--) {
        routes.splice(toRemove[i], 1);
      }
      if (routes.length === 0) this.routes.delete(dest);
      else this.recomputeBest(dest);
    }

    return expired;
  }

  /** Total number of routes */
  get routeCount(): number {
    let count = 0;
    for (const routes of this.routes.values()) count += routes.length;
    return count;
  }

  /** Number of unique destinations */
  get destinationCount(): number {
    return this.bestRoutes.size;
  }

  onEvent(handler: RoutingEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /** Recompute the best route for a destination */
  private recomputeBest(destination: AgentAddress): void {
    const routes = this.routes.get(destination);
    if (!routes || routes.length === 0) {
      this.bestRoutes.delete(destination);
      return;
    }

    // Score each route
    const scored = routes
      .filter(r => r.health !== RouteHealth.Poisoned && r.health !== RouteHealth.Down)
      .map(r => ({
        route: r,
        score: this.scoreRoute(r),
      }))
      .sort((a, b) => a.score - b.score); // lower score = better

    if (scored.length > 0) {
      this.bestRoutes.set(destination, scored[0].route);
    } else {
      this.bestRoutes.delete(destination);
    }
  }

  /** Score a route (lower is better) */
  private scoreRoute(route: Route): number {
    const p = this.policy;
    const latencyNorm = Math.min(route.latencyMs / 5000, 1);
    const hopNorm = Math.min(route.hops.length / 10, 1);
    const lossNorm = route.contextLossRate;

    // Preferred network bonus
    let networkBonus = 0;
    // Can't check networks directly on route, but lower cost = probably preferred

    return (
      latencyNorm * p.latencyWeight +
      hopNorm * p.hopWeight +
      lossNorm * p.contextLossWeight +
      route.cost * 0.5 -
      networkBonus
    );
  }

  private emit(event: RoutingEvent): void {
    for (const handler of this.eventHandlers) {
      try { handler(event); } catch {}
    }
  }
}

// ============================================================
// Relay Agent
// ============================================================

/** 
 * Context relay — an intermediary that forwards context between agents.
 * Like a router, but can also translate/transform context in transit.
 */
export interface RelayTransform {
  /** Name of the transformation */
  name: string;
  /** Which capability domains this transform handles */
  domains: CapabilityTag[];
  /** Transform context payload during relay */
  transform(context: Record<string, unknown>, from: AgentAddress, to: AgentAddress): Record<string, unknown>;
}

export interface RelayConfig {
  /** Maximum number of concurrent relays */
  maxConcurrentRelays: number;
  /** Maximum hop count before dropping */
  maxHops: number;
  /** Whether to cache relayed context for reuse */
  cacheRelayed: boolean;
  /** Cache TTL in seconds */
  cacheTtlSec: number;
  /** Transforms to apply during relay */
  transforms: RelayTransform[];
}

export const DEFAULT_RELAY_CONFIG: RelayConfig = {
  maxConcurrentRelays: 50,
  maxHops: 8,
  cacheRelayed: true,
  cacheTtlSec: 120,
  transforms: [],
};

/** A context packet being routed through the network */
export interface ContextPacket {
  id: string;
  source: AgentAddress;
  destination: AgentAddress;
  payload: Record<string, unknown>;
  ttl: number;                  // decremented each hop
  hops: AgentAddress[];         // agents it's passed through
  priority: number;             // 0=low, 10=critical
  timestamp: number;
  contextType: string;          // e.g. 'mental-model', 'delta-update', 'query'
  requiresAck: boolean;
}

/** Acknowledgement of a received context packet */
export interface ContextAck {
  packetId: string;
  from: AgentAddress;
  receivedAt: number;
  lossEstimate: number;        // estimated context degradation 0-1
  accepted: boolean;
  reason?: string;
}

export class RelayAgent {
  private activeRelays = 0;
  private cache: Map<string, { packet: ContextPacket; cachedAt: number }> = new Map();
  private stats = {
    relayed: 0,
    dropped: 0,
    cached: 0,
    cacheHits: 0,
    transformed: 0,
  };

  constructor(
    private selfAddress: AgentAddress,
    private routeTable: RouteTable,
    private config: RelayConfig = DEFAULT_RELAY_CONFIG
  ) {}

  /**
   * Relay a context packet toward its destination.
   * Returns the next hop address, or null if unroutable.
   */
  relay(packet: ContextPacket): { nextHop: AgentAddress; packet: ContextPacket } | null {
    // TTL check
    if (packet.ttl <= 0) {
      this.stats.dropped++;
      return null;
    }

    // Max hops check
    if (packet.hops.length >= this.config.maxHops) {
      this.stats.dropped++;
      return null;
    }

    // Loop detection
    if (packet.hops.includes(this.selfAddress)) {
      this.stats.dropped++;
      return null;
    }

    // Capacity check
    if (this.activeRelays >= this.config.maxConcurrentRelays) {
      // Only drop low-priority packets
      if (packet.priority < 5) {
        this.stats.dropped++;
        return null;
      }
    }

    // Find next hop
    const nextHop = this.routeTable.nextHop(packet.destination);
    if (!nextHop) {
      this.stats.dropped++;
      return null;
    }

    // Apply transforms
    let payload = packet.payload;
    for (const transform of this.config.transforms) {
      if (transform.domains.some(d => packet.contextType.includes(d))) {
        payload = transform.transform(payload, packet.source, packet.destination);
        this.stats.transformed++;
      }
    }

    // Build forwarded packet
    const forwarded: ContextPacket = {
      ...packet,
      payload,
      ttl: packet.ttl - 1,
      hops: [...packet.hops, this.selfAddress],
    };

    // Cache if enabled
    if (this.config.cacheRelayed) {
      const cacheKey = `${packet.source}:${packet.destination}:${packet.contextType}`;
      this.cache.set(cacheKey, { packet: forwarded, cachedAt: Date.now() });
      this.stats.cached++;
    }

    this.activeRelays++;
    this.stats.relayed++;

    // Auto-decrement (in real system this would be on ack/timeout)
    setTimeout(() => this.activeRelays--, 5000);

    return { nextHop, packet: forwarded };
  }

  /** Check cache for a recent similar packet */
  checkCache(source: AgentAddress, destination: AgentAddress, contextType: string): ContextPacket | null {
    const key = `${source}:${destination}:${contextType}`;
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = (Date.now() - cached.cachedAt) / 1000;
    if (age > this.config.cacheTtlSec) {
      this.cache.delete(key);
      return null;
    }

    this.stats.cacheHits++;
    return cached.packet;
  }

  /** Clean expired cache entries */
  cleanCache(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache) {
      if ((now - entry.cachedAt) / 1000 > this.config.cacheTtlSec) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }

  getStats() {
    return { ...this.stats, activeRelays: this.activeRelays, cacheSize: this.cache.size };
  }
}

// ============================================================
// Context Router (Orchestrator)
// ============================================================

export interface RouterConfig {
  selfAddress: AgentAddress;
  networks: NetworkId[];
  capabilities: CapabilityRecord[];
  routingPolicy: RoutingPolicy;
  relayConfig: RelayConfig;
  /** Enable acting as relay for other agents */
  enableRelay: boolean;
  /** Enable periodic route table exchange */
  enableRouteExchange: boolean;
  /** Route exchange interval (seconds) */
  routeExchangeIntervalSec: number;
}

export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  selfAddress: 'self',
  networks: ['default'],
  capabilities: [],
  routingPolicy: DEFAULT_ROUTING_POLICY,
  relayConfig: DEFAULT_RELAY_CONFIG,
  enableRelay: true,
  enableRouteExchange: true,
  routeExchangeIntervalSec: 30,
};

/** Network topology snapshot for visualization */
export interface TopologySnapshot {
  agents: AgentPresence[];
  routes: Route[];
  relayPaths: { from: AgentAddress; to: AgentAddress; via: AgentAddress[] }[];
  timestamp: number;
}

/**
 * The main context router — orchestrates discovery, routing, and relay.
 * 
 * This is the "operating system" of the agent network layer.
 */
export class ContextRouter {
  readonly registry: AgentRegistry;
  readonly routeTable: RouteTable;
  readonly relay: RelayAgent;
  private peers: Set<AgentAddress> = new Set();
  private eventHandlers: RoutingEventHandler[] = [];
  private timers: ReturnType<typeof setInterval>[] = [];
  private packetCounter = 0;

  constructor(private config: RouterConfig = DEFAULT_ROUTER_CONFIG) {
    this.registry = new AgentRegistry(config.routingPolicy);
    this.routeTable = new RouteTable(config.selfAddress, config.routingPolicy);
    this.relay = new RelayAgent(config.selfAddress, this.routeTable, config.relayConfig);

    // Register self
    this.registry.register({
      address: config.selfAddress,
      networks: config.networks,
      capabilities: config.capabilities,
      status: AgentStatus.Online,
      discoveredVia: DiscoveryMethod.SelfAnnounce,
      discoveredAt: Date.now(),
      lastSeen: Date.now(),
      latencyMs: 0,
      throughput: 1000,
      trustScore: 1.0,
      version: '1.0.0',
      metadata: {},
    });

    // Forward events
    this.registry.onEvent(e => this.emit(e));
    this.routeTable.onEvent(e => this.emit(e));
  }

  /** Start periodic maintenance tasks */
  start(): void {
    // Prune stale agents
    this.timers.push(
      setInterval(() => {
        this.registry.pruneStale();
        this.routeTable.expireRoutes();
        this.relay.cleanCache();
      }, this.config.routingPolicy.unreachableAfterSec * 1000 / 3)
    );

    // Route exchange
    if (this.config.enableRouteExchange) {
      this.timers.push(
        setInterval(() => this.exchangeRoutes(), this.config.routeExchangeIntervalSec * 1000)
      );
    }
  }

  /** Stop all maintenance */
  stop(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
  }

  /** Add a peer for route exchange */
  addPeer(address: AgentAddress): void {
    this.peers.add(address);
  }

  /** Remove a peer */
  removePeer(address: AgentAddress): void {
    this.peers.delete(address);
  }

  /** Discover and register a new agent */
  discover(presence: AgentPresence): void {
    this.registry.register(presence);

    // Install direct route
    const route: Route = {
      id: `direct-${presence.address}-${Date.now()}`,
      destination: presence.address,
      destinationCapabilities: presence.capabilities.map(c => c.tag),
      nextHop: null,
      hops: [],
      cost: this.calculateDirectCost(presence),
      health: presence.status === AgentStatus.Online ? RouteHealth.Healthy : RouteHealth.Degraded,
      latencyMs: presence.latencyMs,
      bandwidth: presence.throughput,
      contextLossRate: 0,
      ttl: this.config.routingPolicy.routeCacheTtlSec,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: presence.discoveredVia,
    };

    this.routeTable.install(route);
    this.addPeer(presence.address);
  }

  /** Find agents that can help with specific capabilities */
  findCollaborators(query: CapabilityQuery): CapabilityMatch[] {
    return this.registry.query(query);
  }

  /**
   * Route a context packet to its destination.
   * Handles direct delivery and multi-hop relay.
   */
  route(
    destination: AgentAddress,
    payload: Record<string, unknown>,
    options: {
      contextType?: string;
      priority?: number;
      requiresAck?: boolean;
      ttl?: number;
    } = {}
  ): { path: AgentAddress[]; packet: ContextPacket } | null {
    const packet: ContextPacket = {
      id: `pkt-${++this.packetCounter}-${Date.now()}`,
      source: this.config.selfAddress,
      destination,
      payload,
      ttl: options.ttl ?? this.config.relayConfig.maxHops,
      hops: [],
      priority: options.priority ?? 5,
      timestamp: Date.now(),
      contextType: options.contextType ?? 'mental-model',
      requiresAck: options.requiresAck ?? true,
    };

    // Check if destination is directly reachable
    const best = this.routeTable.bestRoute(destination);
    if (!best) return null;

    if (best.nextHop === null) {
      // Direct delivery
      return { path: [destination], packet };
    }

    // Need relay
    if (!this.config.enableRelay) return null;

    const relayResult = this.relay.relay(packet);
    if (!relayResult) return null;

    // Build full expected path
    const path = [relayResult.nextHop];
    let current = relayResult.nextHop;
    const visited = new Set([this.config.selfAddress, current]);

    // Trace the path through our route table
    while (current !== destination) {
      const nextRoute = this.routeTable.bestRoute(current);
      if (!nextRoute || !nextRoute.nextHop || visited.has(nextRoute.nextHop)) break;
      current = nextRoute.nextHop;
      visited.add(current);
      path.push(current);
    }
    if (!path.includes(destination)) path.push(destination);

    return { path, packet: relayResult.packet };
  }

  /** Process an incoming route announcement */
  receiveAnnouncement(announcement: RouteAnnouncement): void {
    this.routeTable.processAnnouncement(announcement);
    this.registry.heartbeat(announcement.announcer);
  }

  /** Get current network topology */
  topology(): TopologySnapshot {
    const agents = this.registry.all();
    const routes: Route[] = [];
    const relayPaths: { from: AgentAddress; to: AgentAddress; via: AgentAddress[] }[] = [];

    for (const dest of this.routeTable.destinations()) {
      const best = this.routeTable.bestRoute(dest);
      if (best) {
        routes.push(best);
        if (best.hops.length > 0) {
          relayPaths.push({
            from: this.config.selfAddress,
            to: dest,
            via: best.hops,
          });
        }
      }
    }

    return { agents, routes, relayPaths, timestamp: Date.now() };
  }

  /** Generate a text visualization of the network */
  visualize(): string {
    const topo = this.topology();
    const lines: string[] = ['═══ Context Routing Network ═══', ''];

    // Agents
    lines.push(`📡 Agents (${topo.agents.length}):`);
    for (const agent of topo.agents) {
      const status = agent.status === AgentStatus.Online ? '🟢' :
                     agent.status === AgentStatus.Degraded ? '🟡' : '🔴';
      const caps = agent.capabilities.map(c => c.tag).join(', ');
      lines.push(`  ${status} ${agent.address} [${caps}] ${agent.latencyMs.toFixed(0)}ms trust:${agent.trustScore.toFixed(2)}`);
    }

    // Routes
    lines.push('', `🛤️  Routes (${topo.routes.length}):`);
    for (const route of topo.routes) {
      const health = route.health === RouteHealth.Healthy ? '✅' :
                     route.health === RouteHealth.Degraded ? '⚠️' : '❌';
      const path = route.nextHop ? `via ${route.hops.join(' → ')} → ${route.destination}` : `direct → ${route.destination}`;
      lines.push(`  ${health} ${path} (cost:${route.cost.toFixed(2)} loss:${(route.contextLossRate * 100).toFixed(1)}%)`);
    }

    // Relay paths
    if (topo.relayPaths.length > 0) {
      lines.push('', `🔀 Relay Paths:`);
      for (const rp of topo.relayPaths) {
        lines.push(`  ${rp.from} → [${rp.via.join(' → ')}] → ${rp.to}`);
      }
    }

    // Stats
    const relayStats = this.relay.getStats();
    lines.push('', `📊 Stats:`);
    lines.push(`  Relayed: ${relayStats.relayed} | Dropped: ${relayStats.dropped} | Cache: ${relayStats.cacheSize} (${relayStats.cacheHits} hits)`);

    return lines.join('\n');
  }

  onEvent(handler: RoutingEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /** Exchange routes with peers */
  private exchangeRoutes(): void {
    // In real implementation, this would send announcements to peers
    // Here we generate the announcement that would be sent
    const _announcement = this.routeTable.generateAnnouncement();
    // Would broadcast to this.peers
  }

  private calculateDirectCost(agent: AgentPresence): number {
    const p = this.config.routingPolicy;
    const latencyNorm = Math.min(agent.latencyMs / 5000, 1);
    const trustInverse = 1 - agent.trustScore;
    const capAvg = agent.capabilities.reduce((sum, c) => sum + c.confidence, 0) /
                   Math.max(agent.capabilities.length, 1);

    return (
      latencyNorm * p.latencyWeight +
      trustInverse * p.trustWeight +
      (1 - capAvg) * p.capabilityWeight
    );
  }

  private emit(event: RoutingEvent): void {
    for (const handler of this.eventHandlers) {
      try { handler(event); } catch {}
    }
  }
}

// ============================================================
// Convenience functions
// ============================================================

/** Create a router with sensible defaults */
export function createRouter(
  selfAddress: AgentAddress,
  capabilities: { tag: string; confidence: number }[] = [],
  networks: string[] = ['default']
): ContextRouter {
  return new ContextRouter({
    ...DEFAULT_ROUTER_CONFIG,
    selfAddress,
    networks,
    capabilities: capabilities.map(c => ({
      tag: c.tag,
      confidence: c.confidence,
      lastVerified: Date.now(),
      verificationMethod: 'self-declared' as const,
    })),
  });
}

/** Quick agent discovery and route setup */
export function quickDiscover(
  router: ContextRouter,
  agents: { address: string; capabilities: string[]; trustScore?: number; latencyMs?: number }[]
): void {
  for (const agent of agents) {
    router.discover({
      address: agent.address,
      networks: ['default'],
      capabilities: agent.capabilities.map(tag => ({
        tag,
        confidence: 0.8,
        lastVerified: Date.now(),
        verificationMethod: 'peer-attested' as const,
      })),
      status: AgentStatus.Online,
      discoveredVia: DiscoveryMethod.Propagated,
      discoveredAt: Date.now(),
      lastSeen: Date.now(),
      latencyMs: agent.latencyMs ?? 50,
      throughput: 100,
      trustScore: agent.trustScore ?? 0.7,
      version: '1.0.0',
      metadata: {},
    });
  }
}

/** Demo: build a small network and route context */
export function demoRouting(): string {
  const lines: string[] = ['═══ Context Routing Demo ═══', ''];

  // Create a router for our main agent
  const router = createRouter('clawd-main', [
    { tag: 'orchestration', confidence: 0.95 },
    { tag: 'code:typescript', confidence: 0.9 },
  ]);

  // Discover some agents
  quickDiscover(router, [
    { address: 'alpha', capabilities: ['code:typescript', 'code:python', 'testing'], trustScore: 0.85, latencyMs: 30 },
    { address: 'beta', capabilities: ['research:ml', 'code:python', 'data-analysis'], trustScore: 0.75, latencyMs: 80 },
    { address: 'gamma', capabilities: ['design:ui', 'code:react', 'accessibility'], trustScore: 0.90, latencyMs: 45 },
    { address: 'delta', capabilities: ['devops:k8s', 'security:audit'], trustScore: 0.60, latencyMs: 120 },
  ]);

  lines.push('Network established:');
  lines.push(router.visualize());

  // Find collaborators for a TypeScript project
  lines.push('', '--- Capability Query: TypeScript + Testing ---');
  const matches = router.findCollaborators({
    requiredCapabilities: ['code:typescript'],
    preferredCapabilities: ['testing'],
    minConfidence: 0.5,
    maxHops: 3,
    maxLatencyMs: 1000,
    minTrustScore: 0.5,
  });

  for (const match of matches) {
    lines.push(`  Match: ${match.agent.address} (score: ${match.matchScore.toFixed(2)}, quality: ${match.estimatedQuality.toFixed(2)})`);
  }

  // Route context to an agent
  lines.push('', '--- Route context to beta ---');
  const result = router.route('beta', {
    type: 'mental-model',
    concepts: { 'web-scraper': 'Extract data from HTML pages' },
    goals: ['Build reliable scraper', 'Handle rate limiting'],
  });

  if (result) {
    lines.push(`  Path: ${result.path.join(' → ')}`);
    lines.push(`  Packet ID: ${result.packet.id}`);
    lines.push(`  TTL: ${result.packet.ttl}`);
  } else {
    lines.push('  No route found!');
  }

  return lines.join('\n');
}
