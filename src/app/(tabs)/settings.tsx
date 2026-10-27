import { router } from 'expo-router';
import { Button, Card, Copy, Page } from '@/components/nodebt/ui';
import { launch } from '@/config/product';
export default function Settings() {
  return <Page title="Settings" subtitle="Guest mode · Free category access">
    <Button label="Manage categories" onPress={() => router.push('/categories')} />
    <Card><Copy variant="heading">Currency</Copy><Copy>{launch.currency} · Initial ledger currency</Copy>
      <Copy variant="caption">Other currencies will be introduced explicitly; existing amounts will never be relabeled.</Copy></Card>
    <Card><Copy variant="heading">Storage and recovery</Copy><Copy>Your guest ledger is encrypted on this device. Cloud backup and encrypted export/restore are not available yet. Uninstalling or losing the device may make guest data unrecoverable.</Copy></Card>
    <Card><Copy variant="heading">Privacy features</Copy><Copy>Device App Lock, reminders and complete backups are planned for the next milestone and will be available to Free users.</Copy></Card>
    <Copy variant="caption">Account sign-in, purchases and advertisements are not enabled in this milestone.</Copy>
  </Page>;
}