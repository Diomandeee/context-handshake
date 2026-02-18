# Context Handshake Protocol 🤝

**HEF Evolution Tasks:**
- Gen 6: `task_20260131224044_bc4986` — Core handshake protocol
- Gen 6 (Inst 28): `task_20260201061347_9ebd38` — Negotiation Protocol
- Gen 6 (Inst 28): `task_20260202225844_051ae6` — Empathy Protocol (Theory of Mind)
- Gen 7: `task_20260131233244_51d6d3` — Trust Evolution & Memory
- Gen 8: `task_20260201060247_ed139e` — Streaming Handshakes

**Instance:** `inst_20260131082143_957`

## Vision

Two AIs syncing mental models before collaborating — like TCP's three-way handshake, but for shared understanding.

```
┌─────────────────┐                    ┌─────────────────┐
│    Agent A      │                    │    Agent B      │
│  (Initiator)    │                    │  (Responder)    │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │  ──── SYN (Context Offer) ────────►  │
         │       • My capabilities              │
         │       • Current mental model         │
         │       • Task understanding           │
         │                                      │
         │  ◄─── SYN-ACK (Context Accept) ───   │
         │       • Your model received          │
         │       • My complementary model       │
         │       • Alignment score              │
         │                                      │
         │  ──── ACK (Handshake Complete) ───►  │
         │       • Merged understanding         │
         │       • Ready to collaborate         │
         │                                      │
         ▼                                      ▼
    ╔═══════════════════════════════════════════════╗
    ║        SYNCHRONIZED COLLABORATION MODE        ║
    ╚═══════════════════════════════════════════════╝
```

## Why This Matters

When two AI agents collaborate, they often:
- Repeat explanations unnecessarily
- Make conflicting assumptions
- Miss each other's context
- Waste tokens re-establishing shared ground

The Context Handshake ensures both agents start with:
- **Aligned understanding** of the task
- **Known capabilities** of each participant
- **Shared vocabulary** for domain concepts
- **Conflict resolution** for divergent models

## Protocol Specification

### Phase 1: SYN (Context Offer)
```json
{
  "type": "SYN",
  "from": "agent_id",
  "timestamp": "ISO8601",
  "context": {
    "capabilities": ["code", "research", "creative"],
    "mental_model": {
      "task_understanding": "...",
      "key_concepts": {...},
      "assumptions": [...]
    },
    "constraints": [...],
    "preferred_communication_style": "concise|verbose|technical"
  },
  "checksum": "sha256_of_context"
}
```

### Phase 2: SYN-ACK (Context Accept)
```json
{
  "type": "SYN-ACK",
  "from": "responder_id",
  "to": "initiator_id",
  "timestamp": "ISO8601",
  "ack_checksum": "received_syn_checksum",
  "alignment": {
    "score": 0.87,
    "matched_concepts": [...],
    "divergences": [...],
    "proposed_resolutions": [...]
  },
  "context": {
    "capabilities": [...],
    "mental_model": {...},
    "complementary_knowledge": {...}
  },
  "checksum": "sha256_of_synack"
}
```

### Phase 3: ACK (Handshake Complete)
```json
{
  "type": "ACK",
  "from": "initiator_id",
  "to": "responder_id",
  "timestamp": "ISO8601",
  "ack_checksum": "received_synack_checksum",
  "merged_model": {
    "shared_understanding": {...},
    "role_assignments": {
      "lead": "agent_id",
      "support": "agent_id"
    },
    "communication_protocol": "...",
    "conflict_resolution": "defer_to_lead|vote|escalate"
  },
  "session_id": "unique_collab_session"
}
```

## Usage

### TypeScript/Clawdbot Integration
```typescript
import { ContextHandshake } from './src/handshake';

// Initiate handshake with another agent
const handshake = new ContextHandshake({
  agentId: 'clawd-main',
  capabilities: ['code', 'research', 'automation'],
  mentalModel: await buildCurrentContext()
});

// Send SYN to collaborator
const synResult = await handshake.initiate('agent-beta');

// Receive SYN-ACK
const synAck = await handshake.awaitResponse();

// Complete handshake
const session = await handshake.complete(synAck);

// Now collaborate with synchronized context
await session.collaborate('Let\'s build X together');
```

### Python Integration
```python
from context_handshake import Handshake

# As responder
handshake = Handshake.receive(incoming_syn)
handshake.analyze_alignment()
synack = handshake.accept()

# Await ACK and start collaboration
session = await handshake.await_ack()
```

## Files

