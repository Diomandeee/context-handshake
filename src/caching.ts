/**
 * Context Caching & Invalidation
 * ================================
 * HTTP-style caching semantics for AI mental models.
 *
 * Like browser caching prevents redundant network requests,
 * context caching prevents redundant mental model exchanges
 * between collaborating agents. Supports ETags, TTL, stale-while-
 * revalidate, cache partitioning, and invalidation cascades.
 *
 * HEF Evolution — Instance 28, Generation 6
 * Task: task_20260203231019_43e356
 */

// ─── Types ───────────────────────────────────────────────────────

/** Cache directives (modeled after HTTP Cache-Control) */
export interface CacheDirectives {
  /** Max age in milliseconds before entry is stale */
  maxAge: number;
  /** Serve stale while revalidating in background (ms window) */
  staleWhileRevalidate?: number;
  /** Serve stale on upstream error (ms window) */
  staleIfError?: number;
  /** Never cache this context */
  noCache?: boolean;
  /** Don't store at all (sensitive contexts) */
  noStore?: boolean;
  /** Must revalidate with origin before serving stale */
  mustRevalidate?: boolean;
  /** Cache is private to this agent (not shareable) */
  private?: boolean;
  /** Cache is public (shareable across agent pool) */
  public?: boolean;
  /** Immutable — will never change for this version */
  immutable?: boolean;
}

/** Entity tag for cache validation */
export interface ETag {
  /** Hash of the context content */
  value: string;
  /** Weak ETags allow semantic equivalence, not byte-identical */
  weak: boolean;
}

/** Freshness status of a cached entry */
export type FreshnessStatus =
  | 'fresh'           // Within maxAge, serve directly
  | 'stale-usable'    // Past maxAge but within staleWhileRevalidate window
  | 'stale-error'     // Stale but serving due to upstream error
  | 'stale-expired'   // Past all grace windows, must revalidate
  | 'invalid';        // ETag mismatch or forced invalidation

/** A cached context entry */
export interface CacheEntry<T = unknown> {
  /** Unique key for this entry */
  key: string;
  /** The cached context payload */
  payload: T;
  /** ETag for conditional requests */
  etag: ETag;
  /** When this entry was stored */
  storedAt: number;
  /** When last validated against origin */
  lastValidated: number;
  /** Cache directives governing this entry */
  directives: CacheDirectives;
  /** Which agent produced this context */
  originAgent: string;
  /** Partition this entry belongs to */
  partition: string;
  /** Number of times this entry was served */
  hitCount: number;
  /** Dependencies — if these keys invalidate, so does this */
  dependsOn: string[];
  /** Size estimate in bytes (for eviction) */
  sizeBytes: number;
  /** Custom metadata */
  metadata: Record<string, unknown>;
}

/** Result of a cache lookup */
export interface CacheLookup<T = unknown> {
  hit: boolean;
  entry: CacheEntry<T> | null;
  freshness: FreshnessStatus;
  /** If stale-usable, background revalidation was triggered */
  revalidating: boolean;
  /** Age of entry in ms */
  age: number;
}

/** Invalidation event propagated through dependency graph */
export interface InvalidationEvent {
  key: string;
  reason: 'expired' | 'etag-mismatch' | 'manual' | 'cascade' | 'purge';
  originAgent: string;
  timestamp: number;
  /** Keys that were cascade-invalidated */
  cascaded: string[];
}

/** Revalidation request (like If-None-Match) */
export interface RevalidationRequest {
  key: string;
  etag: ETag;
  /** If-Modified-Since equivalent */
  ifModifiedSince?: number;
}

/** Revalidation response */
export interface RevalidationResponse<T = unknown> {
  /** 304 Not Modified equivalent */
  notModified: boolean;
  /** New payload if modified */
  payload?: T;
  /** New ETag */
  etag?: ETag;
  /** Updated directives */
  directives?: Partial<CacheDirectives>;
}

/** Eviction policy */
export type EvictionPolicy = 'lru' | 'lfu' | 'ttl' | 'size' | 'adaptive';

/** Cache statistics */
export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  staleServes: number;
  revalidations: number;
  evictions: number;
  invalidations: number;
  partitionStats: Map<string, { entries: number; sizeBytes: number; hitRate: number }>;
}

