import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { LocalDatabase, type SqlConnection } from './database.ts';
import { GuestRepository } from './repository.ts';
import { obtainDeviceKey, unlockEncryptedConnection } from './security.ts';

const DATABASE_NAME = 'nodebt-guest-v1.db';
const KEY_NAME = 'nodebt.database.key.v1';
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'nodebt.device.database.v1', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
let opening: Promise<GuestRepository> | undefined;

export function localToday(): string {
  const now = new Date();
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
async function open(): Promise<GuestRepository> {
  if (!await SecureStore.isAvailableAsync()) throw new Error('Secure device key storage is unavailable. No ledger was opened.');
  const key = await obtainDeviceKey({
    getKey: () => SecureStore.getItemAsync(KEY_NAME, secureOptions),
    setKey: (value) => SecureStore.setItemAsync(KEY_NAME, value, secureOptions),
    databaseExists: async () => new File(SQLite.defaultDatabaseDirectory, DATABASE_NAME).exists,
    randomBytes: (count) => Crypto.getRandomBytesAsync(count),
  });
  // Dedicated connection also avoids registering financial data with the SQLite devtools inspector.
  const native = await SQLite.openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });
  const connection: SqlConnection = {
    exec: (sql) => native.execAsync(sql),
    run: async (sql, params = []) => ({ changes: (await native.runAsync(sql, [...params])).changes }),
    all: <T,>(sql: string, params: readonly (string | number | null)[] = []) => native.getAllAsync<T>(sql, [...params]),
    close: () => native.closeAsync(),
  };
  try {
    await unlockEncryptedConnection(connection, key);
    const repository = new GuestRepository(new LocalDatabase(connection), {
      id: () => Crypto.randomUUID(), now: () => new Date().toISOString(), today: localToday,
      access: () => ({ isPro: false }), // P1 guest policy. No billing or local entitlement toggle.
    });
    await repository.initialize();
    return repository;
  } catch (error) {
    await connection.close().catch(() => undefined);
    // Do not expose native SQL strings, file contents or key material in UI/logs.
    if (error instanceof Error && /native development build|missing|newer Nodebt|catalog|integrity/i.test(error.message)) throw error;
    throw new Error('Encrypted storage could not be opened or upgraded. Existing data was not reset. Restart and retry with the correct Nodebt build.');
  }
}
export function openGuestRepository(): Promise<GuestRepository> {
  opening ??= open().catch((error) => { opening = undefined; throw error; });
  return opening;
}