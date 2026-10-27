import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertDateOnly, monthlyDate } from '../src/domain/dates.ts';
import { createMonthlySchedule, projectInstallments } from '../src/domain/installments.ts';
import {
  closeRecord, correctEntry, currentEntries, LedgerError, portfolioTotals, postEntry,
  projectLedger, reopenRecord,
  type DebtRecord, type EntryDraft, type EntryRevision, type RevisionContext,
} from '../src/domain/ledger.ts';
import { addMoney, formatMoney, parseRupees } from '../src/domain/money.ts';

const rupees = (amount: number) => amount * 100;
const record = (overrides: Partial<DebtRecord> = {}): DebtRecord => ({
  id: 'debt-1', title: 'Personal loan', direction: 'borrowed', currency: 'INR',
  trackingStartedOn: '2026-10-01', archived: false,
  allowsPrincipalOnlyPrepayment: true, ...overrides,
});
const context = (id: string): RevisionContext => ({
  revisionId: `revision-${id}`, recordedAt: '2026-10-27T12:00:00.000Z', today: '2026-10-27',
});
function draft(debt: DebtRecord, id: string, kind: EntryDraft['kind'], principal: number,
  extras: Partial<EntryDraft> = {}): EntryDraft {
  return {
    id, recordId: debt.id, kind, effectiveOn: '2026-10-02', principalMinor: rupees(principal),
    interestMinor: 0, feesMinor: 0, ...(kind === 'payment' ? { paymentMode: 'installment' as const } : {}), ...extras,
  };
}
function opening(debt: DebtRecord, principal = 10000, interest = 0, fees = 0): readonly EntryRevision[] {
  return postEntry(debt, [], draft(debt, 'opening', 'opening_balance', principal, {
    effectiveOn: debt.trackingStartedOn, interestMinor: rupees(interest), feesMinor: rupees(fees),
  }), context('opening'));
}
function post(debt: DebtRecord, history: readonly EntryRevision[], id: string,
  kind: EntryDraft['kind'], principal: number, extras: Partial<EntryDraft> = {}) {
  return postEntry(debt, history, draft(debt, id, kind, principal, extras), context(id));
}
function errorCode(code: LedgerError['code']) {
  return (error: unknown) => error instanceof LedgerError && error.code === code;
}

test('money: decimal parsing is exact and display uses Indian grouping', () => {
  assert.equal(parseRupees('1234567.89'), 123456789);
  assert.equal(parseRupees(' 0.01 '), 1);
  assert.equal(parseRupees('12.5'), 1250);
  assert.equal(parseRupees('0012'), 1200);
  assert.equal(formatMoney(123456789), '₹12,34,567.89');
  assert.equal(formatMoney(-1), '-₹0.01');
  assert.equal(formatMoney(Number.MAX_SAFE_INTEGER), '₹9,00,71,99,25,47,409.91');
});

test('money: reject invalid, fractional-paise, exponent, and overflowing amounts', () => {
  for (const text of ['', '-1', 'NaN', 'Infinity', '1.005', '1e3', '1,000', '.5', '5.', '90071992547410']) {
    assert.throws(() => parseRupees(text), text);
  }
  assert.throws(() => addMoney(Number.MAX_SAFE_INTEGER, 1));
  assert.throws(() => addMoney(0.1));
});

test('dates: validate real calendar dates and retain month-end anchors across leap years', () => {
  assert.doesNotThrow(() => assertDateOnly('2028-02-29'));
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '10/27/2026']) {
    assert.throws(() => assertDateOnly(date));
  }
  assert.equal(monthlyDate('2026-01-31', 1), '2026-02-28');
  assert.equal(monthlyDate('2026-01-31', 2), '2026-03-31');
  assert.equal(monthlyDate('2027-12-31', 2), '2028-02-29');
});

test('an existing debt starts with today’s snapshot without invented past repayments', () => {
  const debt = record();
  const balance = projectLedger(debt, opening(debt, 32000));
  assert.equal(balance.outstandingMinor, rupees(32000));
  assert.equal(balance.cashPaidMinor, 0);
  assert.equal(balance.principalPaidMinor, 0);
});