/** Cache configuration */
export interface CacheConfig {
  /** Maximum entries across all partitions */
  maxEntries: number;
  /** Maximum total size in bytes */
  maxSizeBytes: number;
  /** Default directives for entries without explicit ones */
  defaultDirectives: CacheDirectives;
  /** Eviction policy */
  evictionPolicy: EvictionPolicy;
  /** How often to run cleanup (ms) */
  cleanupInterval: number;
  /** Enable cascade invalidation */
  cascadeInvalidation: boolean;
  /** Max cascade depth to prevent infinite loops */
  maxCascadeDepth: number;
  /** Partition-specific size limits */
  partitionLimits: Map<string, { maxEntries: number; maxSizeBytes: number }>;
}

// ─── ETag Generation ─────────────────────────────────────────────

/**
 * Generate an ETag from context content.
 * Strong ETags require byte-identical content.
 * Weak ETags allow semantic equivalence (same meaning, different representation).
 */
export class ETagGenerator {
  /**
   * Strong ETag — content hash.
   * Two contexts with identical serialization get the same ETag.
   */
  static strong(payload: unknown): ETag {
    const serialized = JSON.stringify(payload, Object.keys(
      typeof payload === 'object' && payload !== null ? payload : {}
    ).sort());
    // Simple FNV-1a hash for demonstration
    let hash = 0x811c9dc5;
    for (let i = 0; i < serialized.length; i++) {
      hash ^= serialized.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return { value: hash.toString(36), weak: false };
  }

  /**
   * Weak ETag — semantic hash.
   * Ignores field ordering, whitespace, metadata-only differences.
   * Two contexts that "mean the same thing" get the same weak ETag.
   */
  static weak(payload: unknown): ETag {
    const normalized = this.normalize(payload);
    const strong = this.strong(normalized);
    return { value: `W/${strong.value}`, weak: true };
  }

  /** Deep normalize for semantic comparison */
  private static normalize(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim().toLowerCase();
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      return value.map(v => this.normalize(v)).sort();
    }
    if (typeof value === 'object') {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        const v = (value as Record<string, unknown>)[key];
        if (v !== undefined) sorted[key] = this.normalize(v);
      }
      return sorted;
    }
    return value;
  }

  /** Check if two ETags match (respecting weak/strong semantics) */
  static match(a: ETag, b: ETag): boolean {
    // Strong comparison: both must be strong and identical
    if (!a.weak && !b.weak) return a.value === b.value;
    // Weak comparison: strip W/ prefix and compare
    const aVal = a.value.replace(/^W\//, '');
    const bVal = b.value.replace(/^W\//, '');
    return aVal === bVal;
  }
}

// ─── Cache Partition ─────────────────────────────────────────────

/**
 * Isolated cache partition — like cache partitioning in browsers
 * to prevent cross-origin cache probing.
 *
 * Each agent pair or topic gets its own partition to prevent
 * context leakage between unrelated collaborations.
 */
export class CachePartition<T = unknown> {
  readonly name: string;
  private entries: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];  // For LRU
  private frequencyMap: Map<string, number> = new Map();  // For LFU

  private stats = {
    hits: 0,
    misses: 0,
    staleServes: 0,
  };

  constructor(
    name: string,
    private maxEntries: number = 1000,
    private maxSizeBytes: number = 10 * 1024 * 1024,
  ) {
    this.name = name;
  }

  /** Total size of all entries */
  get totalSize(): number {
    let size = 0;
    for (const entry of this.entries.values()) size += entry.sizeBytes;
    return size;
  }

  get size(): number {
    return this.entries.size;
  }

  get hitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  /** Store an entry */
  put(
    key: string,
    payload: T,
    directives: CacheDirectives,
    originAgent: string,
    dependsOn: string[] = [],
    metadata: Record<string, unknown> = {},
  ): CacheEntry<T> {
    // Respect no-store
    if (directives.noStore) {
      throw new Error(`Cannot cache entry with no-store directive: ${key}`);
    }

    const serialized = JSON.stringify(payload);
    const sizeBytes = new TextEncoder().encode(serialized).length;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      key,
      payload,
      etag: ETagGenerator.strong(payload),
      storedAt: now,
      lastValidated: now,
      directives,
      originAgent,
      partition: this.name,
      hitCount: 0,
      dependsOn,
      sizeBytes,
      metadata,
    };

    // Evict if necessary
    while (
      (this.entries.size >= this.maxEntries || this.totalSize + sizeBytes > this.maxSizeBytes) &&
      this.entries.size > 0
    ) {
      this.evictOne();
    }

    this.entries.set(key, entry);
    this.touchAccess(key);
    return entry;
  }

  /** Look up an entry with freshness evaluation */
  get(key: string): CacheLookup<T> {
    const entry = this.entries.get(key);

    if (!entry) {
      this.stats.misses++;
      return { hit: false, entry: null, freshness: 'invalid', revalidating: false, age: 0 };
    }

    const now = Date.now();
    const age = now - entry.storedAt;
    const freshness = this.evaluateFreshness(entry, now);

    if (freshness === 'invalid' || freshness === 'stale-expired') {
      this.stats.misses++;
      return { hit: false, entry, freshness, revalidating: false, age };
    }

    // It's servable (fresh or stale-usable)
    entry.hitCount++;
    this.stats.hits++;
    this.touchAccess(key);

    if (freshness === 'stale-usable' || freshness === 'stale-error') {
      this.stats.staleServes++;
    }

    const revalidating = freshness === 'stale-usable';

    return { hit: true, entry, freshness, revalidating, age };
  }

  /** Conditional get — only return if ETag doesn't match (like If-None-Match) */
  getIfChanged(key: string, knownEtag: ETag): CacheLookup<T> & { changed: boolean } {
    const lookup = this.get(key);

    if (!lookup.hit || !lookup.entry) {
      return { ...lookup, changed: true };
    }

    const changed = !ETagGenerator.match(lookup.entry.etag, knownEtag);
    return { ...lookup, changed };
  }

  /** Invalidate an entry, returning cascade targets */
  invalidate(key: string, reason: InvalidationEvent['reason'] = 'manual'): InvalidationEvent {
    const entry = this.entries.get(key);
    const event: InvalidationEvent = {
      key,
      reason,
      originAgent: entry?.originAgent ?? 'unknown',
      timestamp: Date.now(),
      cascaded: [],
    };

    this.entries.delete(key);
    this.removeFromAccessOrder(key);

    // Find entries that depend on this one
    for (const [depKey, depEntry] of this.entries) {
      if (depEntry.dependsOn.includes(key)) {
        event.cascaded.push(depKey);
      }
    }

    return event;
  }

  /** Update entry after successful revalidation */
  revalidate(key: string, response: RevalidationResponse<T>): void {
    const entry = this.entries.get(key);
    if (!entry) return;

    if (response.notModified) {
      // 304 equivalent — just update validation time
      entry.lastValidated = Date.now();
      if (response.directives) {
        Object.assign(entry.directives, response.directives);
      }
    } else if (response.payload !== undefined) {
      // Full update
      entry.payload = response.payload;
      entry.etag = response.etag ?? ETagGenerator.strong(response.payload);
      entry.lastValidated = Date.now();
      entry.sizeBytes = new TextEncoder().encode(JSON.stringify(response.payload)).length;
      if (response.directives) {
        Object.assign(entry.directives, response.directives);
      }
    }
  }

  /** Purge all entries */
  purge(): number {
    const count = this.entries.size;
    this.entries.clear();
    this.accessOrder = [];
    this.frequencyMap.clear();
    return count;
  }

  /** Get all entries (for inspection) */
  all(): CacheEntry<T>[] {
    return Array.from(this.entries.values());
  }

  // ─── Freshness Evaluation ───────────────────────────────────

  private evaluateFreshness(entry: CacheEntry<T>, now: number): FreshnessStatus {
    const { directives } = entry;

    // no-cache means always revalidate
    if (directives.noCache) return 'stale-expired';

    // Immutable means always fresh
    if (directives.immutable) return 'fresh';

    const age = now - entry.storedAt;

    // Within maxAge → fresh
    if (age <= directives.maxAge) return 'fresh';

    // Past maxAge — check stale-while-revalidate window
    if (directives.staleWhileRevalidate) {
      if (age <= directives.maxAge + directives.staleWhileRevalidate) {
        return 'stale-usable';
      }
    }

    // Must revalidate means no stale serving
    if (directives.mustRevalidate) return 'stale-expired';

    // Check stale-if-error window (only useful when origin is down)
    if (directives.staleIfError) {
      if (age <= directives.maxAge + directives.staleIfError) {
        return 'stale-error';
      }
    }

    return 'stale-expired';
  }

  // ─── Eviction ───────────────────────────────────────────────

  private evictOne(): void {
    if (this.accessOrder.length === 0) return;
    // LRU: evict least recently accessed
    const victim = this.accessOrder.shift()!;
    this.entries.delete(victim);
    this.frequencyMap.delete(victim);
  }

  private touchAccess(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
    this.frequencyMap.set(key, (this.frequencyMap.get(key) ?? 0) + 1);
  }

  private removeFromAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) this.accessOrder.splice(idx, 1);
  }
}

