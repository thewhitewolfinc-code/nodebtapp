import { assertDateOnly, assertTimestamp, type DateOnly } from './dates.ts';
import { addMoney, assertMinorUnits, type Currency, type MinorUnits } from './money.ts';

export type Direction = 'borrowed' | 'lent';
export type EntryKind = 'opening_balance' | 'advance' | 'payment' | 'interest_charge'
  | 'fee_charge' | 'adjustment' | 'forgiveness' | 'write_off';

export interface DebtRecord {
  readonly id: string;
  readonly title: string;
  readonly direction: Direction;
  readonly currency: Currency;
  readonly trackingStartedOn: DateOnly;
  readonly archived: boolean;
  readonly closedOn?: DateOnly;
  /** Unknown contract terms never silently grant principal-only prepayments. */
  readonly allowsPrincipalOnlyPrepayment: boolean;
}

export interface Components {
  readonly principalMinor: MinorUnits;
  readonly interestMinor: MinorUnits;
  readonly feesMinor: MinorUnits;
}

export interface InstallmentAllocation {
  readonly installmentId: string;
  readonly amountMinor: MinorUnits;
}

export interface EntryDraft extends Components {
  readonly id: string;
  readonly recordId: string;
  readonly kind: EntryKind;
  readonly effectiveOn: DateOnly;
  readonly reason?: string;
  readonly paymentMode?: 'installment' | 'principal_only';
  /** Absent means FIFO. Present means explicit allocations; any remainder is reported as unallocated cash. */
  readonly allocations?: readonly InstallmentAllocation[];
}

/** Revisions are append-only. Concurrent branches are rejected, never last-write-wins. */
export interface EntryRevision extends EntryDraft {
  readonly revisionId: string;
  readonly revision: number;
  readonly previousRevisionId?: string;
  readonly recordedAt: string;
  readonly state: 'posted' | 'void';
}

export interface RevisionContext {
  readonly revisionId: string;
  readonly recordedAt: string;
  /** Supplied by the caller in the user's local calendar, not derived from UTC. */
  readonly today: DateOnly;
}

export interface LedgerProjection extends Components {
  readonly outstandingMinor: MinorUnits;
  readonly cashPaidMinor: MinorUnits;
  readonly principalPaidMinor: MinorUnits;
  readonly interestPaidMinor: MinorUnits;
  readonly feesPaidMinor: MinorUnits;
  readonly forgivenMinor: MinorUnits;
  readonly writtenOffMinor: MinorUnits;
  readonly adjustedMinor: MinorUnits;
  readonly status: 'active' | 'paid_off' | 'settled' | 'written_off' | 'closed_adjusted';
}

export class LedgerError extends Error {
  readonly code: 'INVALID' | 'CONFLICT' | 'CLOSED' | 'OVERPAYMENT';
  constructor(code: LedgerError['code'], message: string) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
  }
}

const kinds = new Set<EntryKind>([
  'opening_balance', 'advance', 'payment', 'interest_charge', 'fee_charge',
  'adjustment', 'forgiveness', 'write_off',
]);

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new LedgerError('INVALID', message);
}

export function entryTotal(entry: Components): MinorUnits {
  return addMoney(entry.principalMinor, entry.interestMinor, entry.feesMinor);
}

function validateRecord(record: DebtRecord): void {
  requireValue(typeof record.id === 'string' && !!record.id.trim(), 'A record ID is required.');
  requireValue(typeof record.title === 'string' && !!record.title.trim(), 'A title is required.');
  requireValue(record.currency === 'INR', 'Only INR records are supported at launch.');
  requireValue(record.direction === 'borrowed' || record.direction === 'lent', 'Invalid direction.');
  requireValue(typeof record.archived === 'boolean', 'Archive state is required.');
  requireValue(typeof record.allowsPrincipalOnlyPrepayment === 'boolean', 'Prepayment policy is required.');
  assertDateOnly(record.trackingStartedOn);
  if (record.closedOn !== undefined) {
    assertDateOnly(record.closedOn);
    requireValue(record.closedOn >= record.trackingStartedOn, 'Closure cannot precede tracking.');
  }
}

