import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Copy, Page, Problem, errorMessage } from '@/components/nodebt/ui';
import { useGuest, useOperationId } from '@/features/guest/provider';

export default function Welcome() {
  const { execute, busy } = useGuest();
  const operation = useOperationId();
  const [error, setError] = useState<string>();
  async function begin(add: boolean) {
    try {
      setError(undefined);
      await execute(operation.get(), { type: 'onboard' });
      router.replace(add ? '/record/new' : '/home');
    } catch (cause) { setError(errorMessage(cause)); }
  }
  return <Page title="Welcome to Nodebt" subtitle="Know what you owe. Track what you’re owed.">
    <Card><Copy variant="heading">Start with one record</Copy><Copy>Track a formal loan, money borrowed from a friend, or money you have lent. Repayments and collections stay separate.</Copy></Card>
    <Card><Copy variant="heading">Your private guest ledger</Copy><Copy>Your records stay in encrypted storage on this device and work offline. Guest data cannot yet be recovered from another device. Keep this installation until backup and cloud recovery are available.</Copy></Card>
    <Problem message={error} />
    <Button label={busy ? 'Saving…' : 'Continue as guest · Add a record'} disabled={busy} onPress={() => { void begin(true); }} />
    <Button label="Skip setup and open Home" secondary disabled={busy} onPress={() => { void begin(false); }} />
    <Copy variant="caption">Account sign-in will be added in the cloud milestone. No account is needed for guest tracking.</Copy>
  </Page>;
}