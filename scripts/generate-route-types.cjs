const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

// SDK 58's Windows incremental watcher adds backslash/out-of-root paths to router.d.ts.
// Keep deterministic app-only declarations separate from the running Metro watcher's output.
// Use the installed Expo generator itself; never maintain a second route/parser implementation.
const root = path.resolve(__dirname, '..');
const fromExpo = createRequire(require.resolve('expo/package.json'));
const expoVersion = fromExpo('expo/package.json').version;
if (!expoVersion.startsWith('58.')) throw new Error('Revalidate Nodebt route type generation when upgrading Expo SDK.');
const fromCli = createRequire(fromExpo.resolve('@expo/cli/package.json'));
const { requireContext } = require('expo-router/internal/testing');
const { EXPO_ROUTER_CTX_IGNORE } = require('expo-router/_ctx-shared');
const { getTypedRoutesDeclarationFile } = fromCli('@expo/router-server/build/typed-routes/generate');
const declaration = getTypedRoutesDeclarationFile(requireContext(path.join(root, 'src/app'), true, EXPO_ROUTER_CTX_IGNORE));
if (!declaration || declaration.includes('/../')) throw new Error('Invalid generated route declarations.');
const directory = path.join(root, '.expo/nodebt-types');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'router.d.ts'), declaration);