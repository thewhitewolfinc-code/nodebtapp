import type { ConfigContext, ExpoConfig } from 'expo/config';

export default function configure({ config }: ConfigContext): ExpoConfig {
  const appId = process.env.NODEBT_APP_ID || 'app.nodebt.development';
  if (process.env.EAS_BUILD_PROFILE === 'production' && !process.env.NODEBT_APP_ID) {
    throw new Error('Set NODEBT_APP_ID to the approved production app identity before production builds.');
  }
  return {
    ...config, name: config.name ?? 'Nodebt', slug: config.slug ?? 'Nodebt',
    android: { ...config.android, package: appId, allowBackup: false },
    ios: { ...config.ios, bundleIdentifier: appId },
  };
}