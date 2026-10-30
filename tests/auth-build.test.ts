import assert from 'node:assert/strict';
import { test } from 'node:test';
import configure from '../app.config.ts';

// Synthetic build values only; no dotenv files, real keys or remote accounts.
function buildWith(profile: string, key?: string, appId = 'app.nodebt.buildtest') {
  const names = ['EAS_BUILD_PROFILE', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', 'NODEBT_APP_ID'] as const;
  const previous = names.map(name => process.env[name]);
  try {
    process.env.EAS_BUILD_PROFILE = profile;
    process.env.NODEBT_APP_ID = appId;
    if (key === undefined) delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = key;
    return configure({ config: { name: 'Build test', slug: 'build-test' }, projectRoot: '.', staticConfigPath: null, packageJsonPath: 'package.json' });
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
}

test('production builds reject missing, development and non-publishable auth configuration', () => {
  for (const value of [undefined, '', '   ', 'pk_test_synthetic', 'sk_live_synthetic']) {
    assert.throws(() => buildWith('production', value), /require a live EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  }
});
test('production builds retain the explicit app identity requirement', () => {
  assert.throws(() => buildWith('production', 'pk_live_synthetic', ''), /approved production app identity/);
});
test('a production build with a live-key prefix retains Clerk and device-backup protection', () => {
  // The SDK validates the actual key. This build guard validates its environment type.
  const result = buildWith('production', 'pk_live_synthetic');
  assert.equal(result.android?.package, 'app.nodebt.buildtest');
  assert.ok(result.plugins?.includes('@clerk/expo'));
  assert.equal(result.android?.allowBackup, false);
});
test('development builds still support local guest use and development Clerk instances', () => {
  for (const value of [undefined, 'pk_test_synthetic']) {
    assert.equal(buildWith('development', value).android?.package, 'app.nodebt.buildtest');
  }
});
