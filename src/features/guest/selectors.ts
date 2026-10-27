import { currentEntries, portfolioTotals, projectLedger, type EntryKind } from '../../domain/ledger.ts';
import { projectInstallments } from '../../domain/installments.ts';
import { addMoney } from '../../domain/money.ts';
import type { GuestRecord, GuestSnapshot } from '../../storage/models.ts';

export const directionLabel = (direction: GuestRecord['direction']) => direction === 'borrowed' ? 'Money I Owe' : 'Money Owed to Me';
export const statusLabels = { active: 'Outstanding', paid_off: 'Paid off', settled: 'Settled / forgiven', written_off: 'Written off', closed_adjusted: 'Closed by adjustment' };
export function entryLabel(kind: EntryKind, direction: GuestRecord['direction']): string {
  const labels: Record<EntryKind, string> = {
    opening_balance: 'Opening balance', advance: direction === 'borrowed' ? 'Additional borrowing / charge' : 'Additional lending',
    payment: direction === 'borrowed' ? 'Repayment' : 'Collection', interest_charge: 'Interest charge', fee_charge: 'Fee charge',
    adjustment: 'Balance adjustment', forgiveness: 'Forgiveness', write_off: 'Write-off',
  };
  return labels[kind];
}
export function selectRecord(snapshot: GuestSnapshot, id: string, today: string) {
  const record = snapshot.records.find((candidate) => candidate.id === id);
  if (!record) return undefined;
  const history = snapshot.revisions.filter((entry) => entry.recordId === id);
  return { record, history, ledger: projectLedger(record, history), entries: currentEntries(record, history),
    category: snapshot.categories.find((category) => category.id === record.categoryId)!,
    schedule: projectInstallments(record, history, snapshot.installments.filter((row) => row.recordId === id), today) };
}
export function selectDashboard(snapshot: GuestSnapshot, today: string) {
  const totals = portfolioTotals(snapshot.records, snapshot.revisions);
  let repaidMinor = 0;
  let collectedMinor = 0;
  const due: { record: GuestRecord; dueOn: string; remainingMinor: number; status: string }[] = [];
  for (const record of snapshot.records) {
    const detail = selectRecord(snapshot, record.id, today)!;
    if (record.direction === 'borrowed') repaidMinor = addMoney(repaidMinor, detail.ledger.cashPaidMinor);
    else collectedMinor = addMoney(collectedMinor, detail.ledger.cashPaidMinor);
    if (!record.closedOn && detail.ledger.outstandingMinor > 0 && !record.archived) {
      for (const installment of detail.schedule.installments) if (installment.remainingMinor > 0) {
        due.push({ record, ...installment });
      }
    }
  }
  return { ...totals, repaidMinor, collectedMinor, due: due.sort((a, b) => a.dueOn.localeCompare(b.dueOn)),
    recordCount: snapshot.records.length };
}
export function selectActivity(snapshot: GuestSnapshot, recordId?: string) {
  const latest = new Map<string, number>();
  for (const entry of snapshot.revisions) latest.set(entry.id, Math.max(latest.get(entry.id) ?? 0, entry.revision));
  return snapshot.revisions.filter((entry) => !recordId || entry.recordId === recordId)
    .map((entry) => ({ entry, record: snapshot.records.find((record) => record.id === entry.recordId)!,
      isCurrent: latest.get(entry.id) === entry.revision }))
    .sort((a, b) => b.entry.recordedAt.localeCompare(a.entry.recordedAt) || b.entry.revision - a.entry.revision
      || b.entry.revisionId.localeCompare(a.entry.revisionId));
}