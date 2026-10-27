import { assertDateOnly, monthlyDate, type DateOnly } from './dates.ts';
import { currentEntries, entryTotal, LedgerError, projectLedger, type DebtRecord, type EntryRevision } from './ledger.ts';
import { addMoney, assertMinorUnits, type MinorUnits } from './money.ts';

export interface Installment {
  readonly id: string;
  readonly recordId: string;
  readonly dueOn: DateOnly;
  readonly amountMinor: MinorUnits;
}

export interface InstallmentState extends Installment {
  readonly paidMinor: MinorUnits;
  readonly remainingMinor: MinorUnits;
  readonly status: 'upcoming' | 'due_today' | 'overdue' | 'paid';
}

export function createMonthlySchedule(recordId: string, firstDueOn: DateOnly,
  amountMinor: MinorUnits, count: number): readonly Installment[] {
  assertDateOnly(firstDueOn);
  assertMinorUnits(amountMinor);
  if (!recordId.trim() || amountMinor === 0 || !Number.isInteger(count) || count < 1 || count > 600) {
    throw new LedgerError('INVALID', 'A schedule requires a record, positive amount, and 1–600 installments.');
  }
  return Array.from({ length: count }, (_, offset) => ({
    id: `${recordId}:monthly:${firstDueOn}:${offset}`, recordId,
    dueOn: monthlyDate(firstDueOn, offset), amountMinor,
  }));
}

/** Scheduled obligations are projections; generating them never creates interest or ledger charges. */
export function projectInstallments(record: DebtRecord, history: readonly EntryRevision[],
  installments: readonly Installment[], today: DateOnly): {
    readonly installments: readonly InstallmentState[];
    readonly unallocatedCashMinor: MinorUnits;
    readonly principalPrepaidMinor: MinorUnits;
  } {
  assertDateOnly(today);
  projectLedger(record, history);
  const ids = new Set<string>();
  const states = [...installments].sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.id.localeCompare(b.id))
    .map((installment) => {
      assertDateOnly(installment.dueOn);
      assertMinorUnits(installment.amountMinor);
      if (installment.recordId !== record.id || !installment.id.trim() || ids.has(installment.id)
          || installment.amountMinor <= 0 || installment.dueOn < record.trackingStartedOn) {
        throw new LedgerError('INVALID', 'Invalid or duplicate installment.');
      }
      ids.add(installment.id);
      return { ...installment, paidMinor: 0 };
    });
  const byId = new Map(states.map((installment) => [installment.id, installment]));
  let unallocatedCashMinor = 0;
  let principalPrepaidMinor = 0;
  for (const entry of currentEntries(record, history)) {
    if (entry.kind !== 'payment' || entry.effectiveOn > today) continue;
    if (entry.paymentMode === 'principal_only') {
      principalPrepaidMinor = addMoney(principalPrepaidMinor, entry.principalMinor);
      continue;
    }
    if (entry.allocations) {
      let allocated = 0;
      for (const allocation of entry.allocations) {
        const installment = byId.get(allocation.installmentId);
        if (!installment || addMoney(installment.paidMinor, allocation.amountMinor) > installment.amountMinor) {
          throw new LedgerError('INVALID', 'Explicit payment allocation targets a missing or overpaid installment.');
        }
        installment.paidMinor = addMoney(installment.paidMinor, allocation.amountMinor);
        allocated = addMoney(allocated, allocation.amountMinor);
      }
      unallocatedCashMinor = addMoney(unallocatedCashMinor, entryTotal(entry) - allocated);
    } else {
      // Fees are separate from the scheduled EMI unless explicitly allocated by the user/contract.
      let remaining = addMoney(entry.principalMinor, entry.interestMinor);
      unallocatedCashMinor = addMoney(unallocatedCashMinor, entry.feesMinor);
      for (const installment of states) {
        const applied = Math.min(remaining, installment.amountMinor - installment.paidMinor);
        installment.paidMinor = addMoney(installment.paidMinor, applied);
        remaining -= applied;
        if (remaining === 0) break;
      }
      unallocatedCashMinor = addMoney(unallocatedCashMinor, remaining);
    }
  }
  return {
    installments: states.map((installment) => {
      const remainingMinor = installment.amountMinor - installment.paidMinor;
      return { ...installment, remainingMinor, status: remainingMinor === 0 ? 'paid'
        : installment.dueOn < today ? 'overdue' : installment.dueOn === today ? 'due_today' : 'upcoming' };
    }),
    unallocatedCashMinor, principalPrepaidMinor,
  };
}
