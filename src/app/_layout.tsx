import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GuestProvider } from '@/features/guest/provider';

export default function RootLayout() {
  const scheme = useColorScheme();
  useEffect(() => { void SplashScreen.hideAsync().catch(() => undefined); }, []);
  return <SafeAreaProvider><ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
    <GuestProvider><Stack screenOptions={{ headerShown: false }} /></GuestProvider>
  </ThemeProvider></SafeAreaProvider>;
}