import { Tabs } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';

export default function MainTabs() {
  const colors = useTheme();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.text,
    tabBarInactiveTintColor: colors.textSecondary, tabBarIcon: () => null,
    tabBarStyle: { backgroundColor: colors.background }, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' } }}>
    <Tabs.Screen name="home" options={{ title: 'Home' }} />
    <Tabs.Screen name="records" options={{ title: 'Records' }} />
    <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
    <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
  </Tabs>;
}