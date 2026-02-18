/**
 * Context Handshake Tests
 */

import { 
  ContextHandshake, 
  performHandshake,
  buildMentalModel,
  analyzeAlignment,
  formatHandshakeLog,
  ActiveSession,
} from '../src';
import type { AgentContext } from '../src/protocol';

// Test utilities
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

function test(name: string, fn: () => void | Promise<void>): void {
  console.log(`\n📋 Test: ${name}`);
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.catch(e => console.error(`❌ FAILED: ${e.message}`));
    }
  } catch (e: any) {
    console.error(`❌ FAILED: ${e.message}`);
  }
}

// Test data
const agentAlpha: AgentContext = {
  agentId: 'alpha',
  capabilities: ['code', 'research', 'architecture'],
  mentalModel: buildMentalModel({
    taskDescription: 'Build a microservices API gateway',
    concepts: {
      'gateway': 'Central entry point for API requests',
      'auth': 'JWT-based authentication',
      'routing': 'Request routing to downstream services',
    },
    assumptions: [
      'Using Node.js with Express',
      'PostgreSQL for data storage',
      'Docker for deployment',
    ],
    goals: [
      'Setup Express gateway',
      'Implement JWT validation',
      'Add rate limiting',
      'Create health checks',
    ],
    confidence: 0.85,
  }),
  preferredStyle: 'technical',
};

const agentBeta: AgentContext = {
  agentId: 'beta',
  capabilities: ['code', 'security', 'testing'],
  mentalModel: buildMentalModel({
    taskDescription: 'Implement secure API gateway with authentication',
    concepts: {
      'gateway': 'API proxy and load balancer',
      'jwt': 'JSON Web Token authentication',
      'middleware': 'Express middleware chain',
    },
    assumptions: [
      'Express framework preferred',
      'JWT for stateless auth',
    ],
    goals: [
      'Implement auth middleware',
      'Add request validation',
      'Write integration tests',
    ],
    confidence: 0.75,
  }),
  preferredStyle: 'concise',
};

// Tests
test('buildMentalModel creates valid model', () => {
  const model = buildMentalModel({
    taskDescription: 'Test task',
    concepts: { 'test': 'A test concept' },
    goals: ['Goal 1', 'Goal 2'],
  });

  assert(model.taskUnderstanding === 'Test task', 'Task understanding set');
  assert(Object.keys(model.keyConcepts).length === 1, 'Concepts created');
  assert(model.goals.length === 2, 'Goals created');
  assert(model.confidenceLevel === 0.7, 'Default confidence set');
});

test('ContextHandshake initiates SYN', () => {
  const handshake = new ContextHandshake(agentAlpha);
  const syn = handshake.initiate();

  assert(syn.type === 'SYN', 'Message type is SYN');
  assert(syn.from === 'alpha', 'From is correct');
  assert(syn.checksum.length === 16, 'Checksum generated');
  assert(syn.nonce.length === 32, 'Nonce generated');
  assert(handshake.getState() === 'syn_sent', 'State is syn_sent');
});

test('ContextHandshake receives SYN and sends SYN-ACK', () => {
  const initiator = new ContextHandshake(agentAlpha);
  const responder = new ContextHandshake(agentBeta);

  const syn = initiator.initiate();
  const synAck = responder.receiveSyn(syn);

  assert(synAck.type === 'SYN-ACK', 'Response is SYN-ACK');
  if (synAck.type === 'SYN-ACK') {
    assert(synAck.ackChecksum === syn.checksum, 'Acknowledges SYN checksum');
    assert(synAck.alignment.score > 0, 'Alignment score calculated');
    assert(responder.getState() === 'syn_received', 'Responder state correct');
  }
});

test('analyzeAlignment detects shared concepts', () => {
  const alignment = analyzeAlignment(agentAlpha, agentBeta);

  assert(alignment.score > 0.5, 'Alignment score reasonable');
  assert(alignment.matchedConcepts.length > 0, 'Matched concepts found');
  assert(alignment.compatibilityFlags.canCollaborate, 'Can collaborate');
  console.log(`   Alignment score: ${(alignment.score * 100).toFixed(1)}%`);
  console.log(`   Matched: ${alignment.matchedConcepts.join(', ')}`);
});

test('Full handshake completes successfully', async () => {
  const result = await performHandshake(agentAlpha, agentBeta);

  assert(!('error' in result), 'No error in result');
  if (!('error' in result)) {
    assert(result.session.sessionId.startsWith('session_'), 'Session ID generated');
    assert(result.session.participants.length === 2, 'Two participants');
    assert(result.alignment.score > 0, 'Alignment captured');
    console.log(`   Session: ${result.session.sessionId}`);
    console.log(`   Alignment: ${(result.alignment.score * 100).toFixed(1)}%`);
  }
});

test('Handshake fails on low alignment', async () => {
  const veryDifferentAgent: AgentContext = {
    agentId: 'gamma',
    capabilities: ['music', 'art'],
    mentalModel: buildMentalModel({
      taskDescription: 'Compose a symphony in D minor',
      concepts: {
        'melody': 'Main musical theme',
        'harmony': 'Supporting chord structure',
      },
      goals: ['Write overture', 'Compose movements'],
      confidence: 0.9,
    }),
    preferredStyle: 'verbose',
  };

  const result = await performHandshake(agentAlpha, veryDifferentAgent, {
    minAlignment: 0.8, // High threshold
  });

  assert('error' in result, 'Low alignment causes failure');
  if ('error' in result) {
    console.log(`   Expected failure: ${result.error}`);
  }
});

test('ActiveSession tracks messages', () => {
  const session: any = {
    sessionId: 'test_session',
    participants: ['alpha', 'beta'],
    mergedModel: {
      sharedUnderstanding: buildMentalModel({
        taskDescription: 'Test task',
        goals: ['Goal 1'],
      }),
      roleAssignments: { lead: 'alpha', support: 'beta' },
      communicationProtocol: 'concise',
      conflictResolution: 'defer_to_lead',
      syncedAt: new Date().toISOString(),
      divergencesAccepted: [],
    },
    startedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    status: 'active',
    messageLog: [],
  };

  const active = new ActiveSession(session, 'alpha');
  
  assert(active.isLead, 'Alpha is lead');
  assert(active.peerId === 'beta', 'Peer is beta');

  active.addMessage('Starting work on the task');
  active.addMessage('Completed step 1', {
    goals: [{ id: 'new', description: 'New goal', priority: 3, status: 'active' }],
  });

  assert(active.getHistory().length === 2, 'Two messages logged');
  console.log(`   Messages: ${active.getHistory().length}`);
});

test('formatHandshakeLog produces readable output', () => {
  const initiator = new ContextHandshake(agentAlpha);
  const responder = new ContextHandshake(agentBeta);

  const syn = initiator.initiate();
  const synAck = responder.receiveSyn(syn);
  
  if (synAck.type === 'SYN-ACK') {
    const ack = initiator.receiveSynAck(synAck);
    if (ack.type === 'ACK') {
      const log = formatHandshakeLog(syn, synAck, ack);
      assert(log.includes('SYN from:'), 'Log includes SYN');
      assert(log.includes('SYN-ACK'), 'Log includes SYN-ACK');
      assert(log.includes('ACK'), 'Log includes ACK');
      console.log('\n' + log);
    }
  }
});

// Run tests
console.log('🧪 Context Handshake Test Suite\n');
console.log('================================');
