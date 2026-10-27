import type { GuestRepository } from './repository.ts';

export function localToday(): string {
  const now = new Date();
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export async function openGuestRepository(): Promise<GuestRepository> {
  throw new Error('Encrypted guest tracking is available in the Nodebt Android or iOS development build. Web does not store your financial data.');
}