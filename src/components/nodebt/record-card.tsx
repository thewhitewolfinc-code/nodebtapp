import { router } from 'expo-router';
import { Button, Card, Copy } from './ui';
import { directionLabel, selectRecord, statusLabels } from '@/features/guest/selectors';
import { formatMoney } from '@/domain/money';
import type { GuestRecord, GuestSnapshot } from '@/storage/models';

export function RecordCard({ record, snapshot, today }: { record: GuestRecord; snapshot: GuestSnapshot; today: string }) {
  const detail = selectRecord(snapshot, record.id, today)!;
  return <Card>
    <Copy variant="caption">{directionLabel(record.direction)}{record.archived ? ' · Archived' : ''}</Copy>
    <Copy variant="heading">{record.title}</Copy>
    <Copy>{formatMoney(detail.ledger.outstandingMinor, record.currency)}</Copy>
    <Copy variant="caption">{detail.category.name} · {record.closedOn ? 'Closed' : statusLabels[detail.ledger.status]}</Copy>
    <Button label={`View ${record.title}`} secondary onPress={() => router.push({ pathname: '/record/[id]', params: { id: record.id } })} />
  </Card>;
}