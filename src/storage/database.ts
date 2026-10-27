export type SqlValue = string | number | null;
export interface SqlConnection {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  close(): Promise<void>;
}

/** Own one keyed connection. No raw connection escapes to a screen or another async writer. */
export class LocalDatabase {
  private tail: Promise<unknown> = Promise.resolve();
  private closed = false;
  private poisoned = false;
  private readonly connection: SqlConnection;
  constructor(connection: SqlConnection) { this.connection = connection; }

  private queue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(async () => {
      if (this.closed || this.poisoned) throw new Error('Storage is unavailable. Restart Nodebt; existing data has not been reset.');
      return task();
    });
    this.tail = next.catch(() => undefined);
    return next;
  }

  read<T>(task: (sql: SqlConnection) => Promise<T>): Promise<T> {
    return this.queue(() => task(this.connection));
  }

  transaction<T>(task: (sql: SqlConnection) => Promise<T>): Promise<T> {
    return this.queue(async () => {
      await this.connection.exec('BEGIN IMMEDIATE');
      try {
        const result = await task(this.connection);
        await this.connection.exec('COMMIT');
        return result;
      } catch (error) {
        try { await this.connection.exec('ROLLBACK'); }
        catch { this.poisoned = true; }
        throw error;
      }
    });
  }

  close(): Promise<void> {
    const close = this.tail.then(async () => {
      if (!this.closed) { this.closed = true; await this.connection.close(); }
    });
    this.tail = close.catch(() => undefined);
    return close;
  }
}