test('₹5,000 EMI: ₹4,000 principal and ₹1,000 explicitly charged interest remain separate', () => {
  const debt = record();
  let history = opening(debt);
  history = post(debt, history, 'interest', 'interest_charge', 0, { interestMinor: rupees(1000) });
  history = post(debt, history, 'payment', 'payment', 4000, { interestMinor: rupees(1000), effectiveOn: '2026-10-03' });
  const balance = projectLedger(debt, history);
  assert.equal(balance.principalMinor, rupees(6000));
  assert.equal(balance.interestMinor, 0);
  assert.equal(balance.cashPaidMinor, rupees(5000));
  assert.equal(balance.principalPaidMinor, rupees(4000));
  assert.equal(balance.interestPaidMinor, rupees(1000));
});

test('additional borrowing, interest, fees, and cash payments use explicit components', () => {
  const debt = record();
  let history = opening(debt, 10000, 200, 100);
  history = post(debt, history, 'advance', 'advance', 2000);
  history = post(debt, history, 'fee', 'fee_charge', 0, { feesMinor: rupees(50) });
  history = post(debt, history, 'interest', 'interest_charge', 0, { interestMinor: rupees(100) });
  history = post(debt, history, 'payment', 'payment', 1000, { interestMinor: rupees(300), feesMinor: rupees(150) });
  const balance = projectLedger(debt, history);
  assert.equal(balance.outstandingMinor, rupees(11000));
  assert.equal(balance.cashPaidMinor, rupees(1450));
});

test('payment cannot silently overdraw principal, unrecorded interest, or fees', () => {
  const debt = record();
  const history = opening(debt);
  assert.throws(() => post(debt, history, 'p', 'payment', 10001), errorCode('OVERPAYMENT'));
  assert.throws(() => post(debt, history, 'p', 'payment', 4000, { interestMinor: rupees(1000) }), errorCode('OVERPAYMENT'));
  assert.throws(() => post(debt, history, 'p', 'payment', 0, { feesMinor: 1 }), errorCode('OVERPAYMENT'));
  assert.equal(history.length, 1);
});

test('corrections append revisions without changing original entries or transaction identity', () => {
  const debt = record();
  const before = post(debt, opening(debt), 'payment', 'payment', 3000);
  const original = structuredClone(before);
  const corrected = correctEntry(debt, before, 'payment', 'revision-payment',
    draft(debt, 'payment', 'payment', 2000, { reason: 'Receipt amount corrected' }), context('correction'));
  assert.deepEqual(before, original);
  assert.equal(corrected.length, 3);
  assert.equal(projectLedger(debt, corrected).outstandingMinor, rupees(8000));
  assert.equal(currentEntries(debt, corrected).find((entry) => entry.id === 'payment')?.revision, 2);
  assert.throws(() => correctEntry(debt, corrected, 'payment', 'revision-payment',
    draft(debt, 'payment', 'payment', 1000, { reason: 'Stale edit' }), context('stale')), errorCode('CONFLICT'));
});

test('voiding and restoring payments preserve the complete audit chain', () => {
  const debt = record();
  const paid = post(debt, opening(debt), 'payment', 'payment', 3000);
  const replacement = draft(debt, 'payment', 'payment', 3000, { reason: 'Duplicate receipt' });
  const voided = correctEntry(debt, paid, 'payment', 'revision-payment', replacement, context('void'), 'void');
  assert.equal(projectLedger(debt, voided).cashPaidMinor, 0);
  const restored = correctEntry(debt, voided, 'payment', 'revision-void',
    { ...replacement, reason: 'Receipt confirmed' }, context('restore'));
  assert.equal(projectLedger(debt, restored).cashPaidMinor, rupees(3000));
  assert.equal(restored.length, 4);
});

test('financial history rejects concurrent branches, gaps, duplicate revision IDs, and changed types', () => {
  const debt = record();
  const history = post(debt, opening(debt), 'payment', 'payment', 2000);
  const correction = { ...history[1], revision: 2, previousRevisionId: history[1].revisionId,
    revisionId: 'branch-a', reason: 'Correction A' };
  const branch = { ...correction, revisionId: 'branch-b', reason: 'Correction B' };
  assert.throws(() => projectLedger(debt, [...history, correction, branch]), errorCode('CONFLICT'));
  assert.throws(() => projectLedger(debt, [...history, { ...correction, revision: 3 }]), errorCode('CONFLICT'));
  assert.throws(() => projectLedger(debt, [...history, { ...correction, revisionId: history[0].revisionId }]), errorCode('CONFLICT'));
  assert.throws(() => correctEntry(debt, history, 'payment', history[1].revisionId,
    draft(debt, 'payment', 'advance', 100, { reason: 'Cannot change type' }), context('wrong-type')));
});

