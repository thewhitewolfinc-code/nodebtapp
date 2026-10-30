import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge, Button, Card, Copy, EmptyState, IconCircle } from '@/components/nodebt/ui';
import { displayDate } from '@/components/nodebt/format';
import { font } from '@/design/tokens';
import { formatMoney } from '@/domain/money';
import { entryTotal } from '@/domain/ledger';
import { useGuest } from './provider';
import { entryLabel, selectActivity } from './selectors';
export function ActivityList({ recordId, filter = 'all' }: { recordId?: string; filter?: 'all' | 'payments' | 'revisions' }) {
  const { snapshot } = useGuest();
  const rows = selectActivity(snapshot, recordId).filter(({ entry }) => filter === 'all' || (filter === 'payments' ? entry.kind === 'payment' : entry.revision > 1));
  return rows.length === 0 ? <EmptyState icon="activity" title="No activity to show" description={filter === 'all' ? 'Opening balances, payments, collections and every correction appear here as you use your ledger.' : 'There are no entries matching this filter.'} /> : rows.map(({ entry, record, isCurrent }) =>
    <Card key={entry.revisionId}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconCircle icon={entry.kind === 'payment' ? 'check' : entry.kind === 'opening_balance' ? 'file-text' : 'edit-3'} tone={entry.state === 'void' ? 'warning' : 'brand'} />
        <View style={{ flex: 1, gap: 3 }}><Copy style={{ fontFamily: font.semibold }}>{entryLabel(entry.kind, record.direction)}</Copy><Copy variant="caption">{record.title} · {displayDate(entry.effectiveOn)}</Copy></View>
      </View>
      <Copy variant="heading" style={{ fontVariant: ['tabular-nums'] }}>{formatMoney(entryTotal(entry), record.currency)}</Copy>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}><Badge label={`Revision ${entry.revision}`} /><Badge label={isCurrent ? entry.state === 'void' ? 'Voided' : 'Current' : 'Superseded'} tone={entry.state === 'void' ? 'warning' : isCurrent ? 'success' : 'neutral'} /></View>
      <Copy variant="caption">Principal {formatMoney(entry.principalMinor)} · Interest {formatMoney(entry.interestMinor)} · Fees {formatMoney(entry.feesMinor)}</Copy>
      {entry.reason && <Copy>{entry.reason}</Copy>}
      <Copy variant="caption">Recorded {entry.recordedAt}</Copy>
      {!isCurrent && <Copy variant="caption">Preserved in your financial history.</Copy>}
      {!recordId && <Button label="View record history" icon="arrow-up-right" secondary onPress={() => router.push({ pathname: '/record/[id]', params: { id: record.id } })} />}
      {isCurrent && !record.closedOn && <Button label={entry.state === 'void' ? 'Restore or correct entry' : 'Correct entry'} icon="edit-2" secondary
        onPress={() => router.push({ pathname: '/record/[id]/entry', params: { id: record.id, entryId: entry.id } })} />}
    </Card>);
}
