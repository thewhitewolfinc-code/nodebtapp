import { useEffect, useState } from 'react';
import { Badge, Button, Card, Copy, LoadingState, Page, Problem } from '@/components/nodebt/ui';
import { useAuthSession } from './session';
import { entryRequests } from './flow';
export function SessionStartup() {
  const session = useAuthSession();
  const [slow, setSlow] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(timer); }, []);
  return <Page title="Opening NoDebt" subtitle="Keeping your account and guest workspace separate." headerBadge={<Badge label="Private access" icon="shield" tone="brand" />}>
    <LoadingState title="Checking your session" description="Waiting for a secure session check." />
    <Problem message={error ?? session.problem} />
    {(slow || session.problem) && <Card><Copy variant="heading">Taking longer than expected</Copy>
      <Copy>Check your connection and retry. Your saved records stay on this device.</Copy>
      <Button label="Retry connection" secondary loading={retrying} onPress={() => {
        setRetrying(true); setError(undefined); void session.retry().catch(() => setError('Please close and reopen NoDebt to retry your connection.')).finally(() => setRetrying(false));
      }} />
      {session.canReturnToEntry && <><Copy variant="caption">You can also sign out to return to Welcome. Your guest records stay separate.</Copy>
        <Button label="Sign out and return to Welcome" secondary disabled={retrying} onPress={() => {
          void entryRequests.run(async () => {
            setRetrying(true); setError(undefined);
            try { await session.signOut(); } catch { setError('Please reconnect to finish signing out, then retry.'); }
            finally { setRetrying(false); }
          });
        }} /></>}
      {session.canRecoverGuest && <Button label="Open saved guest workspace" icon="smartphone" onPress={session.recoverGuest} />}
    </Card>}
  </Page>;
}
