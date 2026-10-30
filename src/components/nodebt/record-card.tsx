import { router } from 'expo-router';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Badge, Copy, Icon, IconCircle, DesignReadOnlyContext } from './ui';
import { displayDate, recordTypeIcons } from './format';
import { selectRecord, statusLabels, directionLabel } from '@/features/guest/selectors';
import { formatMoney } from '@/domain/money';
import { font } from '@/design/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useContext } from 'react';
import type { GuestRecord, GuestSnapshot } from '@/storage/models';
export function RecordCard({ record, snapshot, today }: { record: GuestRecord; snapshot: GuestSnapshot; today: string }) {
  const detail = selectRecord(snapshot, record.id, today)!;
  const theme = useTheme(), { fontScale } = useWindowDimensions(), readOnly = useContext(DesignReadOnlyContext);
  const overdue = !record.closedOn && detail.schedule.installments.some((row) => row.remainingMinor > 0 && row.dueOn < today);
  const label = record.closedOn ? 'Closed' : statusLabels[detail.ledger.status];
  return <Pressable accessibilityRole="button" accessibilityLabel={`${record.title}, ${directionLabel(record.direction)}, ${formatMoney(detail.ledger.outstandingMinor, record.currency)}, ${label}`}
    disabled={readOnly} onPress={() => router.push({ pathname: '/record/[id]', params: { id: record.id } })}
    style={({ pressed }) => ({ borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundElement, borderRadius: 16, padding: 16, gap: 12, opacity: pressed ? 0.7 : 1 })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconCircle icon={recordTypeIcons[record.kind]} tone={record.direction === 'borrowed' ? 'info' : 'brand'} />
      <View style={{ flex: 1, gap: 3 }}><Copy style={{ fontFamily: font.semibold }}>{record.title}</Copy><Copy variant="caption">{record.counterparty || detail.category.name}</Copy></View>
      {fontScale <= 1.25 && <Copy style={{ fontFamily: font.semibold, fontSize: 16, lineHeight: 23, maxWidth: '43%', flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{formatMoney(detail.ledger.outstandingMinor, record.currency)}</Copy>}
      <Icon name="chevron-right" size={16} color={theme.textSecondary} />
    </View>
    {fontScale > 1.25 && <Copy variant="heading">{formatMoney(detail.ledger.outstandingMinor, record.currency)}</Copy>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <Badge label={record.direction === 'borrowed' ? 'I owe' : 'Owed to me'} tone={record.direction === 'borrowed' ? 'info' : 'brand'} />
      <Badge label={record.archived ? 'Archived' : overdue ? 'Overdue' : label} tone={overdue ? 'danger' : detail.ledger.outstandingMinor === 0 ? 'success' : 'neutral'} />
    </View>
    <Copy variant="caption">{detail.category.name} · Since {displayDate(record.trackingStartedOn)}</Copy>
  </Pressable>;
}
