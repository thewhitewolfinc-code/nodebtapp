/** Structural subset of Clerk's SSO result; no financial storage dependency. */
export interface GoogleFlowResult {
  createdSessionId: string | null;
  setActive?: (params: { session: string }) => Promise<unknown>;
  authSessionResult?: { type: string } | null;
}
export type GoogleOutcome = 'signed-in' | 'cancelled' | 'verification-required';
export async function completeGoogleFlow(start: () => Promise<GoogleFlowResult>): Promise<GoogleOutcome> {
  const result = await start();
  if (result.authSessionResult?.type === 'cancel' || result.authSessionResult?.type === 'dismiss') return 'cancelled';
  // The SDK returns a null browser result while its sign-in/up hooks are loading.
  // That is not a completed OAuth attempt and must not open verification recovery.
  if (result.authSessionResult?.type !== 'success') {
    throw new Error('Google sign-in did not complete. Please try again.');
  }
  if (!result.createdSessionId) return 'verification-required';
  if (!result.setActive) throw new Error('Google sign-in could not activate the session. Please try again.');
  await result.setActive({ session: result.createdSessionId });
  return 'signed-in';
}
/** Hosted auth activates its native session inside the Clerk SDK; never activate it a second time. */
export async function completeHostedFlow(start: () => Promise<Pick<GoogleFlowResult, 'createdSessionId' | 'authSessionResult'>>): Promise<GoogleOutcome> {
  const result = await start();
  if (result.authSessionResult?.type === 'cancel' || result.authSessionResult?.type === 'dismiss') return 'cancelled';
  if (result.authSessionResult?.type !== 'success' || !result.createdSessionId) {
    throw new Error('Account verification did not complete. Please try again.');
  }
  return 'signed-in';
}

/** One lock for both entry actions, acquired synchronously before any await. */
export class AuthRequestGate {
  private pending = false;
  async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    if (this.pending) return undefined;
    this.pending = true;
    try { return await operation(); } finally { this.pending = false; }
  }
}

/** Shared across Welcome and callback route instances retained by native navigation. */
export const entryRequests = new AuthRequestGate();

export type SessionState = 'loading' | 'signed-out' | 'signed-in' | 'needs-verification' | 'guest-offline';
/** Pending Clerk sessions must not be mistaken for either guest access or completed authentication. */
export function resolveSessionState({ loaded, signedIn, status, pendingTask = false }: {
  loaded: boolean; signedIn?: boolean; status?: string; pendingTask?: boolean;
}): SessionState {
  if (!loaded) return 'loading';
  if (status === 'pending' || pendingTask) return 'needs-verification';
  if (!signedIn) return 'signed-out';
  if (!status) return 'loading';
  return status === 'active' ? 'signed-in' : 'needs-verification';
}
export function isAccountSession(state: SessionState): boolean {
  return state === 'signed-in' || state === 'needs-verification';
}
/** Account sessions can never fall through to the guest provider or its financial routes. */
export function entryScope(session: SessionState, publicRoute: boolean): 'public' | 'guest' | 'account-blocked' | 'loading' {
  if (session === 'loading') return 'loading';
  if (isAccountSession(session)) return 'account-blocked';
  return publicRoute ? 'public' : 'guest';
}
