import { router } from 'expo-router';
import { useAuthSession } from '@/features/auth/session';
import { View } from 'react-native';
import { Badge, Button, Card, Copy, Grid, IconButton, IconCircle, Metric, Notice, Page, Row, Section } from '@/components/nodebt/ui';
import { RecordCard } from '@/components/nodebt/record-card';
import { displayDate } from '@/components/nodebt/format';
import { formatMoney } from '@/domain/money';
import { useGuest } from '@/features/guest/provider';
import { directionLabel, selectDashboard } from '@/features/guest/selectors';

export default function Home() {
  const { snapshot, today } = useGuest();
  const session = useAuthSession();
  const summary = selectDashboard(snapshot, today);
  const metricColumns = [summary.owedMinor, summary.receivableMinor, summary.repaidMinor, summary.collectedMinor].some((value) => formatMoney(value).length > 13) ? 1 : 2;
  const active = snapshot.records.filter((record) => !record.archived);
  return <Page title="Overview" subtitle="What you owe. What you are owed."
    action={<IconButton icon="plus" label="Add a record" onPress={() => router.push('/record/new')} />}>
    {session.state === 'guest-offline' && <Notice icon="wifi-off">Your saved guest workspace is open. Google sign-in will be available after your connection is checked.</Notice>}
    <Grid columns={metricColumns}><Metric label="Money I Owe" value={formatMoney(summary.owedMinor)} icon="arrow-up-right" tone="danger" note="Outstanding borrowing" />
      <Metric label="Money Owed to Me" value={formatMoney(summary.receivableMinor)} icon="arrow-down-left" note="Outstanding lending" /></Grid>
    <Notice icon="shield" tone="brand">Your borrowing and lending stay separate. Expected collections are not available repayment cash.</Notice>
    {summary.recordCount > 0 && <Row><Button label="Add borrowing" icon="plus" onPress={() => router.push({ pathname: '/record/new', params: { direction: 'borrowed' } })} />
      <Button label="Add lending" icon="plus" secondary onPress={() => router.push({ pathname: '/record/new', params: { direction: 'lent' } })} /></Row>}
    {summary.recordCount === 0 && <Card><View style={{ flexDirection: 'row', gap: 12 }}><IconCircle icon="layers" /><View style={{ flex: 1, gap: 4 }}><Copy variant="heading">Start with one record</Copy><Copy variant="caption">Add your outstanding borrowing or lending balance.</Copy></View></View><Button label="Add your first record" icon="plus" onPress={() => router.push('/record/new')} /></Card>}
    <Section title="Upcoming & overdue" subtitle="Your entered payment and collection schedules" action={<Badge label={`${summary.due.length} due`} tone={summary.due.length ? 'warning' : 'neutral'} />}>
      {summary.due.length === 0 ? <Card><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconCircle icon="calendar" /><View style={{ flex: 1, gap: 4 }}><Copy>No unpaid installments</Copy><Copy variant="caption">Scheduled payments and collections will appear here.</Copy></View></View></Card> : summary.due.slice(0, 6).map((due) =>
        <Card key={`${due.record.id}:${due.dueOn}`}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1, gap: 4 }}><Copy variant="heading">{due.record.title}</Copy><Copy variant="caption">{directionLabel(due.record.direction)}</Copy></View><Badge label={due.dueOn < today ? 'Overdue' : 'Upcoming'} tone={due.dueOn < today ? 'danger' : 'brand'} /></View>
          <Copy variant="heading">{formatMoney(due.remainingMinor, due.record.currency)}</Copy><Copy variant="caption">Due {displayDate(due.dueOn)} · {due.status.replaceAll('_', ' ')}</Copy>
          <Button label="Open record" secondary icon="arrow-up-right" onPress={() => router.push({ pathname: '/record/[id]', params: { id: due.record.id } })} />
        </Card>)}
    </Section>
    {active.length > 0 && <Section title="Recent records" subtitle="Your four most recently added, unarchived records" action={<Button label="View all" secondary onPress={() => router.push('/records')} />}>
      {active.slice(-4).reverse().map((record) => <RecordCard key={record.id} record={record} snapshot={snapshot} today={today} />)}
    </Section>}
    <Copy variant="caption">Totals include archived outstanding records. No earlier repayment history is assumed.</Copy>
  </Page>;
}
