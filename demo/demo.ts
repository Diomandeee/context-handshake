/**
 * Context Handshake Demo
 * 
 * Shows the full handshake flow between two AI agents
 */

import {
  ContextHandshake,
  buildMentalModel,
  performHandshake,
  formatHandshakeLog,
  ActiveSession,
  formatSession,
} from '../src';
import type { AgentContext } from '../src/protocol';

async function demo() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              Context Handshake Protocol Demo                  ║
║         AI-to-AI Synchronization Before Collaboration         ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Define two agents with different but overlapping contexts
  console.log('📝 Defining agents...\n');

  const clawd: AgentContext = {
    agentId: 'clawd-main',
    capabilities: ['code', 'research', 'planning', 'automation'],
    mentalModel: buildMentalModel({
      taskDescription: 'Build a real-time collaborative document editor',
      concepts: {
        'crdt': 'Conflict-free replicated data type for sync',
        'operational-transform': 'Alternative sync algorithm',
        'websocket': 'Real-time bidirectional communication',
        'collaboration': 'Multiple users editing simultaneously',
      },
      assumptions: [
        'Using React for frontend',
        'Node.js for backend',
        'WebSocket for real-time updates',
        'Y.js library for CRDT implementation',
      ],
      goals: [
        'Design system architecture',
        'Implement CRDT sync engine',
        'Build React editor component',
        'Add user presence indicators',
        'Deploy to production',
      ],
      constraints: [
        'Must work offline',
        'Sub-100ms latency for sync',
      ],
      confidence: 0.8,
    }),
    preferredStyle: 'technical',
  };

  const subAgent: AgentContext = {
    agentId: 'sync-engine-agent',
    capabilities: ['code', 'algorithms', 'distributed-systems'],
    mentalModel: buildMentalModel({
      taskDescription: 'Implement the synchronization engine for collaborative editing',
      concepts: {
        'crdt': 'Data structure that automatically resolves conflicts',
        'vector-clock': 'Logical timestamp for ordering events',
        'merge': 'Combining divergent document states',
      },
      assumptions: [
        'TypeScript for implementation',
        'May use existing CRDT library',
      ],
      goals: [
        'Implement text CRDT',
        'Handle concurrent edits',
        'Optimize for large documents',
      ],
      confidence: 0.7,
    }),
    preferredStyle: 'concise',
  };

  console.log(`Agent 1: ${clawd.agentId}`);
  console.log(`  Capabilities: ${clawd.capabilities.join(', ')}`);
  console.log(`  Task: ${clawd.mentalModel.taskUnderstanding}`);
  console.log(`  Confidence: ${(clawd.mentalModel.confidenceLevel * 100).toFixed(0)}%\n`);

  console.log(`Agent 2: ${subAgent.agentId}`);
  console.log(`  Capabilities: ${subAgent.capabilities.join(', ')}`);
  console.log(`  Task: ${subAgent.mentalModel.taskUnderstanding}`);
  console.log(`  Confidence: ${(subAgent.mentalModel.confidenceLevel * 100).toFixed(0)}%\n`);

  // Perform handshake
  console.log('🤝 Initiating handshake...\n');

  const initiator = new ContextHandshake(clawd);
  const responder = new ContextHandshake(subAgent);

  // Step 1: SYN
  console.log('─── Phase 1: SYN ───');
  const syn = initiator.initiate();
  console.log(`${clawd.agentId} → ${subAgent.agentId}: SYN`);
  console.log(`  Checksum: ${syn.checksum}`);
  console.log(`  State: ${initiator.getState()}\n`);

  // Step 2: SYN-ACK
  console.log('─── Phase 2: SYN-ACK ───');
  const synAck = responder.receiveSyn(syn);
  
  if (synAck.type === 'RST') {
    console.log(`❌ Handshake failed: ${synAck.reason}`);
    return;
  }

  console.log(`${subAgent.agentId} → ${clawd.agentId}: SYN-ACK`);
  console.log(`  Alignment Score: ${(synAck.alignment.score * 100).toFixed(1)}%`);
  console.log(`  Matched Concepts: ${synAck.alignment.matchedConcepts.join(', ') || 'none'}`);
  console.log(`  Divergences: ${synAck.alignment.divergences.length}`);
  console.log(`  Can Collaborate: ${synAck.alignment.compatibilityFlags.canCollaborate}`);
  console.log(`  State: ${responder.getState()}\n`);

  // Show divergences
  if (synAck.alignment.divergences.length > 0) {
    console.log('  Divergences found:');
    for (const d of synAck.alignment.divergences.slice(0, 3)) {
      console.log(`    - ${d.conceptId}: ${d.severity}`);
    }
    console.log('');
  }

  // Step 3: ACK
  console.log('─── Phase 3: ACK ───');
  const ack = initiator.receiveSynAck(synAck);

  if (ack.type === 'RST') {
    console.log(`❌ Handshake failed: ${ack.reason}`);
    return;
  }

  console.log(`${clawd.agentId} → ${subAgent.agentId}: ACK`);
  console.log(`  Session ID: ${ack.sessionId}`);
  console.log(`  Lead: ${ack.mergedModel.roleAssignments.lead}`);
  console.log(`  Support: ${ack.mergedModel.roleAssignments.support}`);
  console.log(`  Communication: ${ack.mergedModel.communicationProtocol}`);
  console.log(`  Conflict Resolution: ${ack.mergedModel.conflictResolution}\n`);

  // Finalize on responder
  responder.receiveAck(ack);

  // Show handshake log
  console.log('─── Handshake Log ───');
  console.log(formatHandshakeLog(syn, synAck, ack));

  // Create active session
  console.log('\n─── Active Session ───');
  const session = new ActiveSession(initiator.getSession()!, clawd.agentId);
  console.log(formatSession(session));

  // Simulate collaboration
  console.log('\n─── Collaboration ───');
  
  session.addMessage('Starting implementation of CRDT sync engine');
  console.log(`[${clawd.agentId}] Starting implementation of CRDT sync engine`);

  session.receiveMessage({
    id: 'msg_ext_1',
    from: subAgent.agentId,
    timestamp: new Date().toISOString(),
    content: 'Understood. I\'ll use Y.js as the CRDT foundation and build custom bindings.',
    contextUpdates: {
      keyConcepts: {
        'y.js': {
          name: 'Y.js',
          definition: 'High-performance CRDT library for text and data structures',
          relationships: ['crdt', 'sync'],
          importance: 'high',
        },
      },
    },
  });
  console.log(`[${subAgent.agentId}] Understood. I'll use Y.js as the CRDT foundation.`);

  session.addMessage('Great choice. Focus on text synchronization first.');
  console.log(`[${clawd.agentId}] Great choice. Focus on text synchronization first.`);

  session.achieveGoal('Implement text CRDT');
  console.log(`\n✅ Goal achieved: Implement text CRDT`);

  // End session
  console.log('\n─── Session End ───');
  const fin = session.end([
    'Y.js provides excellent CRDT primitives',
    'TypeScript types help catch sync issues early',
    'Context handshake reduced initial setup time',
  ]);

  console.log(`Session ${fin.sessionId} completed`);
  console.log(`Duration: ${fin.summary?.duration}ms`);
  console.log(`Messages: ${fin.summary?.messagesExchanged}`);
  console.log(`Goals achieved: ${fin.summary?.goalsAchieved.join(', ')}`);
  console.log(`Trust delta: +${((fin.summary?.trustDelta || 0) * 100).toFixed(1)}%`);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Demo Complete! 🎉                          ║
╚══════════════════════════════════════════════════════════════╝
`);
}

demo().catch(console.error);
