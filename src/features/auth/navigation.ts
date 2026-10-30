import type { SessionState } from './flow';
import type { WorkspaceState } from './workspace-state';
export type EntryRoute = '/' | '/welcome' | '/home' | '/dashboard' | '/verify';
export function isGuestSession(state: SessionState) { return state === 'signed-out' || state === 'guest-offline'; }
export function navigationFor(state: SessionState, workspace: Pick<WorkspaceState, 'ready' | 'mode' | 'pending'>) {
  const account = state === 'signed-in', verification = state === 'needs-verification';
  const entry = isGuestSession(state) && workspace.ready && workspace.mode !== 'account';
  const guest = workspace.ready && workspace.mode === 'guest' && workspace.pending !== 'account' && isGuestSession(state);
  const destination: EntryRoute = account ? '/dashboard' : verification ? '/verify' : state === 'loading' || !workspace.ready || (workspace.mode === 'account' && state === 'signed-out') ? '/' : guest ? '/home' : '/welcome';
  return { destination, account, verification, guest, entry, startup: !account && !verification, callback: !account };
}
export function canRecoverSavedGuest(state: SessionState, workspace: WorkspaceState): boolean {
  return state === 'loading' && workspace.ready && workspace.mode === 'guest' && workspace.pending === null && !workspace.error;
}

/** Publish no account route until its durable workspace checkpoint has completed. */
export function workspaceSessionState(resolved: SessionState, workspace: WorkspaceState, working: boolean, offlineGuest: boolean, hasSession: boolean): SessionState {
  const account = resolved === 'signed-in' || resolved === 'needs-verification';
  if (!workspace.ready || working || workspace.pending === 'account' || (account && (workspace.mode !== 'account' || workspace.pending !== null))) return 'loading';
  if (resolved === 'signed-out' && workspace.mode === 'account') return 'loading';
  if (offlineGuest && !hasSession && canRecoverSavedGuest(resolved, workspace)) return 'guest-offline';
  return resolved;
}