export type WorkspaceMode = 'entry' | 'guest' | 'account';
export interface WorkspaceState { ready: boolean; mode: WorkspaceMode | null; pending: WorkspaceMode | null; error?: string }
export interface WorkspaceStorage { read(): Promise<string | null>; write(mode: WorkspaceMode): Promise<void> }
export const initialWorkspace: WorkspaceState = { ready: false, mode: null, pending: null };
/** A saved choice is not an authentication credential or financial storage. */
export class WorkspaceStore {
  private state: WorkspaceState = initialWorkspace;
  private listeners = new Set<() => void>();
  private loading?: Promise<void>;
  private writes: Promise<void> = Promise.resolve();
  private sequence = 0;
  private storage: WorkspaceStorage;
  constructor(storage: WorkspaceStorage) { this.storage = storage; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(next: WorkspaceState) { this.state = next; this.listeners.forEach(listener => listener()); }
  load = (): Promise<void> => {
    this.loading ??= (async () => {
      try {
        const value = await this.storage.read();
        if (value !== null && !['entry', 'guest', 'account'].includes(value)) throw new Error('Invalid workspace choice.');
        this.publish({ ready: true, mode: value as WorkspaceMode | null, pending: null });
      } catch { this.publish({ ready: false, mode: null, pending: null, error: 'Your saved workspace could not be checked. Retry to keep account and guest records separate.' }); }
    })();
    return this.loading;
  };
  retry = async () => { if (this.state.pending) return; this.loading = undefined; await this.load(); };
  choose = async (mode: WorkspaceMode): Promise<void> => {
    if (!this.state.ready) throw new Error('Your workspace is still being checked. Please retry.');
    const sequence = ++this.sequence;
    this.publish({ ...this.state, pending: mode, error: undefined });
    const write = this.writes.then(() => this.storage.write(mode));
    this.writes = write.catch(() => undefined);
    try {
      await write;
      this.publish({ ...this.state, mode, pending: sequence === this.sequence ? null : this.state.pending, error: undefined });
    } catch {
      if (sequence === this.sequence) this.publish({ ...this.state, pending: null, error: 'Your workspace choice could not be saved securely. Please retry.' });
      throw new Error('Your workspace choice could not be saved securely. Please retry.');
    }
  };
}
/** Save account intent before the browser can activate a session. */
export async function withAccountIntent<T>(store: Pick<WorkspaceStore, 'choose'>, operation: () => Promise<T>): Promise<T> {
  await store.choose('account');
  return operation();
}
