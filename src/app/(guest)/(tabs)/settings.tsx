import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge, Card, Copy, DataRow, IconCircle, LinkRow, Notice, Page, Section } from '@/components/nodebt/ui';
import { launch } from '@/config/product';
import { font } from '@/design/tokens';
import { useGuest } from '@/features/guest/provider';
export default function Settings() {
  const { snapshot } = useGuest();
  const custom = snapshot.categories.filter((row) => row.kind === 'custom');
  return <Page title="Settings" subtitle="Your ledger. Your choices.">
    <Card tone="brand"><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><IconCircle icon="user" size={48} /><View style={{ flex: 1, gap: 4 }}><Copy variant="heading">Private guest ledger</Copy><Copy variant="caption">Stored on this device</Copy></View><Badge label="Free" tone="brand" /></View></Card>
    <Section title="Your ledger"><Card padded={false}>
      <LinkRow icon="grid" title="Categories" subtitle={`${custom.length} custom categories across borrowing and lending`} onPress={() => router.push('/categories')} />
      <LinkRow icon="globe" title="Currency" subtitle="Existing amounts keep their recorded currency." value={launch.currency} last />
    </Card></Section>
    <Section title="Privacy & storage"><Card padded={false}>
      <LinkRow icon="shield" title="Encrypted on this device" subtitle="Your guest records stay in protected local storage." value="Local" />
      <LinkRow icon="cloud-off" title="Backup & recovery" subtitle="Cloud backup and encrypted export/restore are not available yet." value="Unavailable" />
      <LinkRow icon="lock" title="App Lock" subtitle="Planned for a later milestone, including Free users." value="Planned" />
      <LinkRow icon="bell" title="Reminders" subtitle="Device reminders are not enabled in this build." value="Planned" last />
    </Card></Section>
    <Notice tone="warning" icon="alert-triangle">Keep this installation. Uninstalling or losing this device may make guest data unrecoverable until backup and recovery are available.</Notice>
    <Section title="Account & access"><Card padded={false}>
      <LinkRow icon="log-in" title="Welcome & sign-in" subtitle="Review the existing Google and Guest entry options." onPress={() => router.push('/welcome')} last />
    </Card></Section>
    <Card><Copy style={{ fontFamily: font.semibold }}>Guest plan</Copy><DataRow label="Default categories" value="6 per direction" /><DataRow label="Custom categories" value="Up to 3 per direction" /><DataRow label="Financial records" value="Unlimited" last />
      <Copy variant="caption">Account storage, purchases and advertisements are not available in this build. Guest records are not automatically uploaded or merged.</Copy></Card>
    <Copy variant="caption" style={{ textAlign: 'center', marginTop: 8 }}>NoDebt · A clearer view of every borrowing and lending record.</Copy>
  </Page>;
}
