/**
 * Trust Evolution Demo
 * 
 * Demonstrates how trust builds over multiple collaborations:
 * 1. First contact: Full handshake, minimal trust
 * 2. After success: Trust increases, faster handshakes
 * 3. After multiple collabs: Bonded status, instant reconnect
 * 4. After time away: Trust decay and reactivation
 */

import TrustMemory, {
  TrustTier,
  TRUST_CAPABILITIES,
} from '../src/trust';
import MemoryHandshake, {
  TrustAwareContext,
} from '../src/memory-handshake';

// Tier names for pretty printing
const tierNames = ['UNKNOWN', 'ACQUAINTANCE', 'FAMILIAR', 'TRUSTED', 'BONDED'];

function printTrustStatus(memory: TrustMemory, partnerId: string): void {
  const rel = memory.getRelationship(partnerId);
  const caps = TRUST_CAPABILITIES[rel.tier];
  
  console.log(`\n📊 Trust Status with ${partnerId}:`);
  console.log(`   Tier: ${tierNames[rel.tier]} (${rel.tier})`);
  console.log(`   Score: ${rel.score.toFixed(1)}/100`);
  console.log(`   Velocity: ${rel.trustVelocity > 0 ? '+' : ''}${rel.trustVelocity.toFixed(2)}`);
  console.log(`   Handshake: ${caps.handshakeComplexity}`);
  console.log(`   Collabs: ${rel.history.length}`);
  console.log(`   Capabilities: ${JSON.stringify({
    delegate: caps.canDelegateAutonomously,
    sensitive: caps.canAccessSensitiveContext,
    modify: caps.canModifySharedState,
  })}`);
}

async function simulateCollaboration(
  memory: TrustMemory,
  partnerId: string,
  outcome: 'success' | 'partial' | 'failure',
  alignment: number = 0.8,
  complexity: number = 1
): Promise<void> {
  const duration = Math.floor(Math.random() * 3600) + 300;
  memory.recordCollaboration(
    partnerId,
    outcome,
    alignment,
    duration,
    complexity,
    0
  );
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('       Trust Evolution Demo - Context Handshake Gen 7       ');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Initialize our agent's trust memory
  const memory = new TrustMemory('clawd-main');
  const partnerId = 'sub-agent-alpha';

  // ═══════════════════════════════════════════════════════════
  // Phase 1: First Contact
  // ═══════════════════════════════════════════════════════════
  console.log('🤝 Phase 1: First Contact');
  console.log('─'.repeat(50));
  
  printTrustStatus(memory, partnerId);
  console.log('\n   → First handshake requires full context exchange');
  console.log('   → Minimal capabilities, maximum caution');

  // Simulate first successful collaboration
  console.log('\n   [Simulating first collaboration...]');
  await simulateCollaboration(memory, partnerId, 'success', 0.85, 1);
  printTrustStatus(memory, partnerId);

  // ═══════════════════════════════════════════════════════════
  // Phase 2: Building Acquaintance
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n🌱 Phase 2: Building Acquaintance');
  console.log('─'.repeat(50));
  
  // A few more successful collaborations
  for (let i = 0; i < 3; i++) {
    console.log(`\n   [Collaboration ${i + 2}...]`);
    await simulateCollaboration(memory, partnerId, 'success', 0.8 + Math.random() * 0.15, 1 + Math.random());
  }
  
  printTrustStatus(memory, partnerId);
  console.log('\n   → Handshake now abbreviated - skip deep alignment');
  console.log('   → Starting to build shared vocabulary');

  // ═══════════════════════════════════════════════════════════
  // Phase 3: Becoming Familiar
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n🌿 Phase 3: Becoming Familiar');
  console.log('─'.repeat(50));
  
  // More collaborations with increasing complexity
  for (let i = 0; i < 4; i++) {
    console.log(`\n   [Complex collaboration ${i + 1}...]`);
    await simulateCollaboration(memory, partnerId, 'success', 0.85, 2 + i);
  }
  
  printTrustStatus(memory, partnerId);
  console.log('\n   → Context diff only - just sync what changed');
  console.log('   → Can now access sensitive context');
  console.log('   → Allowed to spawn sub-agents');

  // ═══════════════════════════════════════════════════════════
  // Phase 4: Building Deep Trust
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n🌳 Phase 4: Building Deep Trust');
  console.log('─'.repeat(50));
  
  // Handle a conflict resolution
  console.log('\n   [Resolving a conflict together...]');
  memory.recordCollaboration(partnerId, 'success', 0.7, 7200, 3, 2);
  
  // More high-complexity successful work
  for (let i = 0; i < 3; i++) {
    console.log(`\n   [High-stakes collaboration ${i + 1}...]`);
    await simulateCollaboration(memory, partnerId, 'success', 0.9, 4);
  }
  
  printTrustStatus(memory, partnerId);
  console.log('\n   → Instant handshakes - just verify and go');
  console.log('   → Can delegate autonomously');
  console.log('   → Can modify shared state');

  // ═══════════════════════════════════════════════════════════
  // Phase 5: Approaching Bonded Status
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n💎 Phase 5: Approaching Bonded Status');
  console.log('─'.repeat(50));
  
  // Continue building trust
  for (let i = 0; i < 4; i++) {
    console.log(`\n   [Elite collaboration ${i + 1}...]`);
    await simulateCollaboration(memory, partnerId, 'success', 0.95, 5);
  }
  
  printTrustStatus(memory, partnerId);
  
  const rel = memory.getRelationship(partnerId);
  if (rel.tier === TrustTier.BONDED) {
    console.log('\n   🎉 BONDED STATUS ACHIEVED!');
    console.log('   → Maximum trust level');
    console.log('   → Full autonomous delegation');
    console.log('   → Deep context access (depth: 10)');
  } else {
    console.log(`\n   → ${100 - rel.score} more points to BONDED`);
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 6: Handling Failure
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n⚠️ Phase 6: Handling Failure');
  console.log('─'.repeat(50));
  
  console.log('\n   [A collaboration goes wrong...]');
  await simulateCollaboration(memory, partnerId, 'failure', 0.3, 2);
  
  printTrustStatus(memory, partnerId);
  console.log('\n   → Trust decreased but relationship maintained');
  console.log('   → History of success buffers single failures');
  
  // Recover with success
  console.log('\n   [Recovery collaboration...]');
  await simulateCollaboration(memory, partnerId, 'success', 0.9, 3);
  
  printTrustStatus(memory, partnerId);
  console.log('\n   → Trust recovering from the setback');

  // ═══════════════════════════════════════════════════════════
  // Summary Statistics
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n📈 Network Reputation Summary');
  console.log('─'.repeat(50));
  
  const rep = memory.getNetworkReputation();
  console.log(`   Total relationships: ${rep.relationships}`);
  console.log(`   Average trust score: ${rep.score.toFixed(1)}`);
  console.log(`   Network tier: ${tierNames[rep.tier]}`);

  // ═══════════════════════════════════════════════════════════
  // Export/Import Test
  // ═══════════════════════════════════════════════════════════
  console.log('\n\n💾 Persistence Test');
  console.log('─'.repeat(50));
  
  const exported = memory.export();
  console.log(`   Exported ${exported.length} bytes`);
  
  const restored = TrustMemory.import(exported);
  const restoredRel = restored.getRelationship(partnerId);
  console.log(`   Restored relationship: ${tierNames[restoredRel.tier]} (${restoredRel.history.length} collabs)`);
  console.log('   ✓ Trust memory survives session restarts!');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                    Demo Complete                           ');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