// ─── Main Cache Manager ──────────────────────────────────────────

/**
 * ContextCache — the main cache manager.
 *
 * Manages partitioned caches, cascade invalidation, background
 * revalidation, and eviction across all partitions.
 */
export class ContextCache {
  private partitions: Map<string, CachePartition> = new Map();
  private revalidationQueue: RevalidationRequest[] = [];
  private invalidationLog: InvalidationEvent[] = [];
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private globalStats = {
    totalHits: 0,
    totalMisses: 0,
    totalEvictions: 0,
    totalInvalidations: 0,
    totalRevalidations: 0,
  };

  constructor(private config: CacheConfig) {
    if (config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), config.cleanupInterval);
    }
  }

  // ─── Partition Management ─────────────────────────────────

  /** Get or create a partition */
  partition(name: string): CachePartition {
    let part = this.partitions.get(name);
    if (!part) {
      const limits = this.config.partitionLimits.get(name);
      part = new CachePartition(
        name,
        limits?.maxEntries ?? this.config.maxEntries,
        limits?.maxSizeBytes ?? this.config.maxSizeBytes,
      );
      this.partitions.set(name, part);
    }
    return part;
  }

  /** Generate a partition key for an agent pair */
  static agentPairKey(agentA: string, agentB: string): string {
    return [agentA, agentB].sort().join(':');
  }

  // ─── Core Operations ──────────────────────────────────────

  /** Store a context in the cache */
  put(
    partitionName: string,
    key: string,
    payload: unknown,
    options: {
      directives?: Partial<CacheDirectives>;
      originAgent: string;
      dependsOn?: string[];
      metadata?: Record<string, unknown>;
    },
  ): CacheEntry {
    const directives: CacheDirectives = {
      ...this.config.defaultDirectives,
      ...options.directives,
    };

    return this.partition(partitionName).put(
      key,
      payload,
      directives,
      options.originAgent,
      options.dependsOn,
      options.metadata,
    );
  }

  /** Look up a cached context */
  get(partitionName: string, key: string): CacheLookup {
    const part = this.partitions.get(partitionName);
    if (!part) {
      this.globalStats.totalMisses++;
      return { hit: false, entry: null, freshness: 'invalid', revalidating: false, age: 0 };
    }

    const result = part.get(key);
    if (result.hit) {
      this.globalStats.totalHits++;
    } else {
      this.globalStats.totalMisses++;
    }

    // Queue background revalidation if stale-while-revalidate
    if (result.revalidating && result.entry) {
      this.queueRevalidation({
        key: result.entry.key,
        etag: result.entry.etag,
        ifModifiedSince: result.entry.lastValidated,
      });
    }

    return result;
  }

  /** Conditional get — returns 304-equivalent if ETag matches */
  getIfChanged(
    partitionName: string,
    key: string,
    knownEtag: ETag,
  ): CacheLookup & { changed: boolean } {
    const part = this.partitions.get(partitionName);
    if (!part) {
      return { hit: false, entry: null, freshness: 'invalid', revalidating: false, age: 0, changed: true };
    }
    return part.getIfChanged(key, knownEtag);
  }

  // ─── Invalidation ─────────────────────────────────────────

  /** Invalidate a single key with optional cascade */
  invalidate(
    partitionName: string,
    key: string,
    reason: InvalidationEvent['reason'] = 'manual',
  ): InvalidationEvent[] {
    const events: InvalidationEvent[] = [];
    const part = this.partitions.get(partitionName);
    if (!part) return events;

    const event = part.invalidate(key, reason);
    events.push(event);
    this.globalStats.totalInvalidations++;
    this.invalidationLog.push(event);

    // Cascade invalidation
    if (this.config.cascadeInvalidation && event.cascaded.length > 0) {
      this.cascadeInvalidate(part, event.cascaded, 1, events);
    }

    return events;
  }

  /** Cascade invalidation through dependency graph */
  private cascadeInvalidate(
    partition: CachePartition,
    keys: string[],
    depth: number,
    events: InvalidationEvent[],
  ): void {
    if (depth >= this.config.maxCascadeDepth) return;

    for (const key of keys) {
      const event = partition.invalidate(key, 'cascade');
      events.push(event);
      this.globalStats.totalInvalidations++;
      this.invalidationLog.push(event);

      if (event.cascaded.length > 0) {
        this.cascadeInvalidate(partition, event.cascaded, depth + 1, events);
      }
    }
  }

  /** Invalidate all entries from a specific agent */
  invalidateByAgent(agentId: string): number {
    let count = 0;
    for (const partition of this.partitions.values()) {
      for (const entry of partition.all()) {
        if (entry.originAgent === agentId) {
          partition.invalidate(entry.key, 'manual');
          count++;
        }
      }
    }
    this.globalStats.totalInvalidations += count;
    return count;
  }

  /** Purge an entire partition */
  purgePartition(name: string): number {
    const part = this.partitions.get(name);
    if (!part) return 0;
    const count = part.purge();
    this.globalStats.totalEvictions += count;
    return count;
  }

  // ─── Revalidation ─────────────────────────────────────────

  /** Queue a revalidation request */
  private queueRevalidation(request: RevalidationRequest): void {
    // Deduplicate
    if (!this.revalidationQueue.find(r => r.key === request.key)) {
      this.revalidationQueue.push(request);
    }
  }

  /** Process revalidation queue (called by external revalidation handler) */
  drainRevalidationQueue(): RevalidationRequest[] {
    const queue = [...this.revalidationQueue];
    this.revalidationQueue = [];
    this.globalStats.totalRevalidations += queue.length;
    return queue;
  }

  /** Apply a revalidation response */
  applyRevalidation(
    partitionName: string,
    key: string,
    response: RevalidationResponse,
  ): void {
    const part = this.partitions.get(partitionName);
    if (part) {
      part.revalidate(key, response);
    }
  }

  // ─── Cleanup & Maintenance ─────────────────────────────────

  /** Remove expired entries across all partitions */
  cleanup(): { removed: number; partitions: Map<string, number> } {
    const result = { removed: 0, partitions: new Map<string, number>() };
    const now = Date.now();

    for (const [name, partition] of this.partitions) {
      let partRemoved = 0;
      for (const entry of partition.all()) {
        const age = now - entry.storedAt;
        const maxLifetime = entry.directives.maxAge +
          (entry.directives.staleWhileRevalidate ?? 0) +
          (entry.directives.staleIfError ?? 0);

        if (age > maxLifetime && !entry.directives.immutable) {
          partition.invalidate(entry.key, 'expired');
          partRemoved++;
        }
      }
      result.partitions.set(name, partRemoved);
      result.removed += partRemoved;
    }

    this.globalStats.totalEvictions += result.removed;
    return result;
  }

  /** Warm the cache by preloading entries (e.g., from disk or previous session) */
  warm(
    partitionName: string,
    entries: Array<{
      key: string;
      payload: unknown;
      directives?: Partial<CacheDirectives>;
      originAgent: string;
      dependsOn?: string[];
    }>,
  ): number {
    let loaded = 0;
    for (const entry of entries) {
      try {
        this.put(partitionName, entry.key, entry.payload, {
          directives: entry.directives,
          originAgent: entry.originAgent,
          dependsOn: entry.dependsOn,
        });
        loaded++;
      } catch {
        // Skip entries that can't be cached (e.g., no-store)
      }
    }
    return loaded;
  }

  // ─── Statistics ────────────────────────────────────────────

  stats(): CacheStats {
    let totalEntries = 0;
    let totalSizeBytes = 0;
    const partitionStats = new Map<string, { entries: number; sizeBytes: number; hitRate: number }>();

    for (const [name, partition] of this.partitions) {
      totalEntries += partition.size;
      totalSizeBytes += partition.totalSize;
      partitionStats.set(name, {
        entries: partition.size,
        sizeBytes: partition.totalSize,
        hitRate: partition.hitRate,
      });
    }

    const totalRequests = this.globalStats.totalHits + this.globalStats.totalMisses;

    return {
      totalEntries,
      totalSizeBytes,
      hitCount: this.globalStats.totalHits,
      missCount: this.globalStats.totalMisses,
      hitRate: totalRequests === 0 ? 0 : this.globalStats.totalHits / totalRequests,
      staleServes: this.invalidationLog.filter(e => e.reason === 'expired').length,
      revalidations: this.globalStats.totalRevalidations,
      evictions: this.globalStats.totalEvictions,
      invalidations: this.globalStats.totalInvalidations,
      partitionStats,
    };
  }

  /** Recent invalidation events (for debugging) */
  recentInvalidations(limit = 20): InvalidationEvent[] {
    return this.invalidationLog.slice(-limit);
  }

  /** Shutdown — stop cleanup timer */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// ─── Cache-Aware Handshake Middleware ─────────────────────────────

