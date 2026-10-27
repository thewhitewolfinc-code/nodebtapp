import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

test('unsupported clients fail inside the storage boundary, without crashing route imports', async () => {
  const nativeImports: string[] = [];
  let expoGo = true;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'expo') return {
        url: `data:text/javascript,export const isRunningInExpoGo = () => ${expoGo};`, shortCircuit: true,
      };
      if (['expo-crypto', 'expo-file-system', 'expo-secure-store', 'expo-sqlite'].includes(specifier)) {
        nativeImports.push(specifier);
        throw new Error(`Native module must not load in Expo Go: ${specifier}`);
      }
      return nextResolve(specifier, context);
    },
  });
  try {
    const { openGuestRepository } = await import('../src/storage/open.ts');
    await assert.rejects(openGuestRepository(), /Expo Go cannot run the encrypted Nodebt tracker/);
    await assert.rejects(openGuestRepository(), /Expo Go cannot run the encrypted Nodebt tracker/);
    assert.deepEqual(nativeImports, []);
    expoGo = false;
    // A separately loaded opener simulates a development binary missing native modules.
    // Importing it must succeed; opening it must reject through the sanitized error path.
    const openerUrl = new URL('../src/storage/open.ts?missing-native', import.meta.url).href;
    const staleBuild = await import(openerUrl) as typeof import('../src/storage/open.ts');
    await assert.rejects(staleBuild.openGuestRepository(), /Secure local storage is unavailable/);
    assert.ok(nativeImports.length > 0);
  } finally {
    hooks.deregister();
  }
});