test('retroactive corrections cannot invalidate a later balance', () => {
  const debt = record();
  const history = post(debt, opening(debt), 'payment', 'payment', 9000);
  assert.throws(() => correctEntry(debt, history, 'opening', 'revision-opening',
    draft(debt, 'opening', 'opening_balance', 8000, { effectiveOn: debt.trackingStartedOn, reason: 'Wrong initial balance' }),
    context('opening-fix')), errorCode('OVERPAYMENT'));
  assert.throws(() => correctEntry(debt, history, 'opening', 'revision-opening',
    { ...history[0], reason: 'Remove opening' }, context('opening-void'), 'void'));
});

test('partial settlement records actual cash and forgiveness independently', () => {
  const debt = record();
  let history = post(debt, opening(debt), 'payment', 'payment', 8000);
  history = post(debt, history, 'waiver', 'forgiveness', 2000, { reason: 'Lender accepted settlement', effectiveOn: '2026-10-03' });
  const balance = projectLedger(debt, history);
  assert.equal(balance.outstandingMinor, 0);
  assert.equal(balance.cashPaidMinor, rupees(8000));
  assert.equal(balance.forgivenMinor, rupees(2000));
  assert.equal(balance.status, 'settled');
  assert.equal(closeRecord(debt, history, '2026-10-03').closedOn, '2026-10-03');
});

test('lending write-off is not a cash collection and cannot be mislabeled forgiveness', () => {
  const debt = record({ direction: 'lent' });
  const history = post(debt, opening(debt), 'loss', 'write_off', 10000, { reason: 'Uncollectible' });
  const balance = projectLedger(debt, history);
  assert.equal(balance.cashPaidMinor, 0);
  assert.equal(balance.writtenOffMinor, rupees(10000));
  assert.equal(balance.status, 'written_off');
  assert.throws(() => post(debt, opening(debt), 'wrong', 'forgiveness', 10000, { reason: 'Wrong direction' }));
  assert.throws(() => post(record(), opening(record()), 'wrong', 'write_off', 10000, { reason: 'Wrong direction' }));
});

test('balance adjustments are explained signed deltas, never silent balance replacements', () => {
  const debt = record();
  assert.throws(() => post(debt, opening(debt), 'fix', 'adjustment', -200));
  const history = post(debt, opening(debt), 'fix', 'adjustment', -200, { reason: 'Statement reconciliation' });
  assert.equal(projectLedger(debt, history).outstandingMinor, rupees(9800));
  assert.equal(projectLedger(debt, history).cashPaidMinor, 0);
  const zeroed = post(debt, opening(debt), 'fix', 'adjustment', -10000, { reason: 'Record entered in error' });
  assert.equal(projectLedger(debt, zeroed).status, 'closed_adjusted');
});

test('paid-off, closure, reopening, and archiving remain distinct', () => {
  const debt = record();
  assert.throws(() => closeRecord(debt, opening(debt), '2026-10-27'));
  const paid = post(debt, opening(debt), 'payment', 'payment', 10000);
  assert.equal(projectLedger(debt, paid).status, 'paid_off');
  const closed = closeRecord(debt, paid, '2026-10-27');
  assert.throws(() => post(closed, paid, 'new', 'advance', 100), errorCode('CLOSED'));
  const reopened = reopenRecord(closed);
  assert.equal(reopened.id, debt.id);
  const next = post(reopened, paid, 'new', 'advance', 100, { effectiveOn: '2026-10-27' });
  assert.equal(projectLedger(reopened, next).outstandingMinor, rupees(100));
  assert.equal(projectLedger({ ...reopened, archived: true }, next).outstandingMinor, rupees(100));
});

test('portfolio totals keep obligations and receivables separate, even when archived', () => {
  const debt = record({ archived: true });
  const lending = record({ id: 'lending-1', direction: 'lent' });
  const history = [...opening(debt, 50000), ...opening(lending, 12000).map((entry) => ({
    ...entry, id: 'lending-opening', revisionId: 'lending-revision-opening',
  }))];
  assert.deepEqual(portfolioTotals([debt, lending], history), { owedMinor: rupees(50000), receivableMinor: rupees(12000) });
  assert.throws(() => portfolioTotals([debt, debt], history));
  assert.throws(() => portfolioTotals([debt], history));
});

