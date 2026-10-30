import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigationFor, canRecoverSavedGuest, workspaceSessionState } from '../src/features/auth/navigation.ts';
import { WorkspaceStore, withAccountIntent, type WorkspaceMode } from '../src/features/auth/workspace-state.ts';
const saved = (mode: WorkspaceMode | null) => ({ ready: true, mode, pending: null });
test('active and restored accounts always land on Dashboard and cannot mount Guest or entry routes', () => {
  for (const mode of [null, 'entry', 'guest', 'account'] as const) {
    const access = navigationFor('signed-in', saved(mode));
    assert.equal(access.destination, '/dashboard');
    assert.equal(access.account, true);
    assert.equal(access.guest, false);
    assert.equal(access.entry, false);
    assert.equal(access.startup, false);
    assert.equal(access.callback, false);
  }
});
test('pending verification never grants dashboard or guest access', () => {
  const access = navigationFor('needs-verification', saved('guest'));
  assert.equal(access.destination, '/verify');
  assert.equal(access.account, false);
  assert.equal(access.guest, false);
});
test('unknown sessions fail closed even with an existing guest workspace', () => {
  const access = navigationFor('loading', saved('guest'));
  assert.equal(access.destination, '/');
  assert.equal(access.guest, false);
  assert.equal(access.account, false);
});
test('logout entry does not reopen Guest; an explicit guest choice does', () => {
  assert.equal(navigationFor('signed-out', saved('entry')).destination, '/welcome');
  assert.equal(navigationFor('signed-out', saved('account')).destination, '/');
  assert.equal(navigationFor('signed-out', saved('account')).entry, false);
  assert.equal(navigationFor('signed-out', saved('guest')).destination, '/home');
  assert.equal(navigationFor('signed-out', saved('guest')).account, false);
});
test('offline recovery requires a known guest choice and no errors or writes', () => {
  for (const mode of [null, 'entry', 'account'] as const) assert.equal(canRecoverSavedGuest('loading', saved(mode)), false);
  assert.equal(canRecoverSavedGuest('loading', saved('guest')), true);
  assert.equal(canRecoverSavedGuest('loading', { ...saved('guest'), pending: 'account' }), false);
  assert.equal(canRecoverSavedGuest('loading', { ...saved('guest'), error: 'unavailable' }), false);
  assert.equal(canRecoverSavedGuest('signed-in', saved('guest')), false);
});
test('explicit offline Guest remains on Home when connectivity returns signed out', () => {
  assert.equal(navigationFor('guest-offline', saved('guest')).destination, '/home');
  assert.equal(navigationFor('signed-out', saved('guest')).destination, '/home');
  assert.equal(navigationFor('signed-in', saved('guest')).guest, false);
});
test('account intent is durable before any browser operation and prevents recovery', async () => {
  let stored: string | null = 'guest';
  const store = new WorkspaceStore({ read: async () => stored, write: async mode => { stored = mode; } });
  await store.load();
  await withAccountIntent(store, async () => {
    assert.equal(stored, 'account');
    assert.equal(canRecoverSavedGuest('loading', store.getSnapshot()), false);
  });
});
test('failed checkpoint never starts browser auth, and failed/invalid reads never allow Guest', async () => {
  let started = false;
  const store = new WorkspaceStore({ read: async () => 'guest', write: async () => { throw Error('disk'); } });
  await store.load();
  await assert.rejects(withAccountIntent(store, async () => { started = true; }));
  assert.equal(started, false);
  assert.equal(canRecoverSavedGuest('loading', store.getSnapshot()), false);
  for (const value of ['corrupt', '']) {
    const invalid = new WorkspaceStore({ read: async () => value, write: async () => undefined });
    await invalid.load();
    assert.equal(invalid.getSnapshot().ready, false);
  }
});
test('workspace writes serialize so rapid account then logout cannot persist stale account choice', async () => {
  const writes: string[] = [];
  const store = new WorkspaceStore({ read: async () => 'guest', write: async mode => { await Promise.resolve(); writes.push(mode); } });
  await store.load();
  await Promise.all([store.choose('account'), store.choose('entry')]);
  assert.deepEqual(writes, ['account', 'entry']);
  assert.equal(store.getSnapshot().mode, 'entry');
  assert.equal(store.getSnapshot().pending, null);
});

test('restored account stays protected until the saved account checkpoint commits', () => {
  assert.equal(workspaceSessionState('signed-in', saved('guest'), false, false, true), 'loading');
  assert.equal(workspaceSessionState('signed-in', { ...saved('guest'), pending: 'account' }, false, false, true), 'loading');
  assert.equal(workspaceSessionState('signed-in', { ...saved('guest'), error: 'disk' }, false, true, true), 'loading');
  assert.equal(workspaceSessionState('signed-in', saved('account'), false, false, true), 'signed-in');
});
test('browser actions and logout cannot transiently expose a guest or account screen', () => {
  for (const state of ['signed-out', 'signed-in', 'needs-verification'] as const) {
    assert.equal(workspaceSessionState(state, saved('account'), true, false, state !== 'signed-out'), 'loading');
  }
});
test('offline recovery never overrides an active or pending account, and explicit choice is required', () => {
  assert.equal(workspaceSessionState('loading', saved('guest'), false, false, false), 'loading');
  assert.equal(workspaceSessionState('loading', saved('guest'), false, true, false), 'guest-offline');
  assert.equal(workspaceSessionState('loading', saved('guest'), false, true, true), 'loading');
  assert.equal(workspaceSessionState('signed-in', saved('account'), false, true, true), 'signed-in');
  assert.equal(workspaceSessionState('needs-verification', saved('account'), false, true, true), 'needs-verification');
});
test('a saved account never shows Welcome during a transient signed-out restoration update', () => {
  for (const resolved of ['loading', 'signed-out', 'signed-in'] as const) {
    const state = workspaceSessionState(resolved, saved('account'), false, false, resolved === 'signed-in');
    assert.equal(navigationFor(state, saved('account')).entry, false);
    assert.equal(navigationFor(state, saved('account')).guest, false);
  }
  assert.equal(workspaceSessionState('signed-out', saved('entry'), false, false, false), 'signed-out');
});