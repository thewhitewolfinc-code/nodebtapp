import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Copy, EmptyState, Grid, IconCircle, Metric, Notice, Page, Section, Segments } from '@/components/nodebt/ui';
import { formatMoney, addMoney } from '@/domain/money';
import type { Direction } from '@/domain/ledger';
import { font } from '@/design/tokens';
import { useGuest } from '@/features/guest/provider';
import { selectDashboard, selectRecord } from '@/features/guest/selectors';
import { useTheme } from '@/hooks/use-theme';
export default function Insights() {
  const { snapshot, today } = useGuest(), theme = useTheme();
  const summary = selectDashboard(snapshot, today);
  const metricColumns = [summary.owedMinor, summary.receivableMinor, summary.repaidMinor, summary.collectedMinor].some((value) => formatMoney(value).length > 13) ? 1 : 2;
  const [direction, setDirection] = useState<Direction>('borrowed'), [showAll, setShowAll] = useState(false);
  const byCategory = new Map<string, number>();
  for (const record of snapshot.records.filter((row) => row.direction === direction)) {
    const amount = selectRecord(snapshot, record.id, today)!.ledger.outstandingMinor;
    byCategory.set(record.categoryId, addMoney(byCategory.get(record.categoryId) ?? 0, amount));
  }
  const breakdown = [...byCategory].filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
  const total = direction === 'borrowed' ? summary.owedMinor : summary.receivableMinor;
  return <Page title="Insights" subtitle="Recorded facts. Clearer decisions.">
    <Grid columns={metricColumns}><Metric label="Outstanding borrowing" value={formatMoney(summary.owedMinor)} icon="arrow-up-right" tone="danger" />
      <Metric label="Outstanding lending" value={formatMoney(summary.receivableMinor)} icon="arrow-down-left" /></Grid>
    <Section title="Balance breakdown" subtitle="Current outstanding balance, grouped by category">
      <Segments value={direction} onChange={(value) => { setDirection(value); setShowAll(false); }} options={[{ value: 'borrowed', label: 'I owe' }, { value: 'lent', label: 'Owed to me' }]} />
      {breakdown.length === 0 ? <EmptyState icon="pie-chart" title="A clearer view starts with a record" description="Your category breakdown appears when you have an outstanding balance to track." /> : <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconCircle icon="pie-chart" /><View style={{ flex: 1 }}><Copy variant="caption">{direction === 'borrowed' ? 'Outstanding borrowing' : 'Outstanding lending'}</Copy><Copy variant="heading">{formatMoney(total)}</Copy></View><Badge label={`${breakdown.length} categories`} /></View>
        {(showAll ? breakdown : breakdown.slice(0, 5)).map(([categoryId, amount]) => <View key={categoryId} style={{ gap: 8, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Copy style={{ flex: 1 }}>{snapshot.categories.find((row) => row.id === categoryId)?.name ?? 'Uncategorised'}</Copy><Copy style={{ fontFamily: font.semibold }}>{formatMoney(amount)}</Copy></View>
          <View accessibilityLabel={`${Math.round(amount / total * 100)} percent of the selected outstanding balance`} style={{ height: 8, borderRadius: 8, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}><View style={{ height: '100%', width: `${amount / total * 100}%`, borderRadius: 8, backgroundColor: theme.brand }} /></View>
        </View>)}
        {breakdown.length > 5 && <Button label={showAll ? 'Show fewer categories' : 'Show all categories'} secondary onPress={() => setShowAll(!showAll)} />}
      </Card>}
    </Section>
    <Section title="Actual cash movement" subtitle="Since you started tracking. Opening balances are excluded.">
      <Grid columns={metricColumns}><Metric label="Cash repaid" value={formatMoney(summary.repaidMinor)} icon="arrow-up-right" note="Borrowing repayments" />
        <Metric label="Cash collected" value={formatMoney(summary.collectedMinor)} icon="arrow-down-left" note="Lending collections" /></Grid>
    </Section>
    <Notice tone="brand" icon="check-circle">Forgiveness, write-offs and balance corrections are kept separate from actual cash payments and collections.</Notice>
    <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconCircle icon="target" /><View style={{ flex: 1, gap: 4 }}><Copy variant="heading">A foundation for your next step</Copy><Badge label="Planning · Not available yet" /></View></View>
      <Copy variant="caption">Payoff tools will follow the verified ledger. These summaries do not forecast interest or payoff dates.</Copy></Card>
  </Page>;
}