function validateEntry(record: DebtRecord, entry: EntryDraft): void {
  requireValue(typeof entry.id === 'string' && !!entry.id.trim(), 'An entry ID is required.');
  requireValue(entry.recordId === record.id, 'Entry belongs to a different record.');
  requireValue(kinds.has(entry.kind), 'Unknown financial entry type.');
  assertDateOnly(entry.effectiveOn);
  requireValue(entry.effectiveOn >= record.trackingStartedOn, 'Entry predates the opening snapshot.');
  for (const field of ['principalMinor', 'interestMinor', 'feesMinor'] as const) {
    assertMinorUnits(entry[field], field, entry.kind === 'adjustment');
  }
  const total = entryTotal(entry);
  requireValue(entry.kind === 'adjustment'
    ? [entry.principalMinor, entry.interestMinor, entry.feesMinor].some((amount) => amount !== 0)
    : total > 0, 'An entry must have a nonzero amount.');
  if (entry.kind === 'opening_balance') {
    requireValue(entry.effectiveOn === record.trackingStartedOn, 'Opening snapshot must use tracking start date.');
  }
  if (entry.kind === 'advance') {
    requireValue(entry.interestMinor === 0 && entry.feesMinor === 0, 'Additional borrowing/lending is principal only.');
  }
  if (entry.kind === 'interest_charge') {
    requireValue(entry.principalMinor === 0 && entry.feesMinor === 0, 'Interest charge has only interest.');
  }
  if (entry.kind === 'fee_charge') {
    requireValue(entry.principalMinor === 0 && entry.interestMinor === 0, 'Fee charge has only fees.');
  }
  if (entry.kind === 'adjustment' || entry.kind === 'forgiveness' || entry.kind === 'write_off') {
    requireValue(typeof entry.reason === 'string' && !!entry.reason.trim(), 'A recorded reason is required.');
  }
  requireValue(entry.kind !== 'forgiveness' || record.direction === 'borrowed', 'Only borrowing can be forgiven.');
  requireValue(entry.kind !== 'write_off' || record.direction === 'lent', 'Only lending can be written off.');
  if (entry.kind !== 'payment') {
    requireValue(entry.paymentMode === undefined && entry.allocations === undefined, 'Only payments have allocations.');
  } else {
    requireValue(entry.paymentMode === 'installment' || entry.paymentMode === 'principal_only', 'Choose payment allocation mode.');
    if (entry.paymentMode === 'principal_only') {
      requireValue(record.allowsPrincipalOnlyPrepayment, 'The debt terms do not support principal-only prepayments.');
      requireValue(entry.interestMinor === 0 && entry.feesMinor === 0 && entry.allocations === undefined,
        'Principal-only prepayments cannot include interest, fees, or installment allocations.');
    }
    if (entry.allocations !== undefined) {
      const ids = new Set<string>();
      let allocated = 0;
      for (const allocation of entry.allocations) {
        requireValue(!!allocation.installmentId && !ids.has(allocation.installmentId), 'Duplicate or missing installment ID.');
        ids.add(allocation.installmentId);
        assertMinorUnits(allocation.amountMinor);
        requireValue(allocation.amountMinor > 0, 'An allocation must be positive.');
        allocated = addMoney(allocated, allocation.amountMinor);
      }
      requireValue(allocated <= total, 'Explicit allocations cannot exceed the cash payment.');
    }
  }
}

// Calendar dates have no intraday precision. Apply same-day charges before settlements,
// so identical timestamps or import ordering cannot put a payment before its charge.
function postingRank(entry: EntryDraft): number {
  if (entry.kind === 'opening_balance') return 0;
  if (['advance', 'interest_charge', 'fee_charge'].includes(entry.kind)) return 1;
  if (entry.kind === 'adjustment') {
    return Math.min(entry.principalMinor, entry.interestMinor, entry.feesMinor) >= 0 ? 1 : 3;
  }
  return 2;
}

