import { launch } from '../config/product.ts';
import { assertCanCreateCategory, canAssignCategory, DEFAULT_CATEGORIES, type Category, type CategoryAccess } from '../domain/categories.ts';
import { assertDateOnly, assertTimestamp } from '../domain/dates.ts';
import { createMonthlySchedule, projectInstallments, type Installment } from '../domain/installments.ts';
import { closeRecord, correctEntry, entryTotal, LedgerError, portfolioTotals, postEntry, projectLedger, reopenRecord,
  type EntryDraft, type EntryRevision } from '../domain/ledger.ts';
import { assertMinorUnits } from '../domain/money.ts';
import { LocalDatabase, type SqlConnection } from './database.ts';
import { migrateDatabase } from './migrations.ts';
import type { CommandResult, GuestCommand, GuestRecord, GuestSnapshot, RecordEvent } from './models.ts';

export interface RepositoryServices {
  readonly id: () => string;
  readonly now: () => string;
  readonly today: () => string;
  readonly access: () => CategoryAccess;
}
function requireInput(condition: unknown, message: string): asserts condition {
  if (!condition) throw new LedgerError('INVALID', message);
}
function canonical(value: unknown): string {
  return JSON.stringify(value, function (_key, current) {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return Object.fromEntries(Object.keys(current).sort().map((key) => [key, current[key]]));
    }
    return current;
  });
}
function decode<T>(rows: { payload: string }[]): T[] {
  return rows.map((row) => JSON.parse(row.payload) as T);
}

/** Local-only guest command boundary. All financial projections remain in the existing domain engine. */
export class GuestRepository {
  private readonly database: LocalDatabase;
  private readonly services: RepositoryServices;
  constructor(database: LocalDatabase, services: RepositoryServices) {
    this.database = database;
    this.services = services;
  }
  async initialize(): Promise<GuestSnapshot> {
    await migrateDatabase(this.database);
    return this.snapshot();
  }
  close(): Promise<void> { return this.database.close(); }
  snapshot(): Promise<GuestSnapshot> { return this.database.read((sql) => this.readSnapshot(sql)); }

  private async readSnapshot(sql: SqlConnection): Promise<GuestSnapshot> {
    const records = decode<GuestRecord>(await sql.all<{ payload: string }>('SELECT payload FROM records ORDER BY id'));
    const revisions = decode<EntryRevision>(await sql.all<{ payload: string }>('SELECT payload FROM revisions ORDER BY record_id,entry_id,revision_number'));
    const installments = decode<Installment>(await sql.all<{ payload: string }>('SELECT payload FROM installments ORDER BY id'));
    const categories = decode<Category>(await sql.all<{ payload: string }>('SELECT payload FROM categories ORDER BY direction,kind,name'));
    const recordEvents = decode<RecordEvent>(await sql.all<{ payload: string }>('SELECT payload FROM record_events ORDER BY id'));
    const settings = await sql.all<{ payload: string }>("SELECT payload FROM settings WHERE key='onboarding_complete'");
    const categoryIds = new Set<string>();
    for (const category of categories) {
      requireInput(typeof category.id === 'string' && !categoryIds.has(category.id), 'Invalid stored category identity.');
      categoryIds.add(category.id);
      requireInput(['borrowed', 'lent'].includes(category.direction) && typeof category.name === 'string'
        && !!category.name.trim() && typeof category.archived === 'boolean', 'Invalid stored category.');
      if (category.kind === 'default') {
        const original = DEFAULT_CATEGORIES.find((candidate) => candidate.id === category.id);
        requireInput(original && canonical(original) === canonical(category), 'Default catalog does not match this application version.');
      } else requireInput(category.kind === 'custom' && category.freeDefault === false, 'Invalid stored custom category.');
    }
    requireInput(DEFAULT_CATEGORIES.every((category) => categoryIds.has(category.id)), 'Default catalog is incomplete.');
    portfolioTotals(records, revisions);
    for (const record of records) {
      requireInput(Number.isSafeInteger(record.version) && record.version > 0 && record.minorUnitScale === launch.minorUnitScale,
        'Unsupported stored record version or money scale.');
      const category = categories.find((candidate) => candidate.id === record.categoryId);
      requireInput(category && category.direction === record.direction, 'A record has an invalid category assignment.');
      requireInput(['interest_free', 'manual_interest'].includes(record.interestMode), 'Unsupported interest mode.');
      const history = revisions.filter((entry) => entry.recordId === record.id);
      projectInstallments(record, history, installments.filter((row) => row.recordId === record.id), this.services.today());
    }
    requireInput(installments.every((row) => records.some((record) => record.id === row.recordId)), 'Orphan installment.');
    return { records, revisions, installments, categories, recordEvents,
      onboardingComplete: settings.length > 0 && JSON.parse(settings[0].payload) === true };
  }

