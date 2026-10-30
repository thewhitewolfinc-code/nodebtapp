import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Badge, Button, Card, Confirmation, Copy, DataRow, Disclosure, EmptyState, Grid, IconCircle, Notice, Page, Problem, Row, Section, errorMessage } from '@/components/nodebt/ui';
import { formatMoney } from '@/domain/money';
import { ActivityList } from '@/features/guest/activity-list';
import { useGuest, useOperationId } from '@/features/guest/provider';
import { directionLabel, selectRecord, statusLabels } from '@/features/guest/selectors';
import { View } from 'react-native';
import { displayDate, recordTypeIcons, recordTypeNames } from '@/components/nodebt/format';
import type { GuestCommand } from '@/storage/models';

type RecordAction = Extract<GuestCommand, { type: 'record_action' }>['action'];
export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, today, busy, execute } = useGuest();
  const detail = selectRecord(snapshot, id, today);
  const [confirm, setConfirm] = useState<{ action: RecordAction; version: number }>();
  const [error, setError] = useState<string>();
  const operation = useOperationId();
  if (!detail) return <Page title="Record not found" back><EmptyState icon="file-text" title="Record unavailable" description="Open a record from your current guest ledger." /></Page>;
  const { record, ledger, category, schedule } = detail;
  async function perform() {
    if (!confirm) return;
    try {
      setError(undefined);
      await execute(operation.get(), { type: 'record_action', recordId: id, expectedVersion: confirm.version, action: confirm.action });
      operation.reset(); setConfirm(undefined);
    } catch (cause) { setError(errorMessage(cause)); }
  }
  const entry = (kind: string) => router.push({ pathname: '/record/[id]/entry', params: { id, kind } });
  const action = (value: RecordAction) => { setConfirm({ action: value, version: record.version }); setError(undefined); };
  return <Page title={record.title} eyebrow={directionLabel(record.direction)} subtitle={record.counterparty || category.name} back>
    <Card tone="brand"><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><IconCircle icon={recordTypeIcons[record.kind]} size={44} /><Row>
      <Badge label={record.closedOn ? 'Closed' : statusLabels[ledger.status]} tone={ledger.outstandingMinor === 0 ? 'success' : 'brand'} />{record.archived && <Badge label="Archived" />}</Row></View>
      <Copy variant="caption">Recorded outstanding</Copy><Copy variant="metric">{formatMoney(ledger.outstandingMinor, record.currency)}</Copy>
      <Copy variant="caption">{recordTypeNames[record.kind]} · Tracking since {displayDate(record.trackingStartedOn)}</Copy>
    </Card>
    <Card><DataRow label="Principal" value={formatMoney(ledger.principalMinor)} /><DataRow label="Unpaid interest" value={formatMoney(ledger.interestMinor)} /><DataRow label="Unpaid fees" value={formatMoney(ledger.feesMinor)} last /></Card>
    {!record.closedOn && <Button label={record.direction === 'borrowed' ? 'Record repayment' : 'Record collection'} icon="check-circle" disabled={busy} onPress={() => entry('payment')} />}
    <Section title="Record information"><Card>
      <DataRow label="Category" value={category.name} /><DataRow label="Interest agreement" value={record.interestMode === 'interest_free' ? 'Interest-free' : 'Recorded explicitly'} />
      {record.counterparty && <DataRow label="Person / institution" value={record.counterparty} />}
      <DataRow label={record.direction === 'borrowed' ? 'Actual cash repaid' : 'Actual cash collected'} value={formatMoney(ledger.cashPaidMinor)} />
      <DataRow label="Forgiven" value={formatMoney(ledger.forgivenMinor)} /><DataRow label="Written off" value={formatMoney(ledger.writtenOffMinor)} last />
      {category.archived && <Notice tone="warning">This category is archived. Its assignment and history are retained.</Notice>}
      <Button label="Change category" icon="grid" secondary disabled={busy} onPress={() => router.push({ pathname: '/categories', params: { direction: record.direction, recordId: id } })} />
    </Card></Section>
    {!record.closedOn && <Disclosure title="More financial actions" subtitle="Additional borrowing, charges, adjustments and settlement">
      <Button label={record.direction === 'borrowed' ? 'Additional borrowing / card charge' : 'Additional lending'} icon="plus-circle" secondary disabled={busy} onPress={() => entry('advance')} />
      <Button label="Balance adjustment" icon="sliders" secondary disabled={busy} onPress={() => entry('adjustment')} />
      <Grid>{record.interestMode === 'manual_interest' && <Button label="Interest charge" secondary disabled={busy} onPress={() => entry('interest_charge')} />}<Button label="Fee charge" secondary disabled={busy} onPress={() => entry('fee_charge')} /></Grid>
      <Button label={record.direction === 'borrowed' ? 'Forgive an amount' : 'Write off an amount'} secondary disabled={busy} onPress={() => entry(record.direction === 'borrowed' ? 'forgiveness' : 'write_off')} />
      <Button label="Record partial settlement" secondary disabled={busy} onPress={() => entry('settlement')} />
      <Notice icon="info">Forgiveness and write-offs remain separate from actual cash payments.</Notice>
    </Disclosure>}
    <Disclosure title="Manage this record" subtitle="Close, archive or reopen without losing history">
      {!record.closedOn && <><Button label="Close zero-balance record" icon="check" secondary disabled={busy || ledger.outstandingMinor !== 0} onPress={() => action('close')} /><Copy variant="caption">Closure requires a zero recorded balance.</Copy></>}
      {record.closedOn && <Button label="Reopen record" icon="rotate-ccw" secondary disabled={busy} onPress={() => action('reopen')} />}
      <Button label={record.archived ? 'Unarchive record' : 'Archive record'} icon="archive" secondary disabled={busy} onPress={() => action(record.archived ? 'unarchive' : 'archive')} />
      <Copy variant="caption">Archiving changes visibility. Any outstanding balance stays in your totals.</Copy>
    </Disclosure>
    <Confirmation visible={!!confirm} title={confirm ? `Confirm ${confirm.action}` : 'Confirm change'} description="The record identity and financial history will be preserved."
      busy={busy} confirmLabel={confirm ? `Confirm ${confirm.action}` : 'Confirm'} onConfirm={() => { void perform(); }} onCancel={() => setConfirm(undefined)}><Problem message={error} /></Confirmation>
    {!confirm && <Problem message={error} />}
    <Section title="Scheduled installments" subtitle={record.closedOn || ledger.status !== 'active' ? 'Historical schedule · Waived amounts are not cash payments' : 'Payment and collection dates from your entered agreement'}>
      {schedule.installments.length === 0 ? <Card><Copy variant="caption">No schedule entered for this record.</Copy></Card> : schedule.installments.map((installment) => <Card key={installment.id}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><Copy style={{ flex: 1 }}>{displayDate(installment.dueOn)}</Copy><Badge label={record.closedOn || ledger.status !== 'active' ? 'Historical' : installment.status.replaceAll('_', ' ')} tone={!record.closedOn && ledger.status === 'active' && installment.dueOn < today && installment.remainingMinor > 0 ? 'danger' : 'neutral'} /></View>
        <Copy variant="heading">{formatMoney(installment.amountMinor)}</Copy><DataRow label="Cash applied" value={formatMoney(installment.paidMinor)} /><DataRow label={record.closedOn || ledger.status !== 'active' ? 'Unpaid in original schedule' : 'Remaining'} value={formatMoney(installment.remainingMinor)} last />
      </Card>)}
      {schedule.principalPrepaidMinor > 0 && <Notice>Principal-only prepayments: {formatMoney(schedule.principalPrepaidMinor)}. Contracted installments remain separate.</Notice>}
      {schedule.unallocatedCashMinor > 0 && <Notice>Cash not assigned to the schedule, including separate fees: {formatMoney(schedule.unallocatedCashMinor)}.</Notice>}
    </Section>
    <Section title="Transactions & revisions" subtitle="A complete, preserved history"><ActivityList recordId={id} /></Section>
    <Disclosure title="Record lifecycle" subtitle="Every status change, in order">
      {snapshot.recordEvents.filter((event) => event.recordId === id).sort((a, b) => b.version - a.version).map((event) => <Card key={event.id}>
        <Badge label={`Version ${event.version}`} /><Copy>{event.kind.replaceAll('_', ' ')}</Copy><Copy variant="caption">{event.recordedAt}</Copy>
      </Card>)}
    </Disclosure>
  </Page>;
}
