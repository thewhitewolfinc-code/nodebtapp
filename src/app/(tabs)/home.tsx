import { router } from 'expo-router';
import { Button, Card, Copy, Page, Row } from '@/components/nodebt/ui';
import { RecordCard } from '@/components/nodebt/record-card';
import { formatMoney } from '@/domain/money';
import { useGuest } from '@/features/guest/provider';
import { directionLabel, selectDashboard } from '@/features/guest/selectors';

export default function Home() {
  const { snapshot, today } = useGuest();
  const summary = selectDashboard(snapshot, today);
  return <Page title="Your money, clearly" subtitle="Private guest ledger · Stored on this device">
    <Card><Copy variant="caption">Money I Owe</Copy><Copy variant="title">{formatMoney(summary.owedMinor)}</Copy></Card>
    <Card><Copy variant="caption">Money Owed to Me</Copy><Copy variant="title">{formatMoney(summary.receivableMinor)}</Copy>
      <Copy variant="caption">Expected collections are not available repayment cash.</Copy></Card>
    <Row><Button label="Add Money I Owe" onPress={() => router.push({ pathname: '/record/new', params: { direction: 'borrowed' } })} />
      <Button label="Add Money Owed to Me" secondary onPress={() => router.push({ pathname: '/record/new', params: { direction: 'lent' } })} /></Row>
    {summary.recordCount === 0 ? <Card><Copy variant="heading">Start with one record</Copy><Copy>Add today’s outstanding balance. You do not need to recreate old repayments.</Copy></Card> : <Copy variant="caption">Totals include archived outstanding records. Borrowing and lending are never netted together.</Copy>}
    <Copy variant="heading">Upcoming and overdue</Copy>
    {summary.due.length === 0 ? <Copy variant="caption">No unpaid scheduled installments to show.</Copy> : summary.due.slice(0, 6).map((due) =>
      <Card key={`${due.record.id}:${due.dueOn}`}><Copy>{due.record.title}</Copy>
        <Copy>{formatMoney(due.remainingMinor, due.record.currency)} · {due.dueOn}</Copy>
        <Copy variant="caption">{directionLabel(due.record.direction)} · {due.status.replaceAll('_', ' ')}</Copy>
        <Button label="Open record" secondary onPress={() => router.push({ pathname: '/record/[id]', params: { id: due.record.id } })} />
      </Card>)}
    <Copy variant="heading">Records</Copy>
    {snapshot.records.filter((record) => !record.archived).slice(-4).reverse().map((record) =>
      <RecordCard key={record.id} record={record} snapshot={snapshot} today={today} />)}
  </Page>;
}