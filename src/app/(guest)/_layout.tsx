import { Slot } from 'expo-router';
import { LedgerBoundary } from '@/features/auth/ledger-boundary';

export default function GuestLayout() {
  return <LedgerBoundary><Slot /></LedgerBoundary>;
}
