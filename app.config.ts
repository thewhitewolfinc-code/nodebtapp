import type { ConfigContext, ExpoConfig } from 'expo/config';

export default function configure({ config }: ConfigContext): ExpoConfig {
  const appId = process.env.NODEBT_APP_ID || 'app.nodebt.development';
  if (process.env.EAS_BUILD_PROFILE === 'production' && !process.env.NODEBT_APP_ID) {
    throw new Error('Set NODEBT_APP_ID to the approved production app identity before production builds.');
  }
  if (process.env.EAS_BUILD_PROFILE === 'production'
    && !process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim().startsWith('pk_live_')) {
    throw new Error('Production builds require a live EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Development keys and guest-only auth fallback are not allowed in production.');
  }
  return {
    ...config, name: config.name ?? 'Nodebt', slug: config.slug ?? 'Nodebt',
    plugins: [
      ...(config.plugins ?? []),
      '@clerk/expo',
      // SDK 58's default Ninja cannot create long Windows C++ object paths.
      // Keep Linux/EAS and macOS on their supported default native toolchain.
      ['expo-build-properties', { android: process.platform === 'win32' ? { cmakeVersion: '3.31.6' } : {} }],
    ],
    android: { ...config.android, package: appId, allowBackup: false },
    ios: { ...config.ios, bundleIdentifier: appId },
  };
}
