import { ClerkProvider, useAuth, useClerk, useSSO } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import { AuthContext } from './session';
import { completeGoogleFlow, completeHostedFlow, isAccountSession, resolveSessionState } from './flow';
import { canRecoverSavedGuest, isGuestSession, workspaceSessionState } from './navigation';
import { useWorkspace } from './workspace';
import { withAccountIntent } from './workspace-state';

WebBrowser.maybeCompleteAuthSession();
function SessionBridge({ children, retry }: PropsWithChildren<{ retry: () => Promise<void> }>) {
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { signOut, session, user } = useClerk();
  const { startSSOFlow } = useSSO();
  const { startHostedAuth } = useHostedAuth();
  const [followUp, setFollowUp] = useState(false);
  const workspace = useWorkspace();
  const [working, setWorking] = useState(false);
  const [offlineGuest, setOfflineGuest] = useState(false);
  const [problem, setProblem] = useState<string>();
  const restored = resolveSessionState({ loaded: isLoaded, signedIn: isSignedIn, status: session?.status, pendingTask: !!session?.currentTask });
  const resolved = restored === 'signed-out' && followUp ? 'needs-verification' : restored;
  const recoverable = !working && canRecoverSavedGuest(resolved, workspace) && !session;
  const checkpoint = workspace.mode === 'account' && workspace.pending === null;
  const state = workspaceSessionState(resolved, workspace, working, offlineGuest, !!session);
  useEffect(() => {
    if (isAccountSession(resolved) && workspace.ready && !checkpoint && !workspace.pending && !workspace.error) {
      void workspace.store.choose('account').catch(() => undefined);
    }
  }, [resolved, workspace.ready, workspace.pending, workspace.error, workspace.store, checkpoint]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync().catch(() => undefined);
    return () => { void WebBrowser.coolDownAsync().catch(() => undefined); };
  }, []);
  return <AuthContext value={{
    state, googleReady: state === 'signed-out', guestReady: isGuestSession(state),
    canReturnToEntry: resolved === 'signed-out' && workspace.mode === 'account' && !working,
    canRecoverGuest: recoverable, problem: workspace.error ?? problem, retry: async () => { if (!working && !workspace.pending) await retry(); },
    recoverGuest: () => { if (recoverable) setOfflineGuest(true); },
    enterGuest: async () => {
      if (!isGuestSession(state) || session) throw new Error('Your account must be signed out before opening Guest.');
      await workspace.store.choose('guest');
    },
    profile: user ? { name: user.fullName || user.username || 'NoDebt account', email: user.primaryEmailAddress?.emailAddress } : undefined,
    signOut: async () => {
      await signOut(); setFollowUp(false); setOfflineGuest(false); await workspace.store.choose('entry');
    },
    continueSignIn: async () => {
      if (state !== 'needs-verification') throw new Error('There is no pending sign-in to complete.');
      try {
        // Clerk's hosted flow handles instance-specific MFA, missing fields and session tasks.
        // The SDK validates state/PKCE and activates the returned native session itself.
        const outcome = await withAccountIntent(workspace.store, () => completeHostedFlow(() => startHostedAuth({ mode: 'sign-in', redirectUrl: makeRedirectUri({ scheme: 'nodebt', path: 'sso-callback' }) })));
        if (outcome === 'signed-in') setFollowUp(false);
        return outcome;
      } catch {
        throw new Error('We could not complete verification. Check your connection and try again.');
      }
    },
    signInGoogle: async () => {
      if (state !== 'signed-out') throw new Error('Your session is still getting ready. Please try again.');
      setWorking(true); setProblem(undefined);
      try {
        const outcome = await withAccountIntent(workspace.store, () => completeGoogleFlow(() => startSSOFlow({
          strategy: 'oauth_google', redirectUrl: makeRedirectUri({ scheme: 'nodebt', path: 'sso-callback' }),
        })));
        if (outcome === 'verification-required') setFollowUp(true);
        if (outcome === 'cancelled') {
          await workspace.store.choose('entry');
          setProblem('Sign-in cancelled. You can try again when you are ready.');
        }
        return outcome;
      } catch {
        // Provider responses can include identifiers and request details. Do not expose/log them.
        const message = 'We could not finish Google sign-in. Check your connection and try again.';
        setProblem(message); throw new Error(message);
      } finally { setWorking(false); }
    },
  }}>{children}</AuthContext>;
}
export default function ConfiguredSession({ publishableKey, children, retry }: PropsWithChildren<{ publishableKey: string; retry: () => Promise<void> }>) {
  return <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
    <SessionBridge retry={retry}>{children}</SessionBridge>
  </ClerkProvider>;
}