/**
 * Wraps the handshake protocol with caching.
 * Avoids redundant full context exchanges when agents have
 * recently synced and contexts haven't changed.
 */
export class CachedHandshakeLayer {
  private cache: ContextCache;

  constructor(config?: Partial<CacheConfig>) {
    this.cache = new ContextCache({
      maxEntries: config?.maxEntries ?? 10_000,
      maxSizeBytes: config?.maxSizeBytes ?? 50 * 1024 * 1024,
      defaultDirectives: config?.defaultDirectives ?? {
        maxAge: 5 * 60 * 1000,             // 5 min default freshness
        staleWhileRevalidate: 2 * 60 * 1000, // 2 min stale-while-revalidate
        staleIfError: 10 * 60 * 1000,       // 10 min stale-if-error
      },
      evictionPolicy: config?.evictionPolicy ?? 'lru',
      cleanupInterval: config?.cleanupInterval ?? 60_000,
      cascadeInvalidation: config?.cascadeInvalidation ?? true,
      maxCascadeDepth: config?.maxCascadeDepth ?? 5,
      partitionLimits: config?.partitionLimits ?? new Map(),
    });
  }

  /**
   * Check if we can skip a full handshake by serving cached context.
   * Returns the cached context if fresh, or null if a handshake is needed.
   */
  checkCache(
    agentA: string,
    agentB: string,
    contextKey: string,
  ): { cached: boolean; context: unknown | null; stale: boolean } {
    const partition = ContextCache.agentPairKey(agentA, agentB);
    const lookup = this.cache.get(partition, contextKey);

    if (lookup.hit && lookup.entry) {
      return {
        cached: true,
        context: lookup.entry.payload,
        stale: lookup.freshness !== 'fresh',
      };
    }

    return { cached: false, context: null, stale: false };
  }

