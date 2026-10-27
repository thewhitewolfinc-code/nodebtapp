import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Card, Copy, Field, Page, Problem, Row, Toggle, errorMessage } from '@/components/nodebt/ui';
import { launch } from '@/config/product';
import { canAssignCategory } from '@/domain/categories';
import type { Direction } from '@/domain/ledger';
import { installmentCount, parseAmount } from '@/features/guest/forms';
import { useGuest, useOperationId } from '@/features/guest/provider';
import { directionLabel } from '@/features/guest/selectors';
import type { GuestRecord } from '@/storage/models';

export default function NewRecord() {
  const params = useLocalSearchParams<{ direction?: string }>();
  const { snapshot, execute, busy, today } = useGuest();
  const operation = useOperationId();
  const [direction, setDirection] = useState<Direction>(params.direction === 'lent' ? 'lent' : 'borrowed');
  const available = (value: Direction) => snapshot.categories.filter((category) =>
    category.direction === value && canAssignCategory(category, { isPro: false })).sort((a, b) => a.sortOrder - b.sortOrder);
  const [categoryId, setCategoryId] = useState(() => available(direction)[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [kind, setKind] = useState<GuestRecord['kind']>(direction === 'lent' ? 'informal' : 'loan');
  const [principal, setPrincipal] = useState('');
  const [interest, setInterest] = useState('');
  const [fees, setFees] = useState('');
  const [interestFree, setInterestFree] = useState(true);
  const [startedOn, setStartedOn] = useState(today);
  const [prepayment, setPrepayment] = useState(false);
  const [schedule, setSchedule] = useState<'none' | 'single' | 'monthly'>('none');
  const [dueOn, setDueOn] = useState(today);
  const [installment, setInstallment] = useState('');
  const [count, setCount] = useState('12');
  const [error, setError] = useState<string>();
  function changeDirection(value: Direction) {
    setDirection(value);
    setCategoryId(available(value)[0]?.id ?? '');
  }
  async function save() {
    try {
      setError(undefined);
      const result = await execute(operation.get(), {
        type: 'create_record', title, direction, categoryId, counterparty, kind,
        interestMode: interestFree ? 'interest_free' : 'manual_interest', trackingStartedOn: startedOn,
        allowsPrincipalOnlyPrepayment: prepayment,
        opening: { principalMinor: parseAmount(principal), interestMinor: interestFree ? 0 : parseAmount(interest, false, true), feesMinor: parseAmount(fees, false, true) },
        schedule: schedule === 'none' ? undefined : { firstDueOn: dueOn, amountMinor: parseAmount(installment),
          count: schedule === 'single' ? 1 : installmentCount(count) },
      });
      router.replace({ pathname: '/record/[id]', params: { id: result.recordId! } });
    } catch (cause) { setError(errorMessage(cause)); }
  }
  return <Page title="Add a record" subtitle="Start with the balance currently outstanding." back>
    <Row><Button label="Money I Owe" secondary selected={direction === 'borrowed'} disabled={busy} onPress={() => changeDirection('borrowed')} />
      <Button label="Money Owed to Me" secondary selected={direction === 'lent'} disabled={busy} onPress={() => changeDirection('lent')} /></Row>
    <Field label="Record title" value={title} onChangeText={setTitle} maxLength={120} autoCapitalize="sentences" editable={!busy} placeholder="e.g. Education loan or money lent to Alex" />
    <Field label="Person / lender / borrower (optional)" value={counterparty} onChangeText={setCounterparty} maxLength={120} editable={!busy} />
    <Copy variant="heading">Record type</Copy>
    <Row>{([['loan', 'Loan'], ['credit_card', 'Credit card'], ['bnpl', 'BNPL'], ['informal', 'Informal'], ['other', 'Other']] as const)
      .map(([value, label]) => <Button key={value} label={label} secondary selected={kind === value} disabled={busy} onPress={() => setKind(value)} />)}</Row>
    <Copy variant="heading">{directionLabel(direction)} · Category</Copy>
    <Row>{available(direction).map((category) => <Button key={category.id} label={category.name} secondary selected={categoryId === category.id}
      disabled={busy} onPress={() => setCategoryId(category.id)} />)}</Row>
    <Button label="Create or manage custom categories" secondary disabled={busy} onPress={() => router.push({ pathname: '/categories', params: { direction } })} />
    <Field label={`Outstanding principal (${launch.currency})`} value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" editable={!busy}
      hint="Enter principal separately from unpaid interest and fees. No previous repayments will be invented." />
    <Toggle label="Interest-free agreement" value={interestFree} disabled={busy} onChange={(value) => { setInterestFree(value); if (value) setInterest(''); }} />
    {!interestFree && <Field label={`Already unpaid interest (${launch.currency}, optional)`} value={interest} onChangeText={setInterest} keyboardType="decimal-pad" editable={!busy} placeholder="0.00" />}
    <Field label={`Already unpaid fees (${launch.currency}, optional)`} value={fees} onChangeText={setFees} keyboardType="decimal-pad" editable={!busy} placeholder="0.00" />
    <Field label="Balance tracking starts on" value={startedOn} onChangeText={setStartedOn} placeholder="YYYY-MM-DD" editable={!busy}
      hint="Use a calendar date in YYYY-MM-DD format." />
    <Toggle label="Agreement permits principal-only prepayments" value={prepayment} onChange={setPrepayment} disabled={busy} />
    <Copy variant="heading">Payment / collection schedule</Copy>
    <Row>{(['none', 'single', 'monthly'] as const).map((value) => <Button key={value} label={value === 'none' ? 'No due date' : value === 'single' ? 'One-time' : 'Monthly'}
      secondary selected={schedule === value} disabled={busy} onPress={() => setSchedule(value)} />)}</Row>
    {schedule !== 'none' && <>
      <Field label="First due date" value={dueOn} onChangeText={setDueOn} placeholder="YYYY-MM-DD" editable={!busy} />
      <Field label={`Scheduled amount (${launch.currency})`} value={installment} onChangeText={setInstallment} keyboardType="decimal-pad" editable={!busy} />
      {schedule === 'monthly' && <Field label="Number of monthly installments" value={count} onChangeText={setCount} keyboardType="number-pad" editable={!busy} />}
    </>}
    <Card><Copy variant="caption">Schedules record your entered agreement. Interest and fees are never added automatically, and extra principal does not silently change future installments.</Copy></Card>
    <Problem message={error} />
    <Button label={busy ? 'Saving record…' : `Save ${directionLabel(direction)}`} disabled={busy} onPress={() => { void save(); }} />
  </Page>;
}