| File | Description |
|------|-------------|
| `src/protocol.ts` | Core protocol types and constants |
| `src/handshake.ts` | Handshake state machine |
| `src/context.ts` | Context serialization and hashing |
| `src/alignment.ts` | Mental model alignment scoring |
| `src/merge.ts` | Context merging strategies |
| `src/session.ts` | Active collaboration session |

## Alignment Scoring

The alignment score (0.0-1.0) measures how well two mental models match:

| Score | Meaning | Action |
|-------|---------|--------|
| 0.9+ | Nearly identical understanding | Proceed immediately |
| 0.7-0.9 | Good alignment, minor gaps | Quick sync, then proceed |
| 0.5-0.7 | Moderate divergence | Negotiate key differences |
| 0.3-0.5 | Significant gaps | Extended context sharing |
| <0.3 | Major misalignment | Consider task reassignment |

## Conflict Resolution

When mental models diverge:

1. **Identify** - Which concepts conflict?
2. **Compare** - What evidence supports each view?
3. **Propose** - Suggest resolution strategies
4. **Agree** - Lock in merged understanding
5. **Document** - Record for future reference

## Integration with Clawdbot

```yaml
# In gateway config
handshake:
  enabled: true
  auto_initiate: true  # Auto-sync with sub-agents
  timeout_ms: 5000
  min_alignment: 0.6   # Require minimum alignment
```

---

## 🆕 Gen 7: Trust Evolution & Memory

Gen 7 evolves the handshake with **persistent trust relationships**. Agents that have collaborated before get progressively faster reconnections.

### Trust Tiers

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   UNKNOWN    │───►│ ACQUAINTANCE │───►│   FAMILIAR   │───►│   TRUSTED    │───►│   BONDED     │
│  Full Sync   │    │  Abbreviated │    │  Diff Only   │    │   Instant    │    │  Autonomous  │
│  Score: 0    │    │  Score: 20+  │    │  Score: 40+  │    │  Score: 60+  │    │  Score: 80+  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Progressive Capabilities

| Tier | Handshake | Delegate | Sensitive | Modify | Spawn | Depth |
|------|-----------|----------|-----------|--------|-------|-------|
| Unknown | Full | ❌ | ❌ | ❌ | ❌ | 1 |
| Acquaintance | Abbreviated | ❌ | ❌ | ❌ | ❌ | 2 |
| Familiar | Diff | ❌ | ✅ | ❌ | ✅ | 3 |
| Trusted | Instant | ✅ | ✅ | ✅ | ✅ | 5 |
| Bonded | Instant | ✅ | ✅ | ✅ | ✅ | 10 |

### Trust Memory

```typescript
import { TrustMemory, MemoryHandshake } from 'context-handshake';

// Initialize trust memory
const memory = new TrustMemory('clawd-main');

// Create memory-aware handshake
const handshake = new MemoryHandshake({
  agentId: 'clawd-main',
  concepts: new Map([['task', 'Build a scraper']]),
  assumptions: ['User wants JSON output'],
  goals: ['Working scraper', 'Handle pagination'],
  capabilities: ['code', 'research'],
  trustMemory: memory,
});

// Initiate - automatically selects optimal handshake type
const result = await handshake.initiate('sub-agent-alpha');

console.log(result.handshakeType);  // 'full' first time, 'instant' after trust builds
console.log(result.trustTier);       // TrustTier.UNKNOWN → TRUSTED over time
console.log(result.unlockedCapabilities);
```

### Trust Evolution Mechanics

**Building Trust:**
- Successful collaboration: +10 base, modified by alignment and complexity
- High alignment (>0.8): bonus points
- Complex tasks: multiplied by √complexity
- Conflict resolution: +2 per resolved conflict

**Losing Trust:**
- Failed collaboration: -5 base
- Abandoned task: -15
- Low alignment: penalty

**Trust Decay:**
- Trust decays over time without contact (half-life: 30 days)
- Minimum decay floor: ACQUAINTANCE tier
- Reactivation bonus when reconnecting after decay

### Fast Reconnection Protocol

For trusted partners, skip the full handshake:

```
Agent A                          Agent B
   │                                │
   │── FastReconnect (my diff) ────►│
   │                                │  ← Verify fingerprint
   │◄── FastReconnectAck (your diff)│
   │                                │
   ╔════════════════════════════════╗
   ║    Instant Sync Complete       ║
   ╚════════════════════════════════╝
```

### Trust-Based Conflict Resolution

When merged contexts conflict, higher trust wins:

```typescript
import { resolveConflict } from 'context-handshake';

const resolution = resolveConflict(myContext, 'partner-id', {
  topic: 'output format',
  myView: 'JSON is better',
  theirView: 'CSV is simpler',
});

// resolution.winner: 'me' | 'them' | 'merge'
// resolution.resolution: the chosen view
```

