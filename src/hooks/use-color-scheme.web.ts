import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** Use the same initial theme on the server and during hydration, then follow the device. */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const colorScheme = useRNColorScheme();
  return hasHydrated ? colorScheme : 'light';
}
