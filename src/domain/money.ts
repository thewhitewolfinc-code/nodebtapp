/** Financial values are integer minor units (paise), never floating-point rupees. */
export type MinorUnits = number;
export type Currency = 'INR';

export function assertMinorUnits(value: number, label = 'Amount', signed = false): void {
  if (!Number.isSafeInteger(value) || (!signed && value < 0)) {
    throw new Error(`${label} must be ${signed ? 'a signed' : 'a nonnegative'} safe integer in paise.`);
  }
}

export function addMoney(...amounts: readonly MinorUnits[]): MinorUnits {
  return amounts.reduce((total, amount) => {
    assertMinorUnits(amount, 'Amount', true);
    const next = total + amount;
    assertMinorUnits(next, 'Total', true);
    return next;
  }, 0);
}

/** Strict decimal parsing avoids rounding 1.005, exponent notation, or silently truncated paise. */
export function parseRupees(input: string): MinorUnits {
  const text = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error('Enter a nonnegative rupee amount with at most two decimal places.');
  }
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  assertMinorUnits(amount);
  return amount;
}

export function formatMoney(amount: MinorUnits, currency: Currency = 'INR'): string {
  assertMinorUnits(amount, 'Amount', true);
  if (currency !== 'INR') throw new Error('Only INR is supported at launch.');
  // Format integer rupees and paise separately so large safe integers do not lose a paisa on division.
  const absolute = Math.abs(amount);
  const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.floor(absolute / 100));
  return `${amount < 0 ? '-' : ''}₹${whole}.${String(absolute % 100).padStart(2, '0')}`;
}
