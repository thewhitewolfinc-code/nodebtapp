import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthRequestGate, completeGoogleFlow, completeHostedFlow, entryScope, isAccountSession, resolveSessionState } from '../src/features/auth/flow.ts';

test('Google cancellation/dismissal never activates a session and can be retried', async () => {
  for (const type of ['cancel', 'dismiss']) {
    let activations = 0;
    assert.equal(await completeGoogleFlow(async () => ({ createdSessionId: null, authSessionResult: { type },
      setActive: async () => { activations++; } })), 'cancelled');
    assert.equal(activations, 0);
  }
});
test('Google flow activates only a completed Clerk session', async () => {
  const sessions: string[] = [];
  assert.equal(await completeGoogleFlow(async () => ({ createdSessionId: 'test-session', authSessionResult: { type: 'success' },
    setActive: async ({ session }) => { sessions.push(session); } })), 'signed-in');
  assert.deepEqual(sessions, ['test-session']);
});
test('incomplete OAuth requests follow-up without simulating sign-in; absent activation still fails', async () => {
  assert.equal(await completeGoogleFlow(async () => ({ createdSessionId: null, authSessionResult: { type: 'success' } })), 'verification-required');
  await assert.rejects(completeGoogleFlow(async () => ({ createdSessionId: 'test-session', authSessionResult: { type: 'success' } })), /activate the session/);
});
test('provider and activation failures propagate without an authenticated outcome', async () => {
  await assert.rejects(completeGoogleFlow(async () => { throw new Error('offline'); }), /offline/);
  await assert.rejects(completeGoogleFlow(async () => ({ createdSessionId: 'test-session', authSessionResult: { type: 'success' }, setActive: async () => { throw new Error('expired'); } })), /expired/);
});
test('an unsuccessful browser result never activates a session even if a stale ID is present', async () => {
  for (const type of ['locked', 'error']) {
    let activations = 0;
    await assert.rejects(completeGoogleFlow(async () => ({ createdSessionId: 'stale-session', authSessionResult: { type },
      setActive: async () => { activations++; } })), /did not complete/);
    assert.equal(activations, 0);
  }
});
test('uninitialized or missing browser results cannot activate a session or request verification', async () => {
  for (const authSessionResult of [null, undefined]) {
    for (const createdSessionId of [null, 'stale-session']) {
      let activations = 0;
      await assert.rejects(completeGoogleFlow(async () => ({ createdSessionId, authSessionResult,
        setActive: async () => { activations++; } })), /did not complete/);
      assert.equal(activations, 0);
    }
  }
});
test('entry actions share a synchronous lock, including Google versus Guest races', async () => {
  const gate = new AuthRequestGate();
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => { finish = resolve; });
  let guestCalls = 0;
  const google = gate.run(async () => { await waiting; return 'google'; });
  assert.equal(await gate.run(async () => { guestCalls++; return 'guest'; }), undefined);
  assert.equal(guestCalls, 0);
  finish();
  assert.equal(await google, 'google');
  assert.equal(await gate.run(async () => 'retry'), 'retry');
});
test('a failed entry releases the lock for a real retry', async () => {
  const gate = new AuthRequestGate();
  await assert.rejects(gate.run(async () => { throw new Error('network failure'); }), /network failure/);
  assert.equal(await gate.run(async () => 'retry'), 'retry');
});
test('account and pending sessions cannot expose guest data, including direct financial links', () => {
  for (const publicRoute of [true, false]) {
    assert.equal(entryScope('signed-in', publicRoute), 'account-blocked');
    assert.equal(entryScope('needs-verification', publicRoute), 'account-blocked');
    assert.equal(entryScope('loading', publicRoute), 'loading');
  }
  assert.equal(entryScope('signed-out', true), 'public');
  assert.equal(entryScope('signed-out', false), 'guest');
});
test('restored sessions cannot grant guest or account access before Clerk finishes loading', () => {
  for (const status of [undefined, 'active', 'pending']) {
    const state = resolveSessionState({ loaded: false, signedIn: true, status });
    assert.equal(state, 'loading');
    assert.equal(entryScope(state, false), 'loading');
    assert.equal(isAccountSession(state), false);
  }
  assert.equal(resolveSessionState({ loaded: true, signedIn: true }), 'loading');
});
test('only active completed sessions show the signed-in account state', () => {
  assert.equal(resolveSessionState({ loaded: true, signedIn: true, status: 'active' }), 'signed-in');
  assert.equal(resolveSessionState({ loaded: true, signedIn: false }), 'signed-out');
  assert.equal(isAccountSession('signed-in'), true);
  assert.equal(isAccountSession('signed-out'), false);
});
test('pending requirements never show completed sign-in or expose the guest ledger', () => {
  for (const input of [
    { loaded: true, signedIn: true, status: 'pending' },
    { loaded: true, signedIn: false, status: 'pending' },
    { loaded: true, signedIn: true, status: 'active', pendingTask: true },
    { loaded: true, signedIn: true, status: 'ended' },
  ]) {
    const state = resolveSessionState(input);
    assert.equal(state, 'needs-verification');
    assert.equal(isAccountSession(state), true);
    assert.equal(entryScope(state, false), 'account-blocked');
  }
});
test('hosted follow-up accepts only a successful SDK-created session', async () => {
  assert.equal(await completeHostedFlow(async () => ({ createdSessionId: 'hosted-session', authSessionResult: { type: 'success' } })), 'signed-in');
  for (const result of [
    { createdSessionId: null, authSessionResult: { type: 'success' } },
    { createdSessionId: 'stale-session', authSessionResult: { type: 'error' } },
    { createdSessionId: 'stale-session', authSessionResult: null },
  ]) await assert.rejects(completeHostedFlow(async () => result), /did not complete/);
});
test('hosted cancellation and errors leave verification retryable', async () => {
  for (const type of ['cancel', 'dismiss']) {
    assert.equal(await completeHostedFlow(async () => ({ createdSessionId: null, authSessionResult: { type } })), 'cancelled');
  }
  await assert.rejects(completeHostedFlow(async () => { throw new Error('network unavailable'); }), /network unavailable/);
});