/** Validate complete revision chains before deriving financial state from imported or stored data. */
export function currentEntries(record: DebtRecord, history: readonly EntryRevision[]): readonly EntryRevision[] {
  validateRecord(record);
  const ids = new Set<string>();
  const chains = new Map<string, EntryRevision[]>();
  for (const revision of history) {
    validateEntry(record, revision);
    requireValue(typeof revision.revisionId === 'string' && !!revision.revisionId.trim(), 'A revision ID is required.');
    if (ids.has(revision.revisionId)) throw new LedgerError('CONFLICT', 'Duplicate revision ID.');
    ids.add(revision.revisionId);
    assertTimestamp(revision.recordedAt);
    requireValue(Number.isSafeInteger(revision.revision) && revision.revision > 0, 'Invalid revision number.');
    requireValue(revision.state === 'posted' || revision.state === 'void', 'Invalid revision state.');
    const chain = chains.get(revision.id) ?? [];
    chain.push(revision);
    chains.set(revision.id, chain);
  }
  const firstRecorded = new Map<string, string>();
  const active: EntryRevision[] = [];
  let openingCount = 0;
  for (const [id, unordered] of chains) {
    const chain = [...unordered].sort((a, b) => a.revision - b.revision);
    chain.forEach((revision, index) => {
      const previous = chain[index - 1];
      if (revision.revision !== index + 1 || revision.previousRevisionId !== previous?.revisionId) {
        throw new LedgerError('CONFLICT', 'Revision history has a gap or concurrent branch; resolve it before continuing.');
      }
      requireValue(index !== 0 || revision.state === 'posted', 'An entry must start with a posted revision.');
      requireValue(revision.kind === chain[0].kind, 'Revision cannot change transaction type.');
      // Parent revision identity, not a device clock, establishes correction order.
      if (index > 0) requireValue(!!revision.reason?.trim(), 'Corrections require a recorded reason.');
    });
    const latest = chain[chain.length - 1];
    if (latest.kind === 'opening_balance') {
      openingCount += 1;
      requireValue(latest.state !== 'void', 'The opening snapshot cannot be removed.');
    }
    firstRecorded.set(id, chain[0].recordedAt);
    if (latest.state === 'posted') active.push(latest);
  }
  requireValue(openingCount === 1, 'A record must have exactly one opening snapshot.');
  return active.sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn)
    || postingRank(a) - postingRank(b)
    || firstRecorded.get(a.id)!.localeCompare(firstRecorded.get(b.id)!) || a.id.localeCompare(b.id));
}

export function projectLedger(record: DebtRecord, history: readonly EntryRevision[]): LedgerProjection {
  const entries = currentEntries(record, history);
  let principalMinor = 0;
  let interestMinor = 0;
  let feesMinor = 0;
  let principalPaidMinor = 0;
  let interestPaidMinor = 0;
  let feesPaidMinor = 0;
  let forgivenMinor = 0;
  let writtenOffMinor = 0;
  let adjustedMinor = 0;
  for (const entry of entries) {
    const reduction = ['payment', 'forgiveness', 'write_off'].includes(entry.kind);
    const sign = reduction ? -1 : 1;
    principalMinor = addMoney(principalMinor, sign * entry.principalMinor);
    interestMinor = addMoney(interestMinor, sign * entry.interestMinor);
    feesMinor = addMoney(feesMinor, sign * entry.feesMinor);
    if (Math.min(principalMinor, interestMinor, feesMinor) < 0) {
      throw new LedgerError('OVERPAYMENT', 'Entry would overdraw a principal, interest, or fee balance. Record any unrecorded charge explicitly.');
    }
    if (entry.kind === 'payment') {
      principalPaidMinor = addMoney(principalPaidMinor, entry.principalMinor);
      interestPaidMinor = addMoney(interestPaidMinor, entry.interestMinor);
      feesPaidMinor = addMoney(feesPaidMinor, entry.feesMinor);
    }
    if (entry.kind === 'forgiveness') forgivenMinor = addMoney(forgivenMinor, entryTotal(entry));
    if (entry.kind === 'write_off') writtenOffMinor = addMoney(writtenOffMinor, entryTotal(entry));
    if (entry.kind === 'adjustment') adjustedMinor = addMoney(adjustedMinor, entryTotal(entry));
  }
  const outstandingMinor = addMoney(principalMinor, interestMinor, feesMinor);
  requireValue(!record.closedOn || outstandingMinor === 0, 'A closed record must have zero outstanding balance.');
  if (record.closedOn) {
    requireValue(entries.every((entry) => entry.effectiveOn <= record.closedOn!), 'Closure predates a financial entry.');
  }
  const status: LedgerProjection['status'] = outstandingMinor > 0 ? 'active'
    : writtenOffMinor > 0 ? 'written_off' : forgivenMinor > 0 ? 'settled'
      : adjustedMinor < 0 ? 'closed_adjusted' : 'paid_off';
  return {
    principalMinor, interestMinor, feesMinor, outstandingMinor,
    cashPaidMinor: addMoney(principalPaidMinor, interestPaidMinor, feesPaidMinor),
    principalPaidMinor, interestPaidMinor, feesPaidMinor, forgivenMinor, writtenOffMinor, adjustedMinor, status,
  };
}

