import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useAuthSession } from './session';
import { navigationFor } from './navigation';
import { useWorkspace } from './workspace';
import { SessionStartup } from './startup';
import { openGuestRepository } from '@/storage/open';
export default function Entry() {
  const { state } = useAuthSession();
  const workspace = useWorkspace();
  useEffect(() => {
    if (state !== 'signed-out' || !workspace.ready || workspace.mode !== null || workspace.pending || workspace.error) return;
    let mounted = true;
    void openGuestRepository().then(repository => repository.snapshot()).then(snapshot => {
      if (mounted) return workspace.store.choose(snapshot.onboardingComplete ? 'guest' : 'entry');
    }).catch(() => { if (mounted) void workspace.store.choose('entry').catch(() => undefined); });
    return () => { mounted = false; };
  }, [state, workspace.ready, workspace.mode, workspace.pending, workspace.error, workspace.store]);
  if (state === 'loading' || !workspace.ready || workspace.mode === null) return <SessionStartup />;
  return <Redirect href={navigationFor(state, workspace).destination} />;
}
