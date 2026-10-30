import { Stack } from 'expo-router';
export const unstable_settings = { anchor: 'dashboard' };
export default function AccountLayout() {
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="dashboard" /><Stack.Screen name="account" /></Stack>;
}