function validateContext(context: RevisionContext, entry: EntryDraft): void {
  assertTimestamp(context.recordedAt);
  assertDateOnly(context.today);
  requireValue(entry.effectiveOn <= context.today, 'Future amounts belong in schedules, not confirmed transactions.');
}

function copyDraft(entry: EntryDraft): EntryDraft {
  // Whitelist fields: callers cannot inject revision metadata through object spreads.
  return {
    id: entry.id, recordId: entry.recordId, kind: entry.kind, effectiveOn: entry.effectiveOn,
    principalMinor: entry.principalMinor, interestMinor: entry.interestMinor, feesMinor: entry.feesMinor,
    reason: entry.reason, paymentMode: entry.paymentMode,
    allocations: entry.allocations?.map((allocation) => ({ ...allocation })),
  };
}

export function postEntry(record: DebtRecord, history: readonly EntryRevision[], draft: EntryDraft,
  context: RevisionContext): readonly EntryRevision[] {
  if (record.closedOn) throw new LedgerError('CLOSED', 'Reopen the record before adding a financial entry.');
  validateContext(context, draft);
  if (history.some((entry) => entry.id === draft.id)) throw new LedgerError('CONFLICT', 'Transaction ID already exists.');
  const entry: EntryRevision = {
    ...copyDraft(draft), revision: 1, revisionId: context.revisionId, recordedAt: context.recordedAt, state: 'posted',
  };
  const next = [...history, entry];
  projectLedger(record, next);
  return next;
}

export function correctEntry(record: DebtRecord, history: readonly EntryRevision[], entryId: string,
  expectedRevisionId: string, replacement: EntryDraft, context: RevisionContext,
  state: 'posted' | 'void' = 'posted'): readonly EntryRevision[] {
  if (record.closedOn) throw new LedgerError('CLOSED', 'Reopen the record before correcting a financial entry.');
  // Validate the original history even when an attempted correction would hide an invalid branch.
  currentEntries(record, history);
  const current = history.filter((entry) => entry.id === entryId).sort((a, b) => b.revision - a.revision)[0];
  requireValue(current, 'Transaction not found.');
  if (current.revisionId !== expectedRevisionId) throw new LedgerError('CONFLICT', 'This transaction changed on another device.');
  requireValue(replacement.id === current.id && replacement.kind === current.kind,
    'Corrections must preserve transaction identity and type.');
  validateContext(context, replacement);
  const next: readonly EntryRevision[] = [...history, {
    ...copyDraft(replacement), revision: current.revision + 1, previousRevisionId: current.revisionId,
    revisionId: context.revisionId, recordedAt: context.recordedAt, state,
  }];
  projectLedger(record, next);
  return next;
}

export function closeRecord(record: DebtRecord, history: readonly EntryRevision[], closedOn: DateOnly): DebtRecord {
  assertDateOnly(closedOn);
  requireValue(projectLedger(record, history).outstandingMinor === 0, 'Repay, settle, or adjust the full recorded balance before closure.');
  const closed = { ...record, closedOn };
  projectLedger(closed, history);
  return closed;
}

export function reopenRecord(record: DebtRecord): DebtRecord {
  validateRecord(record);
  const { closedOn: _closedOn, ...open } = record;
  return open;
}

export function portfolioTotals(records: readonly DebtRecord[], history: readonly EntryRevision[]): {
  readonly owedMinor: MinorUnits; readonly receivableMinor: MinorUnits;
} {
  const ids = new Set<string>();
  let owedMinor = 0;
  let receivableMinor = 0;
  for (const record of records) {
    requireValue(!ids.has(record.id), 'Duplicate record in portfolio.');
    ids.add(record.id);
    const amount = projectLedger(record, history.filter((entry) => entry.recordId === record.id)).outstandingMinor;
    // Archiving changes visibility only; it never removes an outstanding obligation from totals.
    if (record.direction === 'borrowed') owedMinor = addMoney(owedMinor, amount);
    else receivableMinor = addMoney(receivableMinor, amount);
  }
  requireValue(history.every((entry) => ids.has(entry.recordId)), 'Orphan financial entry in portfolio.');
  return { owedMinor, receivableMinor };
}
