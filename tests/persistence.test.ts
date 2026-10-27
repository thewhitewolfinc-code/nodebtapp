import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

import { DEFAULT_CATEGORIES } from '../src/domain/categories.ts';
import { currentEntries, portfolioTotals, projectLedger } from '../src/domain/ledger.ts';
import { LocalDatabase, type SqlConnection } from '../src/storage/database.ts';
import { MIGRATIONS, migrateDatabase } from '../src/storage/migrations.ts';
import type { GuestCommand, GuestSnapshot } from '../src/storage/models.ts';
import { GuestRepository } from '../src/storage/repository.ts';
import { obtainDeviceKey, unlockEncryptedConnection } from '../src/storage/security.ts';
import { selectActivity, selectDashboard, selectRecord } from '../src/features/guest/selectors.ts';
import { amountInput, installmentCount, parseAmount } from '../src/features/guest/forms.ts';
import { fixture } from './sqlite-helper.ts';

const create = (direction: 'borrowed' | 'lent' = 'borrowed', extras = {}): GuestCommand => ({
  type: 'create_record', title: direction === 'borrowed' ? 'Loan from lender' : 'Lent to friend', direction,
  categoryId: direction === 'borrowed' ? 'borrowed:personal_loan' : 'lent:friends', counterparty: 'Private label',
  kind: 'informal', interestMode: 'interest_free', trackingStartedOn: '2026-10-01',
  allowsPrincipalOnlyPrepayment: true, opening: { principalMinor: 1000000, interestMinor: 0, feesMinor: 0 }, ...extras,
});
const components = (principalMinor: number, interestMinor = 0, feesMinor = 0) => ({ principalMinor, interestMinor, feesMinor });
function view(snapshot: GuestSnapshot, id: string) {
  const record = snapshot.records.find((row) => row.id === id)!;
  const history = snapshot.revisions.filter((entry) => entry.recordId === id);
  return { record, history, ledger: projectLedger(record, history) };
}

test('fresh migration seeds exactly 16/14 defaults, with exactly 6 Free defaults in each direction and no money records', async (t) => {
  const { repository } = await fixture(t);
  const snapshot = await repository.snapshot();
  for (const [direction, count] of [['borrowed', 16], ['lent', 14]] as const) {
    assert.equal(snapshot.categories.filter((category) => category.direction === direction).length, count);
    assert.equal(snapshot.categories.filter((category) => category.direction === direction && category.freeDefault).length, 6);
  }
  assert.equal(snapshot.records.length, 0);
  assert.equal(snapshot.revisions.length, 0);
  assert.equal(snapshot.onboardingComplete, false);
});

test('guest creates borrowing and lending; actual SQLite close/reopen preserves exact balances and history offline', async (t) => {
  const { repository, services, connect } = await fixture(t);
  await repository.execute('onboard', { type: 'onboard' });
  let result = await repository.execute('borrow', create());
  const borrowedId = result.recordId!;
  result = await repository.execute('lend', create('lent'));
  const lentId = result.recordId!;
  result = await repository.execute('repay', { type: 'post_entry', recordId: borrowedId, expectedVersion: 1,
    kind: 'payment', effectiveOn: '2026-10-10', components: components(300000) });
  result = await repository.execute('collect', { type: 'post_entry', recordId: lentId, expectedVersion: 1,
    kind: 'payment', effectiveOn: '2026-10-11', components: components(250000) });
  const saved = result.snapshot;
  assert.equal(view(saved, borrowedId).ledger.outstandingMinor, 700000);
  assert.equal(view(saved, lentId).ledger.outstandingMinor, 750000);
  assert.deepEqual(portfolioTotals(saved.records, saved.revisions), { owedMinor: 700000, receivableMinor: 750000 });
  await repository.close();
  const restarted = new GuestRepository(new LocalDatabase(connect()), services);
  assert.deepEqual(await restarted.initialize(), saved);
  assert.equal((await restarted.snapshot()).onboardingComplete, true);
});

