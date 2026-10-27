import type { SqlConnection } from './database.ts';

export class StorageSecurityError extends Error {
  constructor(message: string) { super(message); this.name = 'StorageSecurityError'; }
}

export interface KeyServices {
  readonly databaseExists: () => Promise<boolean>;
  readonly getKey: () => Promise<string | null>;
  readonly setKey: (key: string) => Promise<void>;
  readonly randomBytes: (count: number) => Promise<Uint8Array>;
}

/** Never replace an inaccessible/missing key for an existing database, or reset the database. */
export async function obtainDeviceKey(services: KeyServices): Promise<string> {
  const existing = await services.getKey();
  if (existing !== null) {
    if (!/^[0-9a-f]{64}$/.test(existing)) throw new StorageSecurityError('The stored device key is invalid. Existing data was not changed.');
    return existing;
  }
  if (await services.databaseExists()) {
    throw new StorageSecurityError('The encryption key for this device database is missing. Existing data was not changed.');
  }
  const bytes = await services.randomBytes(32);
  if (bytes.length !== 32) throw new StorageSecurityError('Secure random key generation failed.');
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  await services.setKey(key);
  if (await services.getKey() !== key) throw new StorageSecurityError('Secure key storage could not be verified.');
  return key;
}

/** SQLCipher capability and actual keyed schema access are required before any migration or data write. */
export async function unlockEncryptedConnection(connection: SqlConnection, key: string): Promise<void> {
  const cipher = await connection.all<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!cipher[0]?.cipher_version?.trim()) {
    throw new StorageSecurityError('Encrypted storage requires a Nodebt native development build. Expo Go and web cannot open this ledger.');
  }
  if (!/^[0-9a-f]{64}$/.test(key)) throw new StorageSecurityError('Invalid device encryption key.');
  // Only locally generated/validated hex reaches this PRAGMA (SQLite does not bind PRAGMA values).
  await connection.exec(`PRAGMA key = "x'${key}'"`);
  await connection.all('SELECT count(*) AS count FROM sqlite_master'); // Wrong key/corruption must fail closed.
  const check = await connection.all<{ quick_check: string }>('PRAGMA quick_check');
  if (check.length !== 1 || check[0].quick_check !== 'ok') throw new StorageSecurityError('Database integrity verification failed. Existing data was not reset.');
  await connection.exec('PRAGMA cipher_memory_security = ON; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
}