import { router } from 'expo-router';
import { Badge, Card, Copy, EmptyState, Grid, IconButton, LinkRow, Metric, Notice, Page, Section } from '@/components/nodebt/ui';
import { useAuthSession } from '@/features/auth/session';
/** Account identity only. Never mount a guest provider or read the local ledger. */
export default function Dashboard() {
  const { profile } = useAuthSession();
  return <Page title="Welcome back" subtitle={profile?.name ?? 'Your NoDebt account'} eyebrow="Your financial overview"
    headerBadge={<Badge label="Account" icon="shield" tone="brand" />}
    action={<IconButton icon="user" label="Your account" onPress={() => router.push('/account')} />}>
    <Grid><Metric label="Money you owe" value="—" icon="arrow-up-right" tone="danger" note="Not available yet" />
      <Metric label="Money owed to you" value="—" icon="arrow-down-left" note="Not available yet" /></Grid>
    <Card tone="brand"><Badge label="You're signed in" icon="check-circle" tone="success" />
      <Copy variant="heading">A clear view, all in one place</Copy>
      <Copy>Account financial tracking is coming next. Balances and records will appear here when it is ready.</Copy>
      <Copy variant="caption">Your guest records stay separate on this device. Nothing has been uploaded or moved.</Copy>
    </Card>
    <Section title="Recent activity"><EmptyState icon="clock" title="Account activity isn't available yet"
      description="When account tracking is ready, your latest updates will appear here." /></Section>
    <Notice icon="smartphone">Need your local records? Open Your account, sign out, then choose Continue as Guest.</Notice>
    <Card padded={false}><LinkRow title="Your account" subtitle="Profile, sign-in and privacy" icon="user" onPress={() => router.push('/account')} last /></Card>
  </Page>;
}
