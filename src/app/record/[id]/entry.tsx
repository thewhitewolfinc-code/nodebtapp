import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Button, Card, Copy, Field, Page, Problem, Toggle, errorMessage } from '@/components/nodebt/ui';
import { launch } from '@/config/product';
import type { EntryKind } from '@/domain/ledger';
import { formatMoney } from '@/domain/money';
import { amountInput, parseAmount } from '@/features/guest/forms';
import { useGuest, useOperationId } from '@/features/guest/provider';
import { entryLabel, selectRecord } from '@/features/guest/selectors';
import type { GuestCommand } from '@/storage/models';

export default function EntryForm() {
  const params = useLocalSearchParams<{ id: string; kind?: string; entryId?: string }>();
  const { snapshot, busy, execute, today } = useGuest();
  const detail = selectRecord(snapshot, params.id, today);
  const prior = detail?.history.filter((entry) => entry.id === params.entryId).sort((a, b) => b.revision - a.revision)[0];
  const kind = prior?.kind ?? params.kind ?? 'payment';
  const kinds: string[] = ['payment', 'advance', 'adjustment', 'interest_charge', 'fee_charge', 'forgiveness', 'write_off', 'settlement'];
  const initialVersion = useRef(detail?.record.version);
  const initialParent = useRef(prior?.revisionId);
  const wholeBalance = kind === 'forgiveness' || kind === 'write_off';
  const [principal, setPrincipal] = useState(() => amountInput(prior?.principalMinor ?? (wholeBalance ? detail?.ledger.principalMinor ?? 0 : 0)));
  const [interest, setInterest] = useState(() => amountInput(prior?.interestMinor ?? (wholeBalance ? detail?.ledger.interestMinor ?? 0 : 0)));
  const [fees, setFees] = useState(() => amountInput(prior?.feesMinor ?? (wholeBalance ? detail?.ledger.feesMinor ?? 0 : 0)));
  const [waivedPrincipal, setWaivedPrincipal] = useState('0.00');
  const [waivedInterest, setWaivedInterest] = useState('0.00');
  const [waivedFees, setWaivedFees] = useState('0.00');
  const [effectiveOn, setEffectiveOn] = useState(prior?.effectiveOn ?? today);
  const [reason, setReason] = useState('');
  const [principalOnly, setPrincipalOnly] = useState(prior?.paymentMode === 'principal_only');
  const [recognizeCharges, setRecognizeCharges] = useState(false);
  const [newInterest, setNewInterest] = useState('0.00');
  const [newFees, setNewFees] = useState('0.00');
  const [prepared, setPrepared] = useState<GuestCommand>();
  const [error, setError] = useState<string>();
  const operation = useOperationId();
  if (!detail || (params.entryId && !prior)) return <Page title="Entry not found" back><Copy>Open this transaction from its record history.</Copy></Page>;
  if (!prior && !kinds.includes(kind)) return <Page title="Unsupported entry" back><Copy>Choose a financial action from the record.</Copy></Page>;
  const { record, ledger } = detail;
  const title = prior ? `Correct ${entryLabel(prior.kind, record.direction)}` : kind === 'settlement' ? 'Record partial settlement' : entryLabel(kind as EntryKind, record.direction);
  const signed = kind === 'adjustment';
  const showPrincipal = !['interest_charge', 'fee_charge'].includes(kind);
  const showInterest = record.interestMode === 'manual_interest' && !['advance', 'fee_charge'].includes(kind) && !principalOnly;
  const showFees = !['advance', 'interest_charge'].includes(kind) && !principalOnly;
  function review(state: 'posted' | 'void' = 'posted') {
    try {
      setError(undefined);
      const amounts = { principalMinor: parseAmount(principal, signed, true), interestMinor: parseAmount(interest, signed, true), feesMinor: parseAmount(fees, signed, true) };
      const requiresReason = !!prior || ['adjustment', 'forgiveness', 'write_off', 'settlement'].includes(kind);
      if (requiresReason && !reason.trim()) throw new Error('Enter a reason that will be preserved with this financial change.');
      const common = { recordId: record.id, expectedVersion: initialVersion.current!, effectiveOn, components: amounts, reason };
      if (prior) setPrepared({ ...common, type: 'correct_entry', entryId: prior.id, expectedRevisionId: initialParent.current!,
        state, paymentMode: prior.kind === 'payment' ? principalOnly ? 'principal_only' : 'installment' : undefined });
      else if (kind === 'settlement') setPrepared({ type: 'settle_record', recordId: record.id, expectedVersion: initialVersion.current!, effectiveOn,
        paid: amounts, waived: { principalMinor: parseAmount(waivedPrincipal, false, true), interestMinor: parseAmount(waivedInterest, false, true), feesMinor: parseAmount(waivedFees, false, true) }, reason });
      else setPrepared({ ...common, type: 'post_entry', kind: kind as Exclude<EntryKind, 'opening_balance'>,
        paymentMode: kind === 'payment' ? principalOnly ? 'principal_only' : 'installment' : undefined,
        newInterestMinor: recognizeCharges && !principalOnly ? parseAmount(newInterest, false, true) : 0,
        newFeesMinor: recognizeCharges && !principalOnly ? parseAmount(newFees, false, true) : 0 });
    } catch (cause) { setError(errorMessage(cause)); }
  }
  async function save() {
    if (!prepared) return;
    try {
      setError(undefined);
      await execute(operation.get(), prepared);
      router.replace({ pathname: '/record/[id]', params: { id: record.id } });
    } catch (cause) { setError(errorMessage(cause)); }
  }
  return <Page title={title} subtitle={record.title} back>
    <Card><Copy variant="heading">Recorded outstanding {formatMoney(ledger.outstandingMinor)}</Copy>
      <Copy variant="caption">Principal {formatMoney(ledger.principalMinor)} · Interest {formatMoney(ledger.interestMinor)} · Fees {formatMoney(ledger.feesMinor)}</Copy></Card>
    {record.closedOn && <Problem message="Reopen the record before changing financial entries." />}
    {prepared ? <Card><Copy variant="heading">Review before saving</Copy>
      <Copy>Date: {effectiveOn}</Copy><Copy>{kind === 'settlement' ? 'Actual cash components' : 'Entry components'}</Copy>
      <Copy>Principal {principal} · Interest {interest} · Fees {fees} {launch.currency}</Copy>
      {kind === 'settlement' && <Copy>Separately waived: principal {waivedPrincipal} · interest {waivedInterest} · fees {waivedFees} {launch.currency}</Copy>}
      {recognizeCharges && !principalOnly && <Copy>Explicit new charges: interest {newInterest} · fees {newFees} {launch.currency}. These are saved atomically with the payment.</Copy>}
      {principalOnly && <Copy>Principal-only prepayment. Scheduled installments remain separate.</Copy>}
      {prepared.type === 'correct_entry' && <Copy>Correction: {prepared.state === 'void' ? 'Void this transaction' : 'Save / restore revised transaction'}. Prior revisions remain in history.</Copy>}
      {reason && <Copy>Reason: {reason}</Copy>}
      <Button label={busy ? 'Saving…' : 'Confirm and save'} disabled={busy || !!record.closedOn} onPress={() => { void save(); }} />
      <Button label="Edit inputs" secondary disabled={busy} onPress={() => setPrepared(undefined)} />
    </Card> : <>
      {kind === 'settlement' && <Copy>Enter the actual cash exchanged and the amount forgiven or written off separately. Together they must clear the recorded balance. No waived amount is reported as cash.</Copy>}
      {showPrincipal && <Field label={`${kind === 'settlement' ? 'Cash principal paid' : signed ? 'Principal adjustment (+ / −)' : 'Principal component'} (${launch.currency})`}
        value={principal} onChangeText={setPrincipal} keyboardType={signed ? 'default' : 'decimal-pad'} editable={!busy} />}
      {showInterest && <Field label={`${signed ? 'Interest adjustment (+ / −)' : 'Interest component'} (${launch.currency})`} value={interest} onChangeText={setInterest} keyboardType={signed ? 'default' : 'decimal-pad'} editable={!busy} />}
      {showFees && <Field label={`${signed ? 'Fee adjustment (+ / −)' : 'Fee component'} (${launch.currency})`} value={fees} onChangeText={setFees} keyboardType={signed ? 'default' : 'decimal-pad'} editable={!busy} />}
      {kind === 'settlement' && <>
        <Field label={`Principal to ${record.direction === 'borrowed' ? 'forgive' : 'write off'} (${launch.currency})`} value={waivedPrincipal} onChangeText={setWaivedPrincipal} keyboardType="decimal-pad" editable={!busy} />
        {record.interestMode === 'manual_interest' && <Field label={`Interest waived (${launch.currency})`} value={waivedInterest} onChangeText={setWaivedInterest} keyboardType="decimal-pad" editable={!busy} />}
        <Field label={`Fees waived (${launch.currency})`} value={waivedFees} onChangeText={setWaivedFees} keyboardType="decimal-pad" editable={!busy} />
      </>}
      {kind === 'payment' && record.allowsPrincipalOnlyPrepayment && <Toggle label="Principal-only prepayment" value={principalOnly} disabled={busy} onChange={(value) => {
        setPrincipalOnly(value); if (value) { setInterest('0.00'); setFees('0.00'); setRecognizeCharges(false); }
      }} />}
      {kind === 'payment' && !prior && !principalOnly && <>
        <Toggle label="Explicitly record new interest / fees with this payment" value={recognizeCharges} onChange={setRecognizeCharges} disabled={busy} />
        {recognizeCharges && <>
          {record.interestMode === 'manual_interest' && <Field label={`New interest charge to recognize (${launch.currency})`} value={newInterest} onChangeText={setNewInterest} keyboardType="decimal-pad" editable={!busy} />}
          <Field label={`New fee charge to recognize (${launch.currency})`} value={newFees} onChangeText={setNewFees} keyboardType="decimal-pad" editable={!busy} />
          <Copy variant="caption">These charges increase the recorded interest/fee balances before the split payment is applied. This never infers lender interest automatically.</Copy>
        </>}
      </>}
      <Field label="Effective date" value={effectiveOn} onChangeText={setEffectiveOn} placeholder="YYYY-MM-DD" editable={!busy && kind !== 'opening_balance'} />
      <Field label={prior || ['adjustment', 'forgiveness', 'write_off', 'settlement'].includes(kind) ? 'Reason (required)' : 'Note (optional)'} value={reason} onChangeText={setReason} maxLength={1000} multiline editable={!busy} />
      {signed && <Copy variant="caption">Enter signed differences, e.g. −200 to reduce a component. The balance is never overwritten. Each component must remain nonnegative.</Copy>}
      <Button label={prior?.state === 'void' ? 'Review restoration / correction' : 'Review entry'} disabled={busy || !!record.closedOn} onPress={() => review('posted')} />
      {prior && prior.kind !== 'opening_balance' && prior.state !== 'void' && <Button label="Review voiding this transaction" secondary disabled={busy || !!record.closedOn} onPress={() => review('void')} />}
    </>}
    <Problem message={error} />
    <Copy variant="caption">Your reviewed changes are saved together. Corrections never remove previous revisions. If a record changed while this form was open, reopen the form to review its latest values.</Copy>
  </Page>;
}