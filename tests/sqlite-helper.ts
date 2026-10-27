import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { TestContext } from 'node:test';

import { LocalDatabase, type SqlConnection } from '../src/storage/database.ts';
import { GuestRepository, type RepositoryServices } from '../src/storage/repository.ts';

/** Real SQLite, isolated synthetic fixtures only. This is not the application's native encryption adapter. */
export function nodeConnection(path: string): SqlConnection {
  const native = new DatabaseSync(path);
  native.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL');
  let closed = false;
  return {
    exec: async (sql) => { native.exec(sql); },
    run: async (sql, params = []) => ({ changes: Number(native.prepare(sql).run(...params).changes) }),
    all: async <T,>(sql: string, params: readonly (string | number | null)[] = []) => native.prepare(sql).all(...params) as T[],
    close: async () => { if (!closed) { closed = true; native.close(); } },
  };
}
export async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'nodebt-p1-'));
  const path = join(directory, 'synthetic-fixture.db');
  let isPro = false;
  const connections: SqlConnection[] = [];
  const services: RepositoryServices = {
    id: randomUUID, now: () => '2026-10-27T12:00:00.000Z', today: () => '2026-10-27', access: () => ({ isPro }),
  };
  const connect = () => { const connection = nodeConnection(path); connections.push(connection); return connection; };
  const connection = connect();
  const database = new LocalDatabase(connection);
  const repository = new GuestRepository(database, services);
  await repository.initialize();
  t.after(async () => {
    for (const connection of connections) await connection.close();
    // Check the resolved recursive-delete target is exactly this test's temporary directory.
    const absolute = resolve(directory);
    if (dirname(absolute) !== resolve(tmpdir()) || !basename(absolute).startsWith('nodebt-p1-')) throw new Error('Unsafe test cleanup target.');
    rmSync(absolute, { recursive: true });
  });
  return { path, connection, database, repository, services, connect, setPro: (value: boolean) => { isPro = value; } };
}