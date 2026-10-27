import { Redirect } from 'expo-router';
import { useGuest } from '@/features/guest/provider';

export default function Index() {
  const { snapshot } = useGuest();
  return <Redirect href={snapshot.onboardingComplete ? '/home' : '/welcome'} />;
}