  /** An acknowledged retry returns the committed result without repeating any money operation. */
  execute(operationId: string, command: GuestCommand): Promise<CommandResult> {
    requireInput(typeof operationId === 'string' && operationId.length > 0 && operationId.length <= 200, 'An operation ID is required.');
    const request = canonical(command);
    return this.database.transaction(async (sql) => {
      const receipts = await sql.all<{ request: string; result: string }>('SELECT request,result FROM operations WHERE id=?', [operationId]);
      if (receipts[0]) {
        if (receipts[0].request !== request) throw new LedgerError('CONFLICT', 'This operation was already saved with different inputs. Refresh before making another change.');
        const result = JSON.parse(receipts[0].result) as { recordId?: string };
        return { ...result, snapshot: await this.readSnapshot(sql) };
      }
      const now = this.services.now();
      const today = this.services.today();
      assertTimestamp(now);
      assertDateOnly(today);
      const before = await this.readSnapshot(sql);
      const result: { recordId?: string } = {};
      const context = () => ({ revisionId: this.services.id(), recordedAt: now, today });
      const access = this.services.access();
      if (command.type === 'onboard') {
        await sql.run("INSERT INTO settings(key,payload) VALUES ('onboarding_complete','true') ON CONFLICT(key) DO UPDATE SET payload=excluded.payload");
      } else if (command.type === 'create_category') {
        requireInput(command.direction === 'borrowed' || command.direction === 'lent', 'Choose a category direction.');
        const name = assertCanCreateCategory(before.categories, command.direction, command.name, access);
        const category: Category = { id: this.services.id(), direction: command.direction, name, kind: 'custom',
          freeDefault: false, archived: false, sortOrder: before.categories.length };
        await sql.run('INSERT INTO categories(id,direction,kind,name,archived,payload) VALUES (?,?,?,?,?,?)',
          [category.id, category.direction, category.kind, name, 0, JSON.stringify(category)]);
      } else if (command.type === 'change_category') {
        const category = before.categories.find((row) => row.id === command.id);
        requireInput(category?.kind === 'custom', 'Only custom categories can be renamed or archived.');
        requireInput(typeof command.archived === 'boolean', 'Choose an archive state.');
        const name = assertCanCreateCategory(before.categories, category.direction, command.name, access, category.id);
        const updated = { ...category, name, archived: command.archived };
        await sql.run('UPDATE categories SET name=?,archived=?,payload=? WHERE id=?', [name, Number(command.archived), JSON.stringify(updated), category.id]);
      } else if (command.type === 'create_record') {
        const title = command.title.trim();
        requireInput(title.length > 0 && title.length <= 120, 'Record title must contain 1–120 characters.');
        requireInput(command.counterparty.length <= 120, 'Person or lender name must be at most 120 characters.');
        requireInput(['loan', 'credit_card', 'bnpl', 'informal', 'other'].includes(command.kind), 'Choose a supported record type.');
        requireInput(['interest_free', 'manual_interest'].includes(command.interestMode), 'Choose the interest terms.');
        requireInput(command.interestMode !== 'interest_free' || command.opening.interestMinor === 0, 'Interest-free records cannot start with interest owed.');
        const category = before.categories.find((row) => row.id === command.categoryId);
        requireInput(category && category.direction === command.direction && canAssignCategory(category, access), 'Choose an available category for this direction.');
        const record: GuestRecord = {
          id: this.services.id(), title, direction: command.direction, currency: launch.currency,
          trackingStartedOn: command.trackingStartedOn, archived: false,
          allowsPrincipalOnlyPrepayment: command.allowsPrincipalOnlyPrepayment,
          categoryId: category.id, counterparty: command.counterparty.trim(), kind: command.kind,
          interestMode: command.interestMode, minorUnitScale: launch.minorUnitScale, createdAt: now, version: 1,
        };
        const history = postEntry(record, [], { ...command.opening, id: this.services.id(), recordId: record.id,
          kind: 'opening_balance', effectiveOn: command.trackingStartedOn }, context());
        const schedule = command.schedule ? createMonthlySchedule(record.id, command.schedule.firstDueOn,
          command.schedule.amountMinor, command.schedule.count) : [];
        projectInstallments(record, history, schedule, today);
        await this.insertRecord(sql, record);
        await this.insertRevisions(sql, history);
        for (const installment of schedule) {
          await sql.run('INSERT INTO installments(id,record_id,payload) VALUES (?,?,?)', [installment.id, record.id, JSON.stringify(installment)]);
        }
        await this.recordEvent(sql, record, 'created', now);
        result.recordId = record.id;
      } else {
        const current = before.records.find((record) => record.id === command.recordId);
        requireInput(current, 'Record not found.');
        if (current.version !== command.expectedVersion) throw new LedgerError('CONFLICT', 'This record changed. Refresh and review its latest balance before saving.');
        let record = current;
        const originalHistory = before.revisions.filter((entry) => entry.recordId === current.id);
        let history: readonly EntryRevision[] = originalHistory;
        if (command.type === 'settle_record') {
          requireInput(!!command.reason.trim(), 'A settlement reason is required.');
          requireInput(entryTotal(command.paid) > 0 && entryTotal(command.waived) > 0, 'A partial settlement requires both actual cash and a waived amount.');
          requireInput(record.interestMode !== 'interest_free' || (command.paid.interestMinor === 0 && command.waived.interestMinor === 0), 'Interest-free records cannot settle interest.');
          history = postEntry(record, history, { ...command.paid, id: this.services.id(), recordId: record.id,
            kind: 'payment', effectiveOn: command.effectiveOn, paymentMode: 'installment', reason: command.reason }, context());
          history = postEntry(record, history, { ...command.waived, id: this.services.id(), recordId: record.id,
            kind: record.direction === 'borrowed' ? 'forgiveness' : 'write_off', effectiveOn: command.effectiveOn, reason: command.reason }, context());
          requireInput(projectLedger(record, history).outstandingMinor === 0, 'Settlement must clear the recorded balance. Review the cash and waived components.');
        } else if (command.type === 'post_entry') {
          const newInterest = command.newInterestMinor ?? 0;
          const newFees = command.newFeesMinor ?? 0;
          assertMinorUnits(newInterest);
          assertMinorUnits(newFees);
          requireInput(command.kind === 'payment' || (newInterest === 0 && newFees === 0), 'New charges alongside an entry are only supported with a reviewed payment.');
          requireInput(current.interestMode !== 'interest_free' || (command.components.interestMinor === 0
            && newInterest === 0 && command.kind !== 'interest_charge'), 'This record is interest-free. Interest charges are not allowed.');
          if (newInterest > 0) history = postEntry(record, history, {
            id: this.services.id(), recordId: record.id, kind: 'interest_charge', effectiveOn: command.effectiveOn,
            principalMinor: 0, interestMinor: newInterest, feesMinor: 0, reason: 'Interest explicitly reviewed with payment',
          }, context());
          if (newFees > 0) history = postEntry(record, history, {
            id: this.services.id(), recordId: record.id, kind: 'fee_charge', effectiveOn: command.effectiveOn,
            principalMinor: 0, interestMinor: 0, feesMinor: newFees, reason: 'Fee explicitly reviewed with payment',
          }, context());
          history = postEntry(record, history, { ...command.components, id: this.services.id(), recordId: record.id,
            kind: command.kind, effectiveOn: command.effectiveOn, reason: command.reason,
            paymentMode: command.kind === 'payment' ? command.paymentMode ?? 'installment' : undefined }, context());
        } else if (command.type === 'correct_entry') {
          const previous = originalHistory.filter((entry) => entry.id === command.entryId).sort((a, b) => b.revision - a.revision)[0];
          requireInput(previous, 'Transaction not found.');
          requireInput(current.interestMode !== 'interest_free' || command.components.interestMinor === 0,
            'Interest-free records cannot record interest.');
          const replacement: EntryDraft = { ...previous, ...command.components, effectiveOn: command.effectiveOn,
            reason: command.reason, paymentMode: previous.kind === 'payment' ? command.paymentMode ?? previous.paymentMode : undefined };
          history = correctEntry(record, history, command.entryId, command.expectedRevisionId, replacement, context(), command.state);
        } else if (command.type === 'record_action') {
          if (command.action === 'close') record = { ...record, ...closeRecord(record, history, today) };
          else if (command.action === 'reopen') record = { ...record, ...reopenRecord(record), closedOn: undefined };
          else if (command.action === 'archive') record = { ...record, archived: true };
          else if (command.action === 'unarchive') record = { ...record, archived: false };
          else throw new LedgerError('INVALID', 'Unsupported record action.');
        } else if (command.type === 'assign_category') {
          const category = before.categories.find((row) => row.id === command.categoryId);
          requireInput(category && category.direction === record.direction && canAssignCategory(category, access, record.categoryId),
            'Choose an available category for this direction.');
          record = { ...record, categoryId: category.id };
        } else throw new LedgerError('INVALID', 'Unsupported guest command.');
        record = { ...record, version: current.version + 1 };
        projectLedger(record, history);
        projectInstallments(record, history, before.installments.filter((row) => row.recordId === record.id), today);
        const update = await sql.run('UPDATE records SET category_id=?,version=?,payload=? WHERE id=? AND version=?',
          [record.categoryId, record.version, JSON.stringify(record), record.id, current.version]);
        if (update.changes !== 1) throw new LedgerError('CONFLICT', 'Record changed during this operation.');
        const existingIds = new Set(originalHistory.map((entry) => entry.revisionId));
        await this.insertRevisions(sql, history.filter((entry) => !existingIds.has(entry.revisionId)));
        await this.recordEvent(sql, record, command.type === 'record_action' ? command.action : command.type, now);
        result.recordId = record.id;
      }
      await sql.run('INSERT INTO operations(id,request,result,recorded_at) VALUES (?,?,?,?)', [operationId, request, JSON.stringify(result), now]);
      await sql.run('INSERT INTO outbox(operation_id,payload) VALUES (?,?)', [operationId, JSON.stringify({ version: 1, currency: launch.currency, minorUnitScale: launch.minorUnitScale, command, ...result })]);
      return { ...result, snapshot: await this.readSnapshot(sql) };
    });
  }

  private async insertRecord(sql: SqlConnection, record: GuestRecord): Promise<void> {
    await sql.run('INSERT INTO records(id,direction,currency,minor_unit_scale,category_id,version,payload) VALUES (?,?,?,?,?,?,?)',
      [record.id, record.direction, record.currency, record.minorUnitScale, record.categoryId, record.version, JSON.stringify(record)]);
  }
  private async insertRevisions(sql: SqlConnection, history: readonly EntryRevision[]): Promise<void> {
    for (const revision of history) await sql.run('INSERT INTO revisions(id,record_id,entry_id,revision_number,parent_id,payload) VALUES (?,?,?,?,?,?)',
      [revision.revisionId, revision.recordId, revision.id, revision.revision, revision.previousRevisionId ?? null, JSON.stringify(revision)]);
  }
  private async recordEvent(sql: SqlConnection, record: GuestRecord, kind: string, recordedAt: string): Promise<void> {
    const event: RecordEvent = { id: this.services.id(), recordId: record.id, kind, recordedAt, version: record.version, record: { ...record } };
    await sql.run('INSERT INTO record_events(id,record_id,payload) VALUES (?,?,?)', [event.id, record.id, JSON.stringify(event)]);
  }
}