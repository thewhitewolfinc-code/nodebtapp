/** Display-only formatting; stored calendar dates and domain money remain unchanged. */
export function displayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}
export const recordTypeNames = { loan: 'Loan', credit_card: 'Credit card', bnpl: 'Buy now, pay later', informal: 'Personal', other: 'Other' } as const;
export const recordTypeIcons = { loan: 'briefcase', credit_card: 'credit-card', bnpl: 'shopping-bag', informal: 'users', other: 'file-text' } as const;