test('repayment corrections and void/restore append every old revision through restart', async (t) => {
  const { repository, services, connect } = await fixture(t);
  const created = await repository.execute('create', create());
  const id = created.recordId!;
  let result = await repository.execute('pay', { type: 'post_entry', recordId: id, expectedVersion: 1,
    kind: 'payment', effectiveOn: '2026-10-10', components: components(300000) });
  let payment = currentEntries(view(result.snapshot, id).record, view(result.snapshot, id).history).find((entry) => entry.kind === 'payment')!;
  result = await repository.execute('correct', { type: 'correct_entry', recordId: id, expectedVersion: 2,
    entryId: payment.id, expectedRevisionId: payment.revisionId, effectiveOn: '2026-10-11', components: components(200000),
    reason: 'Receipt correction', state: 'posted' });
  assert.equal(view(result.snapshot, id).ledger.outstandingMinor, 800000);
  assert.equal(result.snapshot.revisions.find((entry) => entry.revisionId === payment.revisionId)!.principalMinor, 300000);
  payment = currentEntries(view(result.snapshot, id).record, view(result.snapshot, id).history).find((entry) => entry.kind === 'payment')!;
  result = await repository.execute('void', { type: 'correct_entry', recordId: id, expectedVersion: 3,
    entryId: payment.id, expectedRevisionId: payment.revisionId, effectiveOn: payment.effectiveOn, components: components(200000),
    reason: 'Duplicate receipt', state: 'void' });
  assert.equal(view(result.snapshot, id).ledger.cashPaidMinor, 0);
  const latest = view(result.snapshot, id).history.find((entry) => entry.revision === 3)!;
  result = await repository.execute('restore', { type: 'correct_entry', recordId: id, expectedVersion: 4,
    entryId: latest.id, expectedRevisionId: latest.revisionId, effectiveOn: latest.effectiveOn, components: components(200000),
    reason: 'Receipt verified', state: 'posted' });
  await repository.close();
  const restarted = new GuestRepository(new LocalDatabase(connect()), services);
  assert.deepEqual(await restarted.initialize(), result.snapshot);
  assert.equal(result.snapshot.revisions.length, 5);
});

test('reviewed new interest/fee and split cash payment commit together without reducing principal by the whole EMI', async (t) => {
  const { repository } = await fixture(t);
  const { recordId: id } = await repository.execute('create', create('borrowed', { interestMode: 'manual_interest' }));
  const result = await repository.execute('emi', { type: 'post_entry', recordId: id!, expectedVersion: 1,
    kind: 'payment', effectiveOn: '2026-10-10', components: components(400000, 100000, 5000),
    newInterestMinor: 100000, newFeesMinor: 5000 });
  assert.equal(view(result.snapshot, id!).ledger.principalMinor, 600000);
  assert.equal(view(result.snapshot, id!).ledger.cashPaidMinor, 505000);
  assert.equal(result.snapshot.revisions.length, 4);
});

test('invalid split, interest-free interest, unknown allocations and negative balances do not partially save', async (t) => {
  const { repository } = await fixture(t);
  const created = await repository.execute('create', create());
  const id = created.recordId!;
  await assert.rejects(repository.execute('interest', { type: 'post_entry', recordId: id, expectedVersion: 1,
    kind: 'interest_charge', effectiveOn: '2026-10-10', components: components(0, 1000) }));
  await assert.rejects(repository.execute('overpay', { type: 'post_entry', recordId: id, expectedVersion: 1,
    kind: 'payment', effectiveOn: '2026-10-10', components: components(1000001), newFeesMinor: 1000 }));
  assert.deepEqual(await repository.snapshot(), created.snapshot);
});

