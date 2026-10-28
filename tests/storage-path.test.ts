import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nativeDirectoryFileUri, obtainDeviceKey } from '../src/storage/security.ts';

test('SQLite native directories become absolute FileSystem URIs without changing the database location', () => {
  const android = '/data/user/0/app.nodebt.development/files/SQLite';
  assert.equal(nativeDirectoryFileUri(android), `file://${android}`);
  const ios = 'file:///var/mobile/Containers/Data/Application/example/Documents/SQLite';
  assert.equal(nativeDirectoryFileUri(ios), ios);
  const special = '/private/Nodebt test #1/100%/தமிழ்/SQLite';
  assert.equal(decodeURIComponent(new URL(nativeDirectoryFileUri(special)).pathname), special);
  const encoded = 'file:///private/Nodebt%20test/SQLite';
  assert.equal(nativeDirectoryFileUri(encoded), encoded);
  for (const invalid of ['', 'SQLite', '../SQLite', 'https://example.com/SQLite', '//server/SQLite']) {
    assert.throws(() => nativeDirectoryFileUri(invalid), /database directory/);
  }
});

test('the normalized existing-database check still prevents replacing a missing device key', async () => {
  let keyWrites = 0;
  let entropyRequests = 0;
  await assert.rejects(obtainDeviceKey({
    getKey: async () => null,
    databaseExists: async () => {
      assert.equal(new URL(nativeDirectoryFileUri('/data/user/0/app/files/SQLite')).protocol, 'file:');
      return true;
    },
    setKey: async () => { keyWrites++; },
    randomBytes: async () => { entropyRequests++; return new Uint8Array(32); },
  }), /encryption key.*missing/);
  assert.equal(keyWrites, 0);
  assert.equal(entropyRequests, 0);
});
