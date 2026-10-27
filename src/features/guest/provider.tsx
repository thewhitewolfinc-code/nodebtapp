import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, AppState } from 'react-native';

import { Button, Card, Copy, Page } from '@/components/nodebt/ui';
import type { CommandResult, GuestCommand, GuestSnapshot } from '@/storage/models';
import { localToday, openGuestRepository } from '@/storage/open';
import type { GuestRepository } from '@/storage/repository';

interface GuestContextValue {
  readonly snapshot: GuestSnapshot;
  readonly busy: boolean;
  readonly today: string;
  readonly createOperationId: () => string;
  readonly execute: (operationId: string, command: GuestCommand) => Promise<CommandResult>;
}
const GuestContext = createContext<GuestContextValue | undefined>(undefined);
interface GuestState { repository?: GuestRepository; snapshot?: GuestSnapshot; createOperationId?: () => string; error?: string }
async function readGuestState(): Promise<GuestState> {
  try {
    const repository = await openGuestRepository();
    const { randomUUID } = await import('expo-crypto');
    return { repository, snapshot: await repository.snapshot(), createOperationId: randomUUID };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Encrypted storage is unavailable. Existing data was not reset.' };
  }
}
export function GuestProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<GuestState>({});
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState(localToday);
  const locked = useRef(false);
  useEffect(() => {
    let mounted = true;
    void readGuestState().then((result) => { if (mounted) setState(result); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => { if (next === 'active') setToday(localToday()); });
    const timer = setInterval(() => setToday(localToday()), 60000);
    return () => { listener.remove(); clearInterval(timer); };
  }, []);
  const execute = useCallback(async (operationId: string, command: GuestCommand) => {
    if (!state.repository) throw new Error('Encrypted storage is not ready.');
    if (locked.current) throw new Error('A change is already being saved. Please wait.');
    locked.current = true;
    setBusy(true);
    try {
      const result = await state.repository.execute(operationId, command);
      setState((previous) => ({ ...previous, snapshot: result.snapshot }));
      return result;
    } finally { locked.current = false; setBusy(false); }
  }, [state.repository]);
  if (state.error) return <Page title="Secure storage required" subtitle="Your financial records have not been reset.">
    <Card><Copy>{state.error}</Copy><Copy variant="caption">Use the Nodebt Android or iOS development build. Setup steps are in docs/P1_NATIVE_SETUP.md.</Copy></Card>
    <Button label="Retry opening storage" onPress={() => { setState({}); void readGuestState().then(setState); }} />
  </Page>;
  if (!state.snapshot || !state.createOperationId) return <Page title="Opening Nodebt"><ActivityIndicator /><Copy>Opening your encrypted ledger…</Copy></Page>;
  return <GuestContext value={{ snapshot: state.snapshot, busy, today, execute, createOperationId: state.createOperationId }}>{children}</GuestContext>;
}
export function useGuest(): GuestContextValue {
  const value = useContext(GuestContext);
  if (!value) throw new Error('Guest screens require an initialized encrypted ledger.');
  return value;
}
/** Retain an operation ID across a failed retry; reset only after an acknowledged success. */
export function useOperationId() {
  const { createOperationId } = useGuest();
  const reference = useRef<string | undefined>(undefined);
  return { get: () => reference.current ??= createOperationId(), reset: () => { reference.current = undefined; } };
}
