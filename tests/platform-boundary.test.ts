import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openGuestRepository } from '../src/storage/open.web.ts';

test('web cannot create a guest repository or read/write financial records through browser storage', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let calls = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => { calls++; return null; }, setItem: () => { calls++; }, removeItem: () => { calls++; },
  } });
  try {
    await assert.rejects(openGuestRepository(), /Web does not store your financial data/);
    assert.equal(calls, 0);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});