import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { WorkspaceStore, type WorkspaceMode } from './workspace-state';
const key = 'nodebt.workspace-mode.v1';
const WorkspaceContext = createContext<WorkspaceStore | null>(null);
export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => new WorkspaceStore({
    read: () => Platform.OS === 'web' ? Promise.resolve('entry') : SecureStore.getItemAsync(key),
    write: (mode: WorkspaceMode) => Platform.OS === 'web' ? Promise.resolve() : SecureStore.setItemAsync(key, mode, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
  }));
  useEffect(() => { void store.load(); }, [store]);
  return <WorkspaceContext value={store}>{children}</WorkspaceContext>;
}
export function useWorkspace() {
  const store = useContext(WorkspaceContext);
  if (!store) throw new Error('Workspace context is required.');
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { ...snapshot, store };
}
