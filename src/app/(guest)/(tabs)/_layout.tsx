import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/nodebt/icon';
import { font } from '@/design/tokens';
import { useTheme } from '@/hooks/use-theme';
const icons: Record<string, IconName> = { home: 'home', records: 'layers', activity: 'activity', insights: 'bar-chart-2', settings: 'settings' };
export default function MainTabs() {
  const theme = useTheme(), insets = useSafeAreaInsets();
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: theme.brand, tabBarInactiveTintColor: theme.textSecondary,
    tabBarIcon: ({ focused }) => <View style={{ width: 42, height: 30, borderRadius: 12, backgroundColor: focused ? theme.brandSurface : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icons[route.name] ?? 'circle'} size={20} color={focused ? theme.brand : theme.textSecondary} /></View>,
    tabBarStyle: { height: 62 + insets.bottom, paddingTop: 7, paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.backgroundElement, borderTopColor: theme.border, elevation: 0 },
    tabBarLabelStyle: { fontFamily: font.medium, fontSize: 10, lineHeight: 14, marginTop: 2 },
  })}>
    <Tabs.Screen name="home" options={{ title: 'Home' }} /><Tabs.Screen name="records" options={{ title: 'Records' }} />
    <Tabs.Screen name="activity" options={{ title: 'Activity' }} /><Tabs.Screen name="insights" options={{ title: 'Insights' }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
  </Tabs>;
}
