import { assertMinorUnits, parseRupees } from '../../domain/money.ts';

export function parseAmount(text: string, signed = false, optional = false): number {
  const value = text.trim();
  if (!value && optional) return 0;
  if (signed && value.startsWith('-')) return -parseRupees(value.slice(1));
  return parseRupees(value);
}
export function amountInput(amount: number): string {
  assertMinorUnits(amount, 'Amount', true);
  const absolute = Math.abs(amount);
  return `${amount < 0 ? '-' : ''}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}
export function installmentCount(text: string): number {
  if (!/^\d+$/.test(text.trim())) throw new Error('Installment count must be a whole number.');
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count < 1 || count > 600) throw new Error('Enter 1–600 installments.');
  return count;
}