### Persistence

Trust memory survives across sessions:

```typescript
// Export before shutdown
const serialized = memory.export();
saveToFile(serialized);

// Import on startup
const restored = TrustMemory.import(loadFromFile());
```

### New Files (Gen 7)

| File | Lines | Description |
|------|-------|-------------|
| `src/trust.ts` | ~400 | Trust tiers, memory, decay, capabilities |
| `src/memory-handshake.ts` | ~350 | Trust-aware handshake orchestrator |
| `demo/trust-evolution.ts` | ~250 | Interactive trust evolution demo |

### Demo

```bash
npx ts-node demo/trust-evolution.ts
```

Shows trust building from UNKNOWN to BONDED over simulated collaborations.

---

## Gen 8: Streaming Handshakes 🌊

**Task:** `task_20260201060247_ed139e`  
**Evolution Techniques:** G03 (SCAMPER-Adapt), G08 (Combine), R09 (Optimize), thk:fractal

When mental models are large, sending them all at once is wasteful. Streaming handshakes progressively sync context with real-time alignment feedback.

### The Stream Flow

```
Agent A                              Agent B
   │                                    │
   │── [chunk 1: capabilities] ───────►│
   │◄─────────── alignment: 85% ───────│
   │                                    │
   │── [chunk 2: task_understanding] ──►│
   │◄─────────── alignment: 88% ───────│
   │                                    │
   │── [chunk 3: key_concepts] ───────►│
   │◄─────────── alignment: 72% ⚠️ ────│ ← divergence detected
   │                                    │
   │── [chunk 4: assumptions] ─────────►│
   │◄─────────── alignment: 68% 🛑 ────│ ← early termination
   │                                    │
   ╔════════════════════════════════════╗
   ║  DEGRADED MODE (partial sync)      ║
   ╚════════════════════════════════════╝
```

### Key Features

- **Priority-ordered chunks**: Critical context first (capabilities, task understanding)
- **Real-time alignment**: Know alignment score after each chunk
- **Divergence flags**: Immediate alerts for misaligned domains
- **Early termination**: Stop streaming if alignment drops too low
- **Bandwidth control**: Throttle, chunk size, priority ordering

### Usage

```typescript
import { StreamingHandshake, visualizeStreamProgress } from 'context-handshake';

const engine = new StreamingHandshake({
  maxChunkSize: 4096,
  throttleMs: 50,
  earlyTermination: {
    enabled: true,
    minScore: 0.3,
    minChunks: 3
  }
});

const result = await engine.initiateStream(
  'agent-alpha',
  'agent-beta',
  myLargeContext,
  (snapshot) => {
    console.log(`Chunk ${snapshot.chunksProcessed}: ${snapshot.cumulativeScore * 100}%`);
    for (const div of snapshot.divergences) {
      console.warn(`⚠️ ${div.domain}: ${div.description}`);
    }
  }
);

// Visualize the result
console.log(visualizeStreamProgress(result.session));
```

### Visualization Output

```
┌─────────────────────────────────────────────────────────────┐
│  STREAMING HANDSHAKE: stream_1706793600000_a1b2c3           │
├─────────────────────────────────────────────────────────────┤
│  Status: SYNCHRONIZED                                       │
│  Chunks: 8                                                  │
├─────────────────────────────────────────────────────────────┤
│  Alignment: [████████████████████████████████░░░░░░░░] 82%  │
├─────────────────────────────────────────────────────────────┤
│  capabilities        [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░] 90%            │
│  task_understanding  [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░] 85%            │
│  key_concepts        [▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░] 70%            │
│  assumptions         [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░] 75%            │
└─────────────────────────────────────────────────────────────┘
```

### New Files (Gen 8)

| File | Lines | Description |
|------|-------|-------------|
| `src/streaming.ts` | ~550 | Streaming engine, chunker, visualizer |

### Demo

```bash
npx ts-node -e "require('./src/streaming').demoStreamingHandshake()"
```

---

## Future Evolution

- **Multi-party handshake** - Sync 3+ agents simultaneously
- ~~**Incremental updates** - Delta syncs during long collaborations~~ ✅ Gen 8 (streaming)
- ~~**Model persistence** - Remember past collaborations~~ ✅ Gen 7
- ~~**Trust accumulation** - Faster handshakes with familiar agents~~ ✅ Gen 7
- **Trust networks** - Transitive trust via vouching
- **Cryptographic identity** - Verify agent identity across systems
- **Adaptive streaming** - Learn optimal chunk sizes per agent pair
- **Compression** - Semantic compression for repeated concepts
