import type { Category } from '../domain/categories.ts';
import type { Installment } from '../domain/installments.ts';
import type { Components, DebtRecord, EntryDraft, EntryRevision } from '../domain/ledger.ts';

export interface GuestRecord extends DebtRecord {
  readonly categoryId: string;
  readonly counterparty: string;
  readonly kind: 'loan' | 'credit_card' | 'bnpl' | 'informal' | 'other';
  readonly interestMode: 'interest_free' | 'manual_interest';
  readonly minorUnitScale: number;
  readonly createdAt: string;
  readonly version: number;
}
export interface RecordEvent {
  readonly id: string;
  readonly recordId: string;
  readonly kind: string;
  readonly recordedAt: string;
  readonly version: number;
}
export interface GuestSnapshot {
  readonly records: readonly GuestRecord[];
  readonly revisions: readonly EntryRevision[];
  readonly installments: readonly Installment[];
  readonly categories: readonly Category[];
  readonly recordEvents: readonly RecordEvent[];
  readonly onboardingComplete: boolean;
}
export interface ScheduleInput {
  readonly firstDueOn: string;
  readonly amountMinor: number;
  readonly count: number;
}
export type GuestCommand =
  | { readonly type: 'onboard' }
  | { readonly type: 'create_category'; readonly direction: DebtRecord['direction']; readonly name: string }
  | { readonly type: 'change_category'; readonly id: string; readonly name: string; readonly archived: boolean }
  | { readonly type: 'create_record'; readonly title: string; readonly direction: DebtRecord['direction'];
      readonly categoryId: string; readonly counterparty: string; readonly kind: GuestRecord['kind'];
      readonly interestMode: GuestRecord['interestMode']; readonly trackingStartedOn: string;
      readonly allowsPrincipalOnlyPrepayment: boolean; readonly opening: Components; readonly schedule?: ScheduleInput }
  | { readonly type: 'post_entry'; readonly recordId: string; readonly expectedVersion: number;
      readonly kind: Exclude<EntryDraft['kind'], 'opening_balance'>; readonly effectiveOn: string;
      readonly components: Components; readonly reason?: string; readonly paymentMode?: EntryDraft['paymentMode'];
      readonly newInterestMinor?: number; readonly newFeesMinor?: number }
  | { readonly type: 'correct_entry'; readonly recordId: string; readonly expectedVersion: number;
      readonly entryId: string; readonly expectedRevisionId: string; readonly effectiveOn: string;
      readonly components: Components; readonly reason: string; readonly state: 'posted' | 'void';
      readonly paymentMode?: EntryDraft['paymentMode'] }
  | { readonly type: 'record_action'; readonly recordId: string; readonly expectedVersion: number;
      readonly action: 'close' | 'reopen' | 'archive' | 'unarchive' }
  | { readonly type: 'assign_category'; readonly recordId: string; readonly expectedVersion: number; readonly categoryId: string };
export interface CommandResult {
  readonly snapshot: GuestSnapshot;
  readonly recordId?: string;
}