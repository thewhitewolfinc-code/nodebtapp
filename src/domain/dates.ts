/** User-entered financial dates are local calendar dates, independent of UTC timestamps. */
export type DateOnly = string;

export function assertDateOnly(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use a YYYY-MM-DD date.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('The calendar date is invalid.');
  }
}

export function assertTimestamp(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
      || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error('Use a canonical UTC timestamp.');
  }
}

/** Keep the original day anchor: Jan 31 -> Feb 28 -> Mar 31, without DST drift. */
export function monthlyDate(firstDueOn: DateOnly, offset: number): DateOnly {
  assertDateOnly(firstDueOn);
  if (!Number.isInteger(offset) || offset < 0 || offset > 600) throw new Error('Invalid month offset.');
  const first = new Date(`${firstDueOn}T00:00:00.000Z`);
  const target = new Date(first);
  target.setUTCDate(1);
  target.setUTCMonth(first.getUTCMonth() + offset);
  const last = new Date(target);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  target.setUTCDate(Math.min(first.getUTCDate(), last.getUTCDate()));
  const result = target.toISOString().slice(0, 10);
  assertDateOnly(result);
  return result;
}
