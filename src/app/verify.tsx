import { useState } from 'react';
import { Badge, Button, Notice, Page, Problem } from '@/components/nodebt/ui';
import { useAuthSession } from '@/features/auth/session';
import { entryRequests } from '@/features/auth/flow';
export default function Verify() {
  const session = useAuthSession();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>(), [cancelled, setCancelled] = useState(false);
  async function run(signOut: boolean) {
    await entryRequests.run(async () => {
      setBusy(true); setError(undefined); setCancelled(false);
      try { if (signOut) await session.signOut(); else setCancelled(await session.continueSignIn() === 'cancelled'); }
      catch { setError('We could not complete this step. Check your connection and try again.'); }
      finally { setBusy(false); }
    });
  }
  return <Page title="Finish signing in" subtitle="One more step keeps your account secure." headerBadge={<Badge label="Verification required" icon="shield" tone="warning" />}>
    <Notice tone="warning">Continue securely to complete the verification requested for your account.</Notice>
    <Problem message={error} />
    {cancelled && <Notice>Verification cancelled. You can try again when you are ready.</Notice>}
    <Button label="Finish sign-in securely" icon="shield" loading={busy} disabled={busy} onPress={() => { void run(false); }} />
    <Button label="Sign out" icon="log-out" secondary disabled={busy} onPress={() => { void run(true); }} />
  </Page>;
}
