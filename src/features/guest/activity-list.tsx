import { router } from 'expo-router';
import { Button, Card, Copy } from '@/components/nodebt/ui';
import { formatMoney } from '@/domain/money';
import { entryTotal } from '@/domain/ledger';
import { useGuest } from './provider';
import { entryLabel, selectActivity } from './selectors';

export function ActivityList({ recordId }: { recordId?: string }) {
  const { snapshot } = useGuest();
  const rows = selectActivity(snapshot, recordId);
  return rows.length === 0 ? <Copy variant="caption">No recorded activity yet.</Copy> : rows.map(({ entry, record, isCurrent }) =>
    <Card key={entry.revisionId}>
      <Copy variant="heading">{entryLabel(entry.kind, record.direction)}</Copy><Copy>{record.title}</Copy>
      <Copy>{formatMoney(entryTotal(entry), record.currency)} · {entry.effectiveOn}</Copy>
      <Copy variant="caption">Principal {formatMoney(entry.principalMinor)} · Interest {formatMoney(entry.interestMinor)} · Fees {formatMoney(entry.feesMinor)}</Copy>
      <Copy variant="caption">Revision {entry.revision} · {isCurrent ? entry.state === 'void' ? 'Voided' : 'Current' : 'Superseded · preserved in history'}</Copy>
      {entry.reason && <Copy variant="caption">{entry.reason}</Copy>}
      <Copy variant="caption">Recorded {entry.recordedAt}</Copy>
      {!recordId && <Button label="View record history" secondary onPress={() => router.push({ pathname: '/record/[id]', params: { id: record.id } })} />}
      {isCurrent && !record.closedOn && <Button label={entry.state === 'void' ? 'Restore or correct entry' : 'Correct entry'} secondary
        onPress={() => router.push({ pathname: '/record/[id]/entry', params: { id: record.id, entryId: entry.id } })} />}
    </Card>);
}