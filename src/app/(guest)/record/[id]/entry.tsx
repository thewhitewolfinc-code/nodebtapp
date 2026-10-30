import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Badge, Button, Card, Copy, DataRow, EmptyState, Field, Notice, Page, Problem, Section, Toggle, errorMessage } from '@/components/nodebt/ui';
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
  const [manualAllocation, setManualAllocation] = useState(prior?.allocations !== undefined);
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>(() => Object.fromEntries(
    (detail?.schedule.installments ?? []).map((row) => [row.id, amountInput(prior?.allocations?.find((allocation) => allocation.installmentId === row.id)?.amountMinor ?? 0)])));
  const [recognizeCharges, setRecognizeCharges] = useState(false);
  const [newInterest, setNewInterest] = useState('0.00');
  const [newFees, setNewFees] = useState('0.00');
  const [prepared, setPrepared] = useState<GuestCommand>();
  const [error, setError] = useState<string>();
  const operation = useOperationId();
  if (!detail || (params.entryId && !prior)) return <Page title="Entry not found" back><EmptyState icon="file-text" title="Entry unavailable" description="Open a transaction from its record history." /></Page>;
  if (!prior && !kinds.includes(kind)) return <Page title="Unsupported entry" back><EmptyState icon="alert-circle" title="Choose an action from the record" description="This financial action is not supported." /></Page>;
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
      const allocations = manualAllocation && !principalOnly ? detail!.schedule.installments.map((row) => ({
        installmentId: row.id, amountMinor: parseAmount(allocationInputs[row.id] ?? '', false, true),
      })).filter((allocation) => allocation.amountMinor > 0) : undefined;
      const common = { recordId: record.id, expectedVersion: initialVersion.current!, effectiveOn, components: amounts, reason };
      if (prior) setPrepared({ ...common, type: 'correct_entry', entryId: prior.id, expectedRevisionId: initialParent.current!,
        state, allocations, paymentMode: prior.kind === 'payment' ? principalOnly ? 'principal_only' : 'installment' : undefined });
      else if (kind === 'settlement') setPrepared({ type: 'settle_record', recordId: record.id, expectedVersion: initialVersion.current!, effectiveOn,
        paid: amounts, allocations, waived: { principalMinor: parseAmount(waivedPrincipal, false, true), interestMinor: parseAmount(waivedInterest, false, true), feesMinor: parseAmount(waivedFees, false, true) }, reason });
      else setPrepared({ ...common, allocations, type: 'post_entry', kind: kind as Exclude<EntryKind, 'opening_balance'>,
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
  return <Page title={title} eyebrow={record.direction === 'borrowed' ? 'Borrowing' : 'Lending'} subtitle={record.title} revealBottom={error} back>
    <Card tone="brand"><Copy variant="caption">Current recorded outstanding</Copy><Copy variant="metric">{formatMoney(ledger.outstandingMinor)}</Copy>
      <Copy variant="caption">Principal {formatMoney(ledger.principalMinor)} · Interest {formatMoney(ledger.interestMinor)} · Fees {formatMoney(ledger.feesMinor)}</Copy></Card>
    {record.closedOn && <Problem message="Reopen the record before changing financial entries." />}
    {prepared ? <Section title="Review before saving" subtitle="Check each component. Nothing has been saved yet."><Card>
      <Badge label="Review required" icon="check-circle" tone="warning" />
      <DataRow label="Effective date" value={effectiveOn} /><Copy variant="heading">{kind === 'settlement' ? 'Actual cash components' : 'Entry components'}</Copy>
      <DataRow label="Principal" value={`${principal} ${launch.currency}`} /><DataRow label="Interest" value={`${interest} ${launch.currency}`} /><DataRow label="Fees" value={`${fees} ${launch.currency}`} last />
      {kind === 'settlement' && <><Copy variant="heading">Separately waived</Copy><DataRow label="Principal waived" value={`${waivedPrincipal} ${launch.currency}`} /><DataRow label="Interest waived" value={`${waivedInterest} ${launch.currency}`} /><DataRow label="Fees waived" value={`${waivedFees} ${launch.currency}`} last /></>}
      {recognizeCharges && !principalOnly && <Notice>Explicit new charges: interest {newInterest} · fees {newFees} {launch.currency}. These are saved together with the payment.</Notice>}
      {principalOnly && <Notice tone="brand">Principal-only prepayment. Scheduled installments remain separate.</Notice>}
      {manualAllocation && !principalOnly && <><Copy variant="heading">Installment allocation</Copy>{detail.schedule.installments.filter((row) => parseAmount(allocationInputs[row.id] ?? '', false, true) > 0).map((row) => <DataRow key={row.id} label={row.dueOn} value={`${allocationInputs[row.id]} ${launch.currency}`} />)}</>}
      {prepared.type === 'correct_entry' && <Notice tone="warning">{prepared.state === 'void' ? 'This transaction will be voided.' : 'This revised transaction will be saved / restored.'} Prior revisions remain in history.</Notice>}
      {reason && <><Copy variant="caption">Reason</Copy><Copy>{reason}</Copy></>}
      <Button label="Confirm and save" icon="check" loading={busy} disabled={busy || !!record.closedOn} onPress={() => { void save(); }} />
      <Button label="Edit inputs" previewSafe icon="edit-2" secondary disabled={busy} onPress={() => setPrepared(undefined)} />
    </Card></Section> : <>
      {kind === 'settlement' && <Notice tone="warning">Record actual cash and amounts forgiven or written off separately. Together they must clear the recorded balance. Waived amounts are never reported as cash.</Notice>}
      <Section title={kind === 'settlement' ? 'Actual cash paid' : signed ? 'Component adjustments' : 'Entry components'} subtitle="Keep principal, interest and fees separate."><Card>
        {showPrincipal && <Field label={`${kind === 'settlement' ? 'Cash principal paid' : signed ? 'Principal adjustment (+ / −)' : 'Principal component'} (${launch.currency})`} value={principal} onChangeText={setPrincipal} keyboardType={signed ? 'default' : 'decimal-pad'} editable={!busy} />}
        {showInterest && <Field label={`${signed ? 'Interest adjustment (+ / −)' : 'Interest component'} (${launch.currency})`} value={interest} onChangeText={setInterest} keyboardType={signed ? 'default' : 'decimal-pad'} editable={!busy} />}
        {showFees && <Field label={`${signed ? 'Fee adjustment (+ / −)' : 'Fee component'} (${launch.currency})`} value={fees} onChangeText={setFees} keyboardType={signed ? 'default' : 'decimal-pad'} editable={!busy} />}
        {signed && <Copy variant="caption">Use a signed difference, e.g. -200 to reduce a component. Each balance must remain nonnegative.</Copy>}
      </Card></Section>
      {kind === 'settlement' && <Section title="Amount waived" subtitle="Forgiveness and write-offs are kept separate from cash."><Card>
        <Field label={`Principal to ${record.direction === 'borrowed' ? 'forgive' : 'write off'} (${launch.currency})`} value={waivedPrincipal} onChangeText={setWaivedPrincipal} keyboardType="decimal-pad" editable={!busy} />
        {record.interestMode === 'manual_interest' && <Field label={`Interest waived (${launch.currency})`} value={waivedInterest} onChangeText={setWaivedInterest} keyboardType="decimal-pad" editable={!busy} />}
        <Field label={`Fees waived (${launch.currency})`} value={waivedFees} onChangeText={setWaivedFees} keyboardType="decimal-pad" editable={!busy} />
      </Card></Section>}
      {kind === 'payment' && record.allowsPrincipalOnlyPrepayment && <Card><Toggle label="Principal-only prepayment" value={principalOnly} disabled={busy} hint="Scheduled installments will remain separate." onChange={(value) => {
        setPrincipalOnly(value); if (value) { setManualAllocation(false); setInterest('0.00'); setFees('0.00'); setRecognizeCharges(false); }
      }} /></Card>}
      {kind === 'payment' && !prior && !principalOnly && <Section title="Additional charges"><Card>
        <Toggle label="Record new interest / fees with this payment" value={recognizeCharges} onChange={setRecognizeCharges} disabled={busy} />
        {recognizeCharges && <>{record.interestMode === 'manual_interest' && <Field label={`New interest charge (${launch.currency})`} value={newInterest} onChangeText={setNewInterest} keyboardType="decimal-pad" editable={!busy} />}
          <Field label={`New fee charge (${launch.currency})`} value={newFees} onChangeText={setNewFees} keyboardType="decimal-pad" editable={!busy} />
          <Copy variant="caption">These charges are recorded before the split payment is applied. No lender interest is inferred automatically.</Copy></>}
      </Card></Section>}
      {['payment', 'settlement'].includes(kind) && !principalOnly && detail.schedule.installments.length > 0 && <Section title="Installment allocation"><Card>
        <Toggle label="Allocate cash to specific installments" value={manualAllocation} onChange={setManualAllocation} disabled={busy} />
        <Copy variant="caption">Default: oldest unpaid installment first. Unassigned cash does not complete an installment.</Copy>
        {manualAllocation && detail.schedule.installments.map((row) => <Field key={row.id} label={`Cash assigned to ${row.dueOn} (${launch.currency})`} value={allocationInputs[row.id] ?? '0.00'} onChangeText={(value) => setAllocationInputs((previous) => ({ ...previous, [row.id]: value }))} keyboardType="decimal-pad" editable={!busy} />)}
      </Card></Section>}
      <Section title="Date & context"><Card>
        <Field label="Effective date" icon="calendar" value={effectiveOn} onChangeText={setEffectiveOn} placeholder="YYYY-MM-DD" editable={!busy && kind !== 'opening_balance'} />
        <Field label={prior || ['adjustment', 'forgiveness', 'write_off', 'settlement'].includes(kind) ? 'Reason (required)' : 'Note (optional)'} value={reason} onChangeText={setReason} maxLength={1000} multiline editable={!busy} placeholder="Add the context you’ll want to remember." />
      </Card></Section>
      <Button label={prior?.state === 'void' ? 'Review restoration / correction' : 'Review entry'} previewSafe icon="check-circle" disabled={busy || !!record.closedOn} onPress={() => review('posted')} />
      {prior && prior.kind !== 'opening_balance' && prior.state !== 'void' && <Button label="Review voiding this transaction" previewSafe tone="danger" secondary disabled={busy || !!record.closedOn} onPress={() => review('void')} />}
    </>}
    <Problem message={error} />
    <Copy variant="caption">Reviewed changes are saved together. Corrections never remove previous revisions. If the record changed while this form was open, reopen it to review the latest values.</Copy>
  </Page>;
}
