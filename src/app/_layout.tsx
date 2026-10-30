import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthSessionProvider, useAuthSession } from '@/features/auth/session';
import { navigationFor } from '@/features/auth/navigation';
import { useWorkspace } from '@/features/auth/workspace';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
function AppNavigator() {
  const { state } = useAuthSession();
  const access = navigationFor(state, useWorkspace());
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={access.startup} redirectTo={access.destination}><Stack.Screen name="index" /></Stack.Protected>
    <Stack.Protected guard={access.entry} redirectTo={access.destination}><Stack.Screen name="welcome" /></Stack.Protected>
    <Stack.Protected guard={access.callback} redirectTo={access.destination}><Stack.Screen name="sso-callback" /></Stack.Protected>
    <Stack.Protected guard={access.guest} redirectTo={access.destination}>
      <Stack.Screen name="(guest)" />
    </Stack.Protected>
    <Stack.Protected guard={access.account} redirectTo={access.destination}>
      <Stack.Screen name="(account)" />
    </Stack.Protected>
    <Stack.Protected guard={access.verification} redirectTo={access.destination}><Stack.Screen name="verify" /></Stack.Protected>
    <Stack.Protected guard={__DEV__ && access.entry} redirectTo={access.destination}>
      <Stack.Screen name="design-preview" />
    </Stack.Protected>
  </Stack>;
}
export default function RootLayout() {
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({ NoDebtIcons: require('../../assets/fonts/Feather.ttf'), Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useEffect(() => { if (fontsLoaded || fontError) void SplashScreen.hideAsync().catch(() => undefined); }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return <SafeAreaProvider><ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
    <AuthSessionProvider><AppNavigator /></AuthSessionProvider>
  </ThemeProvider></SafeAreaProvider>;
}
