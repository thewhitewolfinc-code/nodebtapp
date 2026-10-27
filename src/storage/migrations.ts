import { DEFAULT_CATEGORIES } from '../domain/categories.ts';
import type { LocalDatabase } from './database.ts';

export interface Migration { readonly version: number; readonly sql: string }
export const MIGRATIONS: readonly Migration[] = [{ version: 1, sql: `
CREATE TABLE categories (
 id TEXT PRIMARY KEY NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('borrowed','lent')),
 kind TEXT NOT NULL CHECK(kind IN ('default','custom')), name TEXT NOT NULL,
 archived INTEGER NOT NULL CHECK(archived IN (0,1)), payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE UNIQUE INDEX category_names ON categories(direction, lower(name));
CREATE TABLE records (
 id TEXT PRIMARY KEY NOT NULL, direction TEXT NOT NULL CHECK(direction IN ('borrowed','lent')),
 currency TEXT NOT NULL CHECK(length(currency)=3), minor_unit_scale INTEGER NOT NULL,
 category_id TEXT NOT NULL REFERENCES categories(id), version INTEGER NOT NULL CHECK(version > 0),
 payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE TABLE revisions (
 id TEXT PRIMARY KEY NOT NULL, record_id TEXT NOT NULL REFERENCES records(id), entry_id TEXT NOT NULL,
 revision_number INTEGER NOT NULL CHECK(revision_number > 0), parent_id TEXT REFERENCES revisions(id),
 payload TEXT NOT NULL CHECK(json_valid(payload)), UNIQUE(record_id, entry_id, revision_number)
);
CREATE INDEX revisions_record ON revisions(record_id);
CREATE TRIGGER revisions_no_update BEFORE UPDATE ON revisions BEGIN SELECT RAISE(ABORT, 'Financial revisions are immutable'); END;
CREATE TABLE installments (
 id TEXT PRIMARY KEY NOT NULL, record_id TEXT NOT NULL REFERENCES records(id),
 payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE TABLE record_events (
 id TEXT PRIMARY KEY NOT NULL, record_id TEXT NOT NULL REFERENCES records(id),
 payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)));
CREATE TABLE operations (
 id TEXT PRIMARY KEY NOT NULL, request TEXT NOT NULL CHECK(json_valid(request)),
 result TEXT NOT NULL CHECK(json_valid(result)), recorded_at TEXT NOT NULL
);
CREATE TABLE outbox (
 operation_id TEXT PRIMARY KEY NOT NULL REFERENCES operations(id),
 scope TEXT NOT NULL DEFAULT 'guest' CHECK(scope='guest'),
 payload TEXT NOT NULL CHECK(json_valid(payload))
);
` }];

/** Entire upgrade (including seeds and version marker) commits together or rolls back together. */
export async function migrateDatabase(database: LocalDatabase, migrations = MIGRATIONS): Promise<void> {
  await database.transaction(async (sql) => {
    const rows = await sql.all<{ user_version: number }>('PRAGMA user_version');
    let version = rows[0]?.user_version ?? 0;
    const latest = migrations.at(-1)?.version ?? 0;
    if (!Number.isSafeInteger(version) || version < 0 || version > latest) {
      throw new Error('This database needs a newer Nodebt version. It has not been changed.');
    }
    for (const migration of migrations) {
      if (migration.version <= version) continue;
      if (migration.version !== version + 1) throw new Error('Database migration sequence is incomplete.');
      await sql.exec(migration.sql);
      if (migration.version === 1) {
        for (const category of DEFAULT_CATEGORIES) {
          await sql.run('INSERT INTO categories(id,direction,kind,name,archived,payload) VALUES (?,?,?,?,?,?)',
            [category.id, category.direction, category.kind, category.name, 0, JSON.stringify(category)]);
        }
      }
      await sql.exec(`PRAGMA user_version = ${migration.version}`);
      version = migration.version;
    }
  });
}