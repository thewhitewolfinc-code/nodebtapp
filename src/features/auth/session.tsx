import { createContext, lazy, Suspense, useContext, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import type { GoogleOutcome, SessionState } from './flow';
import { WorkspaceProvider, useWorkspace } from './workspace';

export interface AuthSession {
  state: SessionState;
  googleReady: boolean;
  guestReady: boolean;
  canRecoverGuest: boolean;
  canReturnToEntry: boolean;
  problem?: string;
  enterGuest: () => Promise<void>;
  recoverGuest: () => void;
  retry: () => Promise<void>;
  profile?: { name: string; email?: string };
  signInGoogle: () => Promise<GoogleOutcome>;
  continueSignIn: () => Promise<GoogleOutcome>;
  signOut: () => Promise<void>;
}
const unavailable: AuthSession = {
  state: 'signed-out', googleReady: true, guestReady: false, canRecoverGuest: false, canReturnToEntry: false,
  enterGuest: async () => { throw new Error('Your workspace is still being checked.'); },
  recoverGuest: () => undefined, retry: async () => undefined,
  signInGoogle: async () => { throw new Error(Platform.OS === 'web'
    ? 'Open the NoDebt Android or iOS app to sign in with Google.'
    : 'Google sign-in is not configured in this build. You can continue as Guest.'); },
  signOut: async () => undefined,
  continueSignIn: async () => { throw new Error('Complete sign-in in the NoDebt Android or iOS app.'); },
};
export const AuthContext = createContext<AuthSession>(unavailable);
const ConfiguredSession = lazy(() => import('./clerk-session'));
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

export function AuthSessionProvider({ children }: PropsWithChildren) {
  return <WorkspaceProvider><SessionProvider>{children}</SessionProvider></WorkspaceProvider>;
}
function SessionProvider({ children }: PropsWithChildren) {
  const workspace = useWorkspace();

  const retry = async () => {
    if (workspace.pending) return;
    await workspace.store.retry();
    if (Platform.OS !== 'web') await reloadAppAsync();
  };
  const fallback: AuthSession = { ...unavailable, state: 'loading', googleReady: false, problem: workspace.error, retry };
  // Missing external configuration must never prevent local-first guest access.
  // No Clerk runtime/token persistence is initialized in the web design preview.
  if (!publishableKey || Platform.OS === 'web') return <AuthContext value={!workspace.ready || workspace.mode === 'account' ? fallback : {
    ...unavailable, guestReady: true, retry, enterGuest: () => workspace.store.choose('guest'),
  }}>{children}</AuthContext>;
  return <Suspense fallback={<AuthContext value={fallback}>{children}</AuthContext>}>
    <ConfiguredSession publishableKey={publishableKey} retry={retry}>{children}</ConfiguredSession>
  </Suspense>;
}
export function useAuthSession() { return useContext(AuthContext); }
