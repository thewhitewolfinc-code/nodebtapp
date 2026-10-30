import { DEFAULT_CATEGORIES } from '../../domain/categories';
import { createMonthlySchedule } from '../../domain/installments';
import type { EntryRevision } from '../../domain/ledger';
import type { GuestRecord, GuestSnapshot } from '../../storage/models';
/** Explicit development-only, in-memory design samples. Never passed to a repository. */
const record = (id: string, title: string, direction: 'borrowed' | 'lent', categoryId: string, extra: Partial<GuestRecord> = {}): GuestRecord => ({
  id, title, direction, categoryId, currency: 'INR', counterparty: direction === 'borrowed' ? 'Example lender' : 'Maya Sharma',
  kind: direction === 'borrowed' ? 'loan' : 'informal', interestMode: 'interest_free', minorUnitScale: 2, createdAt: '2026-10-01T08:00:00.000Z',
  trackingStartedOn: '2026-10-01', archived: false, allowsPrincipalOnlyPrepayment: true, version: 2, ...extra,
});
const home = record('preview-home', 'Home loan', 'borrowed', 'borrowed:home_loan', { counterparty: 'Example Home Finance', interestMode: 'manual_interest' });
const friend = record('preview-friend', 'Personal lending', 'lent', 'lent:friends');
const card = record('preview-card', 'Credit card', 'borrowed', 'borrowed:credit_card', { counterparty: 'Example Bank', kind: 'credit_card', version: 3 });
const archived = record('preview-archived', 'Family lending', 'lent', 'lent:family', { counterparty: 'Arjun', archived: true });
const closed = record('preview-closed', 'Education loan', 'borrowed', 'borrowed:education_loan', { closedOn: '2026-10-21' });
function opening(row: GuestRecord, principalMinor: number, interestMinor = 0): EntryRevision {
  return { id: `${row.id}-opening`, recordId: row.id, kind: 'opening_balance', principalMinor, interestMinor, feesMinor: 0,
    effectiveOn: row.trackingStartedOn, recordedAt: row.createdAt, revisionId: `${row.id}-opening-r1`, revision: 1, state: 'posted' };
}
function payment(row: GuestRecord, principalMinor: number, interestMinor = 0): EntryRevision {
  return { id: `${row.id}-payment`, recordId: row.id, kind: 'payment', principalMinor, interestMinor, feesMinor: 0,
    effectiveOn: '2026-10-20', recordedAt: '2026-10-20T10:30:00.000Z', revisionId: `${row.id}-payment-r1`, revision: 1, state: 'posted', paymentMode: 'installment' };
}
const cardPayment = payment(card, 100000);
const records = [closed, home, card, archived, friend];
export const designSnapshot: GuestSnapshot = {
  records, onboardingComplete: true,
  categories: [...DEFAULT_CATEGORIES, { id: 'preview-custom', direction: 'borrowed', name: 'Travel expenses', kind: 'custom', freeDefault: false, archived: false, sortOrder: 100 }],
  revisions: [opening(home, 15000000, 20000), payment(home, 200000, 20000), opening(friend, 2000000), payment(friend, 500000),
    opening(card, 2400000), cardPayment, { ...cardPayment, principalMinor: 125000, revision: 2, previousRevisionId: cardPayment.revisionId,
      revisionId: `${card.id}-payment-r2`, recordedAt: '2026-10-21T10:30:00.000Z', reason: 'Corrected the amount against the payment receipt.' },
    opening(archived, 500000), opening(closed, 1000000), payment(closed, 1000000)],
  installments: [...createMonthlySchedule(home.id, '2026-10-15', 350000, 4), ...createMonthlySchedule(friend.id, '2026-11-05', 1000000, 2)],
  recordEvents: records.map((row) => ({ id: `${row.id}-created`, recordId: row.id, kind: 'created', recordedAt: row.createdAt, version: 1, record: { ...row, version: 1, closedOn: undefined, archived: false } })),
};
