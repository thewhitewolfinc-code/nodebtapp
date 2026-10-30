import { Redirect } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { GuestProvider } from '@/features/guest/provider';
import { navigationFor } from './navigation';
import { useWorkspace } from './workspace';
import { SessionStartup } from './startup';
import { useAuthSession } from './session';

/** Gate all financial routes, including direct links, before mounting guest storage. */
export function LedgerBoundary({ children }: PropsWithChildren) {
  const session = useAuthSession();
  // Native stacks retain inactive screens. This group must retain its guest
  // provider when a public route becomes active above it. Only session state gates it.
  const access = navigationFor(session.state, useWorkspace());
  if (session.state === 'loading') return <SessionStartup />;
  if (!access.guest) return <Redirect href={access.destination} />;
  return <GuestProvider>{children}</GuestProvider>;
}
