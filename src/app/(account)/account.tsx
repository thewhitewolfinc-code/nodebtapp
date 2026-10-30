import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Copy, IconCircle, Notice, Page, Problem, Section } from '@/components/nodebt/ui';
import { useAuthSession } from '@/features/auth/session';
import { entryRequests } from '@/features/auth/flow';
export default function Account() {
  const session = useAuthSession();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  async function signOut() {
    await entryRequests.run(async () => {
      setBusy(true); setError(undefined);
      try { await session.signOut(); }
      catch { setError('We could not finish signing out. Please retry.'); }
      finally { setBusy(false); }
    });
  }
  return <Page title="Your account" subtitle="Your profile and sign-in." back backTarget="/dashboard" headerBadge={<Badge label="Account" icon="shield" tone="brand" />}>
    <Card tone="brand"><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <IconCircle icon="user" size={48} /><View style={{ flex: 1, gap: 4 }}>
        <Copy variant="heading">{session.profile?.name ?? 'NoDebt account'}</Copy>
        {session.profile?.email && <Copy variant="caption">{session.profile.email}</Copy>}
      </View></View><Badge label="Signed in" icon="check-circle" tone="success" />
    </Card>
    <Section title="Your financial records"><Card><Copy variant="heading">Your guest ledger stays private</Copy>
      <Copy>Account financial tracking and cloud sync are not available yet. Signing in does not upload or merge your guest records.</Copy>
      <Copy variant="caption">To keep tracking locally, sign out, then choose Continue as Guest. Your saved records stay on this device.</Copy>
    </Card></Section>
    <Notice icon="shield">Signing out ends your account session. It does not delete your guest records.</Notice>
    <Problem message={error} />
    <Button label="Sign out" icon="log-out" secondary loading={busy} disabled={busy} onPress={() => { void signOut(); }} />
  </Page>;
}