test('reject invalid direction, currency, duplicate entries, missing openings, and future cash transactions', () => {
  const debt = record();
  assert.throws(() => projectLedger(debt, []));
  const history = opening(debt);
  assert.throws(() => postEntry(debt, history, history[0], context('duplicate')));
  assert.throws(() => projectLedger({ ...debt, currency: 'USD' } as unknown as DebtRecord, history));
  assert.throws(() => post(debt, history, 'future', 'payment', 10, { effectiveOn: '2026-10-28' }));
  assert.throws(() => post(debt, history, 'old', 'payment', 10, { effectiveOn: '2026-09-30' }));
  assert.throws(() => projectLedger(debt, [...history, { ...history[0], id: 'second-opening', revisionId: 'another' }]));
});

test('a ₹3,000 partial payment leaves ₹2,000 overdue without changing future installments', () => {
  const debt = record();
  const history = post(debt, opening(debt, 50000), 'payment', 'payment', 3000);
  const schedule = createMonthlySchedule(debt.id, '2026-10-10', rupees(5000), 3);
  const snapshot = structuredClone(schedule);
  const result = projectInstallments(debt, history, schedule, '2026-10-11');
  assert.equal(result.installments[0].remainingMinor, rupees(2000));
  assert.equal(result.installments[0].status, 'overdue');
  assert.equal(result.installments[1].remainingMinor, rupees(5000));
  assert.equal(result.installments[1].status, 'upcoming');
  assert.deepEqual(schedule, snapshot);
  assert.equal(projectInstallments(debt, history, schedule, '2026-10-10').installments[0].status, 'due_today');
});

test('default cash allocations pay the oldest unpaid installments first', () => {
  const debt = record();
  const history = post(debt, opening(debt, 50000), 'payment', 'payment', 7000);
  const schedule = createMonthlySchedule(debt.id, '2026-10-10', rupees(5000), 3);
  const { installments } = projectInstallments(debt, history, schedule, '2026-10-27');
  assert.equal(installments[0].status, 'paid');
  assert.equal(installments[1].paidMinor, rupees(2000));
  assert.equal(installments[1].remainingMinor, rupees(3000));
  assert.equal(installments[2].paidMinor, 0);
});

test('principal-only prepayments reduce debt without silently satisfying scheduled installments', () => {
  const debt = record();
  const history = post(debt, opening(debt, 50000), 'prepayment', 'payment', 2000, { paymentMode: 'principal_only' });
  const schedule = createMonthlySchedule(debt.id, '2026-10-10', rupees(5000), 2);
  const result = projectInstallments(debt, history, schedule, '2026-10-27');
  assert.equal(result.installments[0].remainingMinor, rupees(5000));
  assert.equal(result.principalPrepaidMinor, rupees(2000));
  assert.equal(projectLedger(debt, history).principalMinor, rupees(48000));
  const restricted = record({ allowsPrincipalOnlyPrepayment: false });
  assert.throws(() => post(restricted, opening(restricted), 'p', 'payment', 100, { paymentMode: 'principal_only' }));
});

test('explicit contract allocations override FIFO and cannot exceed real installments or cash', () => {
  const debt = record();
  const schedule = createMonthlySchedule(debt.id, '2026-10-10', rupees(5000), 2);
  const history = post(debt, opening(debt), 'payment', 'payment', 3000, {
    allocations: [{ installmentId: schedule[1].id, amountMinor: rupees(3000) }],
  });
  const result = projectInstallments(debt, history, schedule, '2026-10-27');
  assert.equal(result.installments[0].paidMinor, 0);
  assert.equal(result.installments[1].paidMinor, rupees(3000));
  assert.throws(() => projectInstallments(debt, history, [schedule[0]], '2026-10-27'));
  assert.throws(() => post(debt, opening(debt), 'bad', 'payment', 3000, {
    allocations: [{ installmentId: schedule[1].id, amountMinor: rupees(4000) }],
  }));
});

test('correcting a payment recalculates installments and keeps the old amount in history', () => {
  const debt = record();
  const history = post(debt, opening(debt), 'payment', 'payment', 5000);
  const corrected = correctEntry(debt, history, 'payment', 'revision-payment',
    draft(debt, 'payment', 'payment', 3000, { reason: 'Actual bank receipt' }), context('corrected'));
  const schedule = createMonthlySchedule(debt.id, '2026-10-10', rupees(5000), 1);
  const result = projectInstallments(debt, corrected, schedule, '2026-10-27');
  assert.equal(result.installments[0].remainingMinor, rupees(2000));
  assert.equal(corrected[1].principalMinor, rupees(5000));
});

