import { Card, Copy, Page } from '@/components/nodebt/ui';
import { formatMoney } from '@/domain/money';
import { useGuest } from '@/features/guest/provider';
import { selectDashboard } from '@/features/guest/selectors';
export default function Insights() {
  const { snapshot, today } = useGuest();
  const summary = selectDashboard(snapshot, today);
  return <Page title="Insights" subtitle="Recorded facts from your ledger">
    <Card><Copy variant="heading">Outstanding borrowing</Copy><Copy>{formatMoney(summary.owedMinor)}</Copy></Card>
    <Card><Copy variant="heading">Outstanding lending</Copy><Copy>{formatMoney(summary.receivableMinor)}</Copy></Card>
    <Card><Copy variant="heading">Actual cash repaid since tracking began</Copy><Copy>{formatMoney(summary.repaidMinor)}</Copy></Card>
    <Card><Copy variant="heading">Actual cash collected since tracking began</Copy><Copy>{formatMoney(summary.collectedMinor)}</Copy></Card>
    <Copy variant="caption">Forgiveness, write-offs and balance corrections are not cash payments or collections. Opening balances do not invent earlier repayment history.</Copy>
    <Card><Copy variant="heading">Payoff planning comes later</Copy><Copy>Snowball, Avalanche, Consolidation and Balance Transfer will be added after the guest ledger is verified. These summaries do not forecast interest or payoff dates.</Copy></Card>
  </Page>;
}