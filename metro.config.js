const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
const escapedRoot = path.resolve(__dirname).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const previous = config.resolver.blockList;
// Generated native output can expose malformed Windows paths to Metro's watcher.
// App JS lives in src; native projects are build inputs, not JS module roots.
config.resolver.blockList = [
  ...(Array.isArray(previous) ? previous : previous ? [previous] : []),
  new RegExp(`${escapedRoot}[/\\\\](?:android|ios)[/\\\\]`),
];
module.exports = config;