test('waivers do not masquerade as installment cash payments', () => {
  const debt = record();
  const history = post(debt, opening(debt), 'waiver', 'forgiveness', 10000, { reason: 'Debt forgiven' });
  const result = projectInstallments(debt, history,
    createMonthlySchedule(debt.id, '2026-10-10', rupees(5000), 2), '2026-10-27');
  assert.equal(result.installments[0].paidMinor, 0);
  assert.equal(projectLedger(debt, history).status, 'settled');
});

test('schedule projections never accrue interest or change the recorded balance', () => {
  const debt = record();
  const history = opening(debt);
  const before = projectLedger(debt, history);
  projectInstallments(debt, history, createMonthlySchedule(debt.id, '2026-10-31', rupees(500), 12), '2027-12-31');
  assert.deepEqual(projectLedger(debt, history), before);
  assert.throws(() => createMonthlySchedule(debt.id, '2026-10-31', rupees(500), 601));
});

test('a deterministic series of advances and payments conserves every paise', () => {
  const debt = record();
  let history = opening(debt, 1);
  let expected = 100;
  for (let i = 1; i <= 80; i += 1) {
    const id = String(i).padStart(3, '0');
    const amount = i % 2 === 1 ? i + 100 : Math.min(i, expected);
    history = postEntry(debt, history, draft(debt, id, i % 2 === 1 ? 'advance' : 'payment', 0, {
      principalMinor: amount,
    }), context(id));
    expected += i % 2 === 1 ? amount : -amount;
    assert.equal(projectLedger(debt, history).outstandingMinor, expected);
  }
});

test('fees do not silently complete an EMI, while explicit contractual allocations can include them', () => {
  const debt = record();
  let history = opening(debt, 10000, 0, 1000);
  history = post(debt, history, 'payment', 'payment', 4000, { feesMinor: rupees(1000) });
  const schedule = createMonthlySchedule(debt.id, '2026-10-10', rupees(5000), 1);
  const projected = projectInstallments(debt, history, schedule, '2026-10-27');
  assert.equal(projected.installments[0].remainingMinor, rupees(1000));
  assert.equal(projected.unallocatedCashMinor, rupees(1000));
  const explicit = correctEntry(debt, history, 'payment', 'revision-payment',
    draft(debt, 'payment', 'payment', 4000, {
      feesMinor: rupees(1000), reason: 'Agreement includes this fee in the installment',
      allocations: [{ installmentId: schedule[0].id, amountMinor: rupees(5000) }],
    }), context('fee-allocation'));
  assert.equal(projectInstallments(debt, explicit, schedule, '2026-10-27').installments[0].status, 'paid');
});

test('partial manual allocation preserves unapplied cash explicitly instead of inventing an installment payment', () => {
  const debt = record();
  const schedule = createMonthlySchedule(debt.id, '2026-10-10', rupees(5000), 1);
  const history = post(debt, opening(debt), 'payment', 'payment', 3000, {
    allocations: [{ installmentId: schedule[0].id, amountMinor: rupees(2000) }],
  });
  const result = projectInstallments(debt, history, schedule, '2026-10-27');
  assert.equal(result.installments[0].paidMinor, rupees(2000));
  assert.equal(result.unallocatedCashMinor, rupees(1000));
  assert.equal(projectLedger(debt, history).cashPaidMinor, rupees(3000));
});

test('same-day charges precede payments even with identical timestamps and reversed import ordering', () => {
  const debt = record();
  let history = opening(debt);
  history = post(debt, history, 'z-interest', 'interest_charge', 0, { interestMinor: rupees(1000) });
  history = post(debt, history, 'a-payment', 'payment', 4000, { interestMinor: rupees(1000) });
  assert.deepEqual(projectLedger(debt, [...history].reverse()), projectLedger(debt, history));
  assert.equal(projectLedger(debt, history).outstandingMinor, rupees(6000));
});

test('revision parent identity permits a valid correction despite clock skew between devices', () => {
  const debt = record();
  const history = post(debt, opening(debt), 'payment', 'payment', 3000);
  const corrected = correctEntry(debt, history, 'payment', 'revision-payment',
    draft(debt, 'payment', 'payment', 2000, { reason: 'Receipt correction on a device with an earlier clock' }),
    { ...context('clock-skew'), recordedAt: '2026-10-27T11:59:00.000Z' });
  assert.equal(projectLedger(debt, corrected).outstandingMinor, rupees(8000));
  assert.equal(corrected.at(-1)?.previousRevisionId, 'revision-payment');
});

test('a present but malformed closure date cannot be treated as an open record', () => {
  const debt = record();
  assert.throws(() => projectLedger({ ...debt, closedOn: '' }, opening(debt)));
});