test('retrying an acknowledged operation never repeats a payment; changed inputs conflict', async (t) => {
  const { repository } = await fixture(t);
  const { recordId: id } = await repository.execute('create', create());
  const command: GuestCommand = { type: 'post_entry', recordId: id!, expectedVersion: 1,
    kind: 'payment', effectiveOn: '2026-10-10', components: components(300000) };
  const first = await repository.execute('payment-retry-id', command);
  const retry = await repository.execute('payment-retry-id', command);
  assert.deepEqual(retry, first);
  await assert.rejects(repository.execute('payment-retry-id', { ...command, components: components(400000) }), /different inputs/);
  assert.equal(view(await repository.snapshot(), id!).ledger.cashPaidMinor, 300000);
});

test('concurrent stale writers cannot silently overwrite or duplicate a financial operation', async (t) => {
  const { repository } = await fixture(t);
  const { recordId: id } = await repository.execute('create', create());
  const command: GuestCommand = { type: 'post_entry', recordId: id!, expectedVersion: 1,
    kind: 'payment', effectiveOn: '2026-10-10', components: components(100000) };
  const results = await Promise.allSettled([repository.execute('writer-a', command), repository.execute('writer-b', command)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(view(await repository.snapshot(), id!).ledger.cashPaidMinor, 100000);
});

test('failure after financial inserts rolls back records, revisions, receipt and outbox together; retry is safe', async (t) => {
  const { database, connection, repository, services } = await fixture(t);
  const created = await repository.execute('create', create());
  let fail = true;
  const wrapped: SqlConnection = { ...connection,
    run: async (sql, params) => {
      if (fail && sql.startsWith('INSERT INTO outbox')) throw new Error('Synthetic interrupted write');
      return connection.run(sql, params);
    },
  };
  const faulting = new GuestRepository(new LocalDatabase(wrapped), services);
  const command: GuestCommand = { type: 'post_entry', recordId: created.recordId!, expectedVersion: 1,
    kind: 'payment', effectiveOn: '2026-10-10', components: components(200000) };
  await assert.rejects(faulting.execute('interrupted', command), /interrupted write/);
  assert.deepEqual(await repository.snapshot(), created.snapshot);
  assert.equal((await database.read((sql) => sql.all('SELECT id FROM operations WHERE id=?', ['interrupted']))).length, 0);
  fail = false;
  assert.equal(view((await faulting.execute('interrupted', command)).snapshot, created.recordId!).ledger.cashPaidMinor, 200000);
});

test('an uncommitted SQLite write is rolled back when its connection closes, without losing committed guest records', async (t) => {
  const { repository, connection, connect, services } = await fixture(t);
  const created = await repository.execute('create', create());
  await connection.exec('BEGIN IMMEDIATE');
  await connection.run('UPDATE records SET version=99 WHERE id=?', [created.recordId!]);
  await connection.close();
  const reopened = new GuestRepository(new LocalDatabase(connect()), services);
  assert.deepEqual(await reopened.initialize(), created.snapshot);
});

test('migration failure rolls back DDL and schema marker, preserving existing user data', async (t) => {
  const { repository, database } = await fixture(t);
  const created = await repository.execute('create', create());
  await assert.rejects(migrateDatabase(database, [...MIGRATIONS, { version: 2,
    sql: 'CREATE TABLE rollback_probe(id TEXT); SELECT * FROM nonexistent_table;' }]));
  assert.deepEqual(await repository.snapshot(), created.snapshot);
  assert.equal((await database.read((sql) => sql.all<{ user_version: number }>('PRAGMA user_version')))[0].user_version, 1);
  assert.equal((await database.read((sql) => sql.all("SELECT name FROM sqlite_master WHERE name='rollback_probe'"))).length, 0);
});

test('newer schema and corrupted data fail visibly without destructive resets', async (t) => {
  const { database, repository } = await fixture(t);
  const created = await repository.execute('create', create());
  await database.transaction((sql) => sql.exec('PRAGMA user_version=99'));
  await assert.rejects(repository.initialize(), /newer Nodebt/);
  assert.equal((await database.read((sql) => sql.all<{ count: number }>('SELECT count(*) AS count FROM records')))[0].count, 1);
  await database.transaction((sql) => sql.exec('PRAGMA user_version=1'));
  await database.transaction((sql) => sql.run('UPDATE records SET payload=? WHERE id=?', ['{}', created.recordId!]));
  await assert.rejects(repository.snapshot());
});

test('Free enforces 3 custom categories per direction, including archived categories', async (t) => {
  const { repository } = await fixture(t);
  for (const direction of ['borrowed', 'lent'] as const) {
    for (let i = 0; i < 3; i++) await repository.execute(`${direction}-${i}`, { type: 'create_category', direction, name: `Custom ${i}` });
    await assert.rejects(repository.execute(`${direction}-4`, { type: 'create_category', direction, name: 'Fourth' }), /up to 3/);
  }
  let snapshot = await repository.snapshot();
  const custom = snapshot.categories.find((row) => row.kind === 'custom' && row.direction === 'borrowed')!;
  await repository.execute('archive-category', { type: 'change_category', id: custom.id, name: custom.name, archived: true });
  await assert.rejects(repository.execute('bypass', { type: 'create_category', direction: 'borrowed', name: 'Bypass' }), /up to 3/);
  snapshot = await repository.snapshot();
  assert.equal(snapshot.categories.filter((row) => row.kind === 'custom' && row.direction === 'lent').length, 3);
});

test('Pro exposes all defaults and unlimited custom categories; expiration preserves historical assignments and reuse', async (t) => {
  const { repository, setPro } = await fixture(t);
  setPro(true);
  let snapshot: GuestSnapshot = await repository.snapshot();
  for (let i = 0; i < 5; i++) snapshot = (await repository.execute(`pro-category-${i}`, {
    type: 'create_category', direction: 'borrowed', name: `Pro custom ${i}`,
  })).snapshot;
  const custom = snapshot.categories.find((row) => row.kind === 'custom')!;
  const premium = DEFAULT_CATEGORIES.find((row) => row.direction === 'borrowed' && !row.freeDefault)!;
  const old = await repository.execute('premium-record', create('borrowed', { categoryId: premium.id }));
  setPro(false);
  await assert.rejects(repository.execute('new-premium', create('borrowed', { categoryId: premium.id })), /available category/);
  await assert.rejects(repository.execute('new-custom', { type: 'create_category', direction: 'borrowed', name: 'Sixth' }), /up to 3/);
  const reused = await repository.execute('reuse-existing', create('borrowed', { categoryId: custom.id }));
  assert.equal(reused.snapshot.categories.filter((row) => row.kind === 'custom').length, 5);
  assert.equal(reused.snapshot.records.find((row) => row.id === old.recordId)!.categoryId, premium.id);
});

test('category direction, duplicate names and default immutability are enforced without erasing assigned history', async (t) => {
  const { repository } = await fixture(t);
  await assert.rejects(repository.execute('wrong-direction', create('lent', { categoryId: 'borrowed:personal_loan' })));
  await assert.rejects(repository.execute('rename-default', { type: 'change_category', id: 'lent:friends', name: 'Renamed', archived: false }));
  const categoryResult = await repository.execute('custom', { type: 'create_category', direction: 'lent', name: 'My category' });
  const category = categoryResult.snapshot.categories.find((row) => row.kind === 'custom')!;
  const saved = await repository.execute('lending', create('lent', { categoryId: category.id }));
  const renamed = await repository.execute('rename', { type: 'change_category', id: category.id, name: 'Renamed custom', archived: true });
  assert.equal(renamed.snapshot.records.find((row) => row.id === saved.recordId)!.categoryId, category.id);
  assert.equal(renamed.snapshot.revisions.length, saved.snapshot.revisions.length);
  await assert.rejects(repository.execute('duplicate', { type: 'create_category', direction: 'lent', name: 'RENAMED CUSTOM' }));
});

test('settlement, zero-balance closure, archive and reopening preserve the original record and revision history', async (t) => {
  const { repository } = await fixture(t);
  let result = await repository.execute('create', create());
  const id = result.recordId!;
  await assert.rejects(repository.execute('premature-close', { type: 'record_action', recordId: id, expectedVersion: 1, action: 'close' }));
  result = await repository.execute('cash', { type: 'post_entry', recordId: id, expectedVersion: 1, kind: 'payment',
    effectiveOn: '2026-10-10', components: components(800000) });
  result = await repository.execute('forgive', { type: 'post_entry', recordId: id, expectedVersion: 2, kind: 'forgiveness',
    effectiveOn: '2026-10-11', components: components(200000), reason: 'Lender settlement' });
  assert.equal(view(result.snapshot, id).ledger.cashPaidMinor, 800000);
  assert.equal(view(result.snapshot, id).ledger.forgivenMinor, 200000);
  result = await repository.execute('close', { type: 'record_action', recordId: id, expectedVersion: 3, action: 'close' });
  await assert.rejects(repository.execute('closed-charge', { type: 'post_entry', recordId: id, expectedVersion: 4,
    kind: 'advance', effectiveOn: '2026-10-27', components: components(10000) }));
  result = await repository.execute('archive', { type: 'record_action', recordId: id, expectedVersion: 4, action: 'archive' });
  result = await repository.execute('reopen', { type: 'record_action', recordId: id, expectedVersion: 5, action: 'reopen' });
  result = await repository.execute('advance', { type: 'post_entry', recordId: id, expectedVersion: 6,
    kind: 'advance', effectiveOn: '2026-10-27', components: components(50000) });
  assert.equal(view(result.snapshot, id).ledger.outstandingMinor, 50000);
  assert.equal(view(result.snapshot, id).record.archived, true);
  assert.equal(result.snapshot.revisions.length, 4);
  assert.equal(portfolioTotals(result.snapshot.records, result.snapshot.revisions).owedMinor, 50000);
  assert.equal(result.snapshot.recordEvents.filter((event) => event.recordId === id).length, 7);
});

test('SQLite revision rows cannot be overwritten and monetary metadata remains explicit', async (t) => {
  const { repository, database } = await fixture(t);
  const result = await repository.execute('create', create());
  await assert.rejects(database.transaction((sql) => sql.run('UPDATE revisions SET payload=?', ['{}'])), /immutable/);
  const rows = await database.read((sql) => sql.all<{ currency: string; minor_unit_scale: number }>('SELECT currency,minor_unit_scale FROM records'));
  assert.deepEqual(rows.map((row) => [row.currency, row.minor_unit_scale]), [['INR', 2]]);
  assert.equal(view(await repository.snapshot(), result.recordId!).ledger.outstandingMinor, 1000000);
});

test('missing existing-device key, invalid key, failed secure storage and failed entropy never reset financial data', async () => {
  let key: string | null = null;
  let stored = 0;
  const services = {
    getKey: async () => key, setKey: async (value: string) => { stored++; key = value; },
    databaseExists: async () => true, randomBytes: async (count: number) => new Uint8Array(count).fill(7),
  };
  await assert.rejects(obtainDeviceKey(services), /missing/);
  assert.equal(stored, 0);
  key = 'invalid';
  await assert.rejects(obtainDeviceKey(services), /invalid/);
  key = null;
  const generated = await obtainDeviceKey({ ...services, databaseExists: async () => false });
  assert.equal(generated, '07'.repeat(32));
  assert.equal(stored, 1);
  assert.equal(await obtainDeviceKey(services), generated);
  await assert.rejects(obtainDeviceKey({ ...services, getKey: async () => null, databaseExists: async () => false,
    setKey: async () => {}, randomBytes: async () => new Uint8Array(31) }), /generation failed/);
  await assert.rejects(obtainDeviceKey({ ...services, getKey: async () => null, databaseExists: async () => false,
    setKey: async () => {} }), /could not be verified/);
});

test('SQLCipher capability is required before setting a key or touching the schema; no plaintext fallback', async () => {
  const events: string[] = [];
  const connection: SqlConnection = {
    exec: async (sql) => { events.push(sql); }, run: async () => ({ changes: 0 }),
    all: async <T,>(sql: string) => { events.push(sql); return [] as T[]; }, close: async () => {},
  };
  await assert.rejects(unlockEncryptedConnection(connection, 'ab'.repeat(32)), /native development build/);
  assert.deepEqual(events, ['PRAGMA cipher_version']);
});

test('verified SQLCipher capability applies the key before schema reads, and wrong keys/integrity errors stop opening', async () => {
  const events: string[] = [];
  let corrupt = false;
  const connection: SqlConnection = {
    exec: async (sql) => { events.push(sql); }, run: async () => ({ changes: 0 }), close: async () => {},
    all: async <T,>(sql: string) => {
      events.push(sql);
      if (sql === 'PRAGMA cipher_version') return [{ cipher_version: '4.x' }] as T[];
      if (sql === 'PRAGMA quick_check') return [{ quick_check: corrupt ? 'corruption' : 'ok' }] as T[];
      return [];
    },
  };
  await unlockEncryptedConnection(connection, 'ab'.repeat(32));
  assert.equal(events[0], 'PRAGMA cipher_version');
  assert.match(events[1], /^PRAGMA key/);
  assert.match(events[2], /sqlite_master/);
  corrupt = true;
  await assert.rejects(unlockEncryptedConnection(connection, 'ab'.repeat(32)), /integrity/);
  await assert.rejects(unlockEncryptedConnection({ ...connection, all: async <T,>(sql: string) => {
    if (sql.includes('sqlite_master')) throw new Error('wrong key');
    return connection.all<T>(sql);
  } }, 'ab'.repeat(32)), /wrong key/);
});

test('complete record creation retries persist only one record and one opening balance', async (t) => {
  const { repository } = await fixture(t);
  const id = randomUUID();
  const first = await repository.execute(id, create());
  const again = await repository.execute(id, create());
  assert.equal(first.recordId, again.recordId);
  assert.equal(again.snapshot.records.length, 1);
  assert.equal(again.snapshot.revisions.length, 1);
});
test('atomic partial settlements keep actual cash separate from borrowing forgiveness or lending write-off', async (t) => {
  const { repository } = await fixture(t);
  for (const direction of ['borrowed', 'lent'] as const) {
    const created = await repository.execute(`create-${direction}`, create(direction));
    const result = await repository.execute(`settle-${direction}`, { type: 'settle_record', recordId: created.recordId!, expectedVersion: 1,
      effectiveOn: '2026-10-10', paid: components(800000), waived: components(200000), reason: 'Agreed partial settlement' });
    const detail = view(result.snapshot, created.recordId!);
    assert.equal(detail.ledger.outstandingMinor, 0);
    assert.equal(detail.ledger.cashPaidMinor, 800000);
    assert.equal(direction === 'borrowed' ? detail.ledger.forgivenMinor : detail.ledger.writtenOffMinor, 200000);
    assert.equal(detail.history.length, 3);
  }
});

test('incomplete or excessive settlements roll back both their cash and waived parts', async (t) => {
  const { repository } = await fixture(t);
  const original = await repository.execute('create', create());
  for (const waived of [100000, 300000]) await assert.rejects(repository.execute(`bad-${waived}`, {
    type: 'settle_record', recordId: original.recordId!, expectedVersion: 1, effectiveOn: '2026-10-10',
    paid: components(800000), waived: components(waived), reason: 'Incorrect breakdown',
  }));
  assert.deepEqual(await repository.snapshot(), original.snapshot);
});

test('explicit signed adjustments and additional lending persist their reasons and exact component changes', async (t) => {
  const { repository } = await fixture(t);
  const original = await repository.execute('create', create('lent'));
  let result = await repository.execute('advance', { type: 'post_entry', recordId: original.recordId!, expectedVersion: 1,
    kind: 'advance', effectiveOn: '2026-10-10', components: components(200000) });
  result = await repository.execute('adjust', { type: 'post_entry', recordId: original.recordId!, expectedVersion: 2,
    kind: 'adjustment', effectiveOn: '2026-10-11', components: components(-10000), reason: 'Opening statement reconciliation' });
  assert.equal(view(result.snapshot, original.recordId!).ledger.outstandingMinor, 1190000);
  assert.equal(result.snapshot.revisions.find((entry) => entry.kind === 'adjustment')!.reason, 'Opening statement reconciliation');
  assert.equal(view(result.snapshot, original.recordId!).ledger.cashPaidMinor, 0);
});

test('screen selectors show exact overdue remainders and immutable revisions, and never net receivables against debts', async (t) => {
  const { repository } = await fixture(t);
  const original = await repository.execute('create', create('borrowed', {
    schedule: { firstDueOn: '2026-10-10', amountMinor: 500000, count: 2 },
  }));
  await repository.execute('lend', create('lent'));
  const result = await repository.execute('partial', { type: 'post_entry', recordId: original.recordId!, expectedVersion: 1,
    kind: 'payment', effectiveOn: '2026-10-10', components: components(300000) });
  const detail = selectRecord(result.snapshot, original.recordId!, '2026-10-27')!;
  assert.equal(detail.schedule.installments[0].remainingMinor, 200000);
  assert.equal(detail.schedule.installments[0].status, 'overdue');
  assert.equal(detail.schedule.installments[1].remainingMinor, 500000);
  const dashboard = selectDashboard(result.snapshot, '2026-10-27');
  assert.equal(dashboard.owedMinor, 700000);
  assert.equal(dashboard.receivableMinor, 1000000);
  assert.equal(dashboard.repaidMinor, 300000);
  assert.equal(selectActivity(result.snapshot, original.recordId!).length, 2);
});

test('lifecycle events retain metadata snapshots and guest journal retains explicit currency and scale', async (t) => {
  const { repository, database } = await fixture(t);
  const created = await repository.execute('create', create());
  const originalCategory = created.snapshot.records[0].categoryId;
  const custom = await repository.execute('category', { type: 'create_category', direction: 'borrowed', name: 'Changed category' });
  const id = custom.snapshot.categories.find((category) => category.kind === 'custom')!.id;
  const result = await repository.execute('reclassify', { type: 'assign_category', recordId: created.recordId!, expectedVersion: 1, categoryId: id });
  const firstEvent = result.snapshot.recordEvents.find((event) => event.kind === 'created')!;
  assert.equal(firstEvent.record.categoryId, originalCategory);
  assert.equal(result.snapshot.records[0].categoryId, id);
  const outbox = await database.read((sql) => sql.all<{ payload: string }>('SELECT payload FROM outbox'));
  assert.ok(outbox.every((row) => JSON.parse(row.payload).currency === 'INR' && JSON.parse(row.payload).minorUnitScale === 2));
});

test('financial form parsing preserves every paisa and rejects ambiguous amounts/counts', () => {
  assert.equal(parseAmount('-200.01', true), -20001);
  assert.equal(parseAmount('', false, true), 0);
  assert.equal(parseAmount(amountInput(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  assert.equal(parseAmount(amountInput(-12345), true), -12345);
  assert.throws(() => parseAmount('1.005'));
  assert.throws(() => parseAmount('1e3'));
  assert.throws(() => installmentCount('1.5'));
  assert.throws(() => installmentCount('601'));
  assert.equal(installmentCount('12'), 12);
});