  /**
   * After a successful handshake, cache the resulting merged context.
   */
  cacheHandshakeResult(
    agentA: string,
    agentB: string,
    contextKey: string,
    mergedContext: unknown,
    directives?: Partial<CacheDirectives>,
    dependsOn?: string[],
  ): void {
    const partition = ContextCache.agentPairKey(agentA, agentB);
    this.cache.put(partition, contextKey, mergedContext, {
      directives,
      originAgent: `${agentA}+${agentB}`,
      dependsOn,
    });
  }

  /**
   * Invalidate cached context when an agent's state changes significantly.
   */
  agentStateChanged(agentId: string): number {
    return this.cache.invalidateByAgent(agentId);
  }

  /** Get cache statistics */
  stats(): CacheStats {
    return this.cache.stats();
  }

  /** Shutdown */
  shutdown(): void {
    this.cache.shutdown();
  }
}

// ─── Defaults & Presets ──────────────────────────────────────────

/** Common cache directive presets */
export const CachePresets = {
  /** Capabilities don't change often */
  capabilities: {
    maxAge: 30 * 60 * 1000,        // 30 min
    staleWhileRevalidate: 60 * 60 * 1000, // 1 hr
    immutable: false,
  } as CacheDirectives,

  /** Identity is nearly immutable within a session */
  identity: {
    maxAge: 24 * 60 * 60 * 1000,   // 24 hr
    immutable: true,
  } as CacheDirectives,

  /** Task context changes frequently */
  taskContext: {
    maxAge: 60 * 1000,             // 1 min
    staleWhileRevalidate: 30 * 1000, // 30 sec
    mustRevalidate: true,
  } as CacheDirectives,

  /** Shared knowledge base — long-lived, public */
  knowledge: {
    maxAge: 60 * 60 * 1000,        // 1 hr
    staleWhileRevalidate: 30 * 60 * 1000,
    public: true,
  } as CacheDirectives,

  /** Sensitive contexts — never cache */
  sensitive: {
    maxAge: 0,
    noStore: true,
    private: true,
  } as CacheDirectives,

  /** Ephemeral working memory — very short-lived */
  workingMemory: {
    maxAge: 30 * 1000,             // 30 sec
    noCache: true,                  // Always revalidate
    private: true,
  } as CacheDirectives,
} as const;
