import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Badge, Button, Card, Copy, Field, Notice, Page, Problem, Row, Section, Segments, Toggle, errorMessage } from '@/components/nodebt/ui';
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
  return <Page title="Add a record" eyebrow="A clear starting point" subtitle="Start with the balance currently outstanding." revealBottom={error} back>
    <Segments value={direction} onChange={changeDirection} disabled={busy} options={[{ value: 'borrowed', label: 'I owe', icon: 'arrow-up-right' }, { value: 'lent', label: 'Owed to me', icon: 'arrow-down-left' }]} />
    <Section title="Record details" subtitle="Give this borrowing or lending a familiar name."><Card>
      <Field label="Record title" icon="file-text" value={title} onChangeText={setTitle} maxLength={120} autoCapitalize="sentences" editable={!busy} placeholder="e.g. Education loan or money lent to Alex" />
      <Field label="Person / lender / borrower (optional)" icon="user" value={counterparty} onChangeText={setCounterparty} maxLength={120} editable={!busy} placeholder="Who is this record with?" />
      <Copy variant="caption">Record type</Copy>
      <Row>{([['loan', 'Loan'], ['credit_card', 'Credit card'], ['bnpl', 'BNPL'], ['informal', 'Personal'], ['other', 'Other']] as const)
        .map(([value, label]) => <Button key={value} label={label} secondary selected={kind === value} disabled={busy} onPress={() => setKind(value)} />)}</Row>
    </Card></Section>
    <Section title="Choose a category" subtitle={`${directionLabel(direction)} · Guest categories`}><Card>
      <Row>{available(direction).map((category) => <Button key={category.id} label={category.name} secondary selected={categoryId === category.id}
        disabled={busy} onPress={() => setCategoryId(category.id)} />)}</Row>
      <Button label="Manage custom categories" icon="grid" secondary disabled={busy} onPress={() => router.push({ pathname: '/categories', params: { direction } })} />
    </Card></Section>
    <Section title="Your opening balance" subtitle="Principal, interest and fees stay separate."><Card>
      <Field label={`Outstanding principal (${launch.currency})`} value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" editable={!busy} placeholder="0.00"
        hint="Enter today’s principal. Earlier repayments will not be invented." />
      <Toggle label="Interest-free agreement" value={interestFree} disabled={busy} hint="Turn off only when interest is recorded separately."
        onChange={(value) => { setInterestFree(value); if (value) setInterest(''); }} />
      {!interestFree && <Field label={`Already unpaid interest (${launch.currency}, optional)`} value={interest} onChangeText={setInterest} keyboardType="decimal-pad" editable={!busy} placeholder="0.00" />}
      <Field label={`Already unpaid fees (${launch.currency}, optional)`} value={fees} onChangeText={setFees} keyboardType="decimal-pad" editable={!busy} placeholder="0.00" />
      <Field label="Balance tracking starts on" icon="calendar" value={startedOn} onChangeText={setStartedOn} placeholder="YYYY-MM-DD" editable={!busy} hint="Use a calendar date in YYYY-MM-DD format." />
      <Toggle label="Principal-only prepayments allowed" hint="Enable only if your agreement permits them." value={prepayment} onChange={setPrepayment} disabled={busy} />
    </Card></Section>
    <Section title="Payment / collection schedule" subtitle="Optional. Record the agreement you already have."><Card>
      <Segments value={schedule} onChange={setSchedule} disabled={busy} options={[{ value: 'none', label: 'No due date' }, { value: 'single', label: 'One-time' }, { value: 'monthly', label: 'Monthly' }]} />
      {schedule !== 'none' && <>
        <Field label="First due date" icon="calendar" value={dueOn} onChangeText={setDueOn} placeholder="YYYY-MM-DD" editable={!busy} />
        <Field label={`Scheduled amount (${launch.currency})`} value={installment} onChangeText={setInstallment} keyboardType="decimal-pad" editable={!busy} placeholder="0.00" />
        {schedule === 'monthly' && <Field label="Number of monthly installments" value={count} onChangeText={setCount} keyboardType="number-pad" editable={!busy} />}
      </>}
      <Badge label="Entered schedule · No automatic interest" icon="calendar" tone="brand" />
    </Card></Section>
    <Notice tone="brand" icon="shield">Interest and fees are never added automatically. Extra principal does not silently change future installments.</Notice>
    <Problem message={error} />
    <Button label={`Save ${directionLabel(direction)}`} icon="check" loading={busy} disabled={busy} onPress={() => { void save(); }} />
    <Copy variant="caption" style={{ textAlign: 'center' }}>Records stay privately on this device.</Copy>
  </Page>;
}
