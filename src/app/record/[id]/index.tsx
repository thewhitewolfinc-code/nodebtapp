import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Copy, Page, Problem, Row, errorMessage } from '@/components/nodebt/ui';
import { formatMoney } from '@/domain/money';
import { ActivityList } from '@/features/guest/activity-list';
import { useGuest, useOperationId } from '@/features/guest/provider';
import { directionLabel, selectRecord, statusLabels } from '@/features/guest/selectors';
import type { GuestCommand } from '@/storage/models';

type RecordAction = Extract<GuestCommand, { type: 'record_action' }>['action'];
export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, today, busy, execute } = useGuest();
  const detail = selectRecord(snapshot, id, today);
  const [confirm, setConfirm] = useState<{ action: RecordAction; version: number }>();
  const [error, setError] = useState<string>();
  const operation = useOperationId();
  if (!detail) return <Page title="Record not found" back><Copy>This record is not available in the current guest ledger.</Copy></Page>;
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
  return <Page title={record.title} subtitle={`${directionLabel(record.direction)} · ${record.closedOn ? 'Closed' : statusLabels[ledger.status]}${record.archived ? ' · Archived' : ''}`} back>
    <Card><Copy variant="caption">Recorded outstanding</Copy><Copy variant="title">{formatMoney(ledger.outstandingMinor, record.currency)}</Copy>
      <Copy>Principal {formatMoney(ledger.principalMinor)}</Copy><Copy>Interest {formatMoney(ledger.interestMinor)}</Copy><Copy>Fees {formatMoney(ledger.feesMinor)}</Copy>
    </Card>
    <Card><Copy>{category.name}{category.archived ? ' · Category archived; assignment retained' : ''}</Copy>
      {record.counterparty && <Copy>Person / institution: {record.counterparty}</Copy>}
      <Copy variant="caption">{record.kind.replaceAll('_', ' ')} · {record.interestMode === 'interest_free' ? 'Interest-free' : 'Interest recorded explicitly'} · Tracking from {record.trackingStartedOn}</Copy>
      <Copy variant="caption">Actual {record.direction === 'borrowed' ? 'cash repaid' : 'cash collected'}: {formatMoney(ledger.cashPaidMinor)}</Copy>
      <Copy variant="caption">Forgiven: {formatMoney(ledger.forgivenMinor)} · Written off: {formatMoney(ledger.writtenOffMinor)}</Copy>
      <Button label="Change category" secondary disabled={busy} onPress={() => router.push({ pathname: '/categories', params: { direction: record.direction, recordId: id } })} />
    </Card>
    {!record.closedOn && <>
      <Button label={record.direction === 'borrowed' ? 'Record repayment' : 'Record collection'} disabled={busy} onPress={() => entry('payment')} />
      <Row><Button label={record.direction === 'borrowed' ? 'Additional borrowing / card charge' : 'Additional lending'} secondary disabled={busy} onPress={() => entry('advance')} />
        <Button label="Balance adjustment" secondary disabled={busy} onPress={() => entry('adjustment')} /></Row>
      <Row>{record.interestMode === 'manual_interest' && <Button label="Interest charge" secondary disabled={busy} onPress={() => entry('interest_charge')} />}
        <Button label="Fee charge" secondary disabled={busy} onPress={() => entry('fee_charge')} /></Row>
      <Row><Button label={record.direction === 'borrowed' ? 'Forgive an amount' : 'Write off an amount'} secondary disabled={busy}
        onPress={() => entry(record.direction === 'borrowed' ? 'forgiveness' : 'write_off')} />
        <Button label="Record partial settlement" secondary disabled={busy} onPress={() => entry('settlement')} /></Row>
      <Button label="Close zero-balance record" secondary disabled={busy || ledger.outstandingMinor !== 0} onPress={() => action('close')} />
      <Copy variant="caption">Closure requires a zero recorded balance. Forgiveness and write-offs are never counted as actual payments.</Copy>
    </>}
    <Row>{record.closedOn && <Button label="Reopen record" secondary disabled={busy} onPress={() => action('reopen')} />}
      <Button label={record.archived ? 'Unarchive record' : 'Archive record'} secondary disabled={busy} onPress={() => action(record.archived ? 'unarchive' : 'archive')} /></Row>
    <Copy variant="caption">Archiving only changes visibility. Any outstanding balance remains included in your totals.</Copy>
    {confirm && <Card><Copy variant="heading">Confirm {confirm.action}</Copy><Copy>The record identity and financial history will be preserved.</Copy>
      <Button label={busy ? 'Saving…' : `Confirm ${confirm.action}`} disabled={busy} onPress={() => { void perform(); }} />
      <Button label="Cancel" secondary disabled={busy} onPress={() => setConfirm(undefined)} /></Card>}
    <Problem message={error} />
    <Copy variant="heading">Scheduled installments</Copy>
    {(record.closedOn || ledger.status !== 'active') && <Copy variant="caption">Historical schedule shown below. A settlement does not turn waived installments into cash payments.</Copy>}
    {schedule.installments.length === 0 ? <Copy variant="caption">No schedule entered.</Copy> : schedule.installments.map((installment) =>
      <Card key={installment.id}><Copy>{installment.dueOn} · Scheduled {formatMoney(installment.amountMinor)}</Copy>
        <Copy variant="caption">Cash applied {formatMoney(installment.paidMinor)} · {record.closedOn || ledger.status !== 'active' ? 'Unpaid in original schedule' : installment.status.replaceAll('_', ' ')}: {formatMoney(installment.remainingMinor)}</Copy></Card>)}
    {schedule.principalPrepaidMinor > 0 && <Copy variant="caption">Principal-only prepayments: {formatMoney(schedule.principalPrepaidMinor)}. Contracted installments remain separate.</Copy>}
    {schedule.unallocatedCashMinor > 0 && <Copy variant="caption">Cash not assigned to the schedule (including separate fees): {formatMoney(schedule.unallocatedCashMinor)}</Copy>}
    <Copy variant="heading">Transactions and revisions</Copy><ActivityList recordId={id} />
    <Copy variant="heading">Record lifecycle</Copy>
    {snapshot.recordEvents.filter((event) => event.recordId === id).sort((a, b) => b.version - a.version).map((event) =>
      <Copy key={event.id} variant="caption">v{event.version} · {event.kind.replaceAll('_', ' ')} · {event.recordedAt}</Copy>)}
  </Page>;
}