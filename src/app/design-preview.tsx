import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, Confirmation, Copy, DesignReadOnlyContext, Field, LoadingState, Page, Problem, Section } from '@/components/nodebt/ui';
import { GuestContext, type GuestContextValue } from '@/features/guest/provider';
import { useTheme } from '@/hooks/use-theme';
import Home from './(guest)/(tabs)/home';
import Records from './(guest)/(tabs)/records';
import Activity from './(guest)/(tabs)/activity';
import Insights from './(guest)/(tabs)/insights';
import Settings from './(guest)/(tabs)/settings';
import NewRecord from './(guest)/record/new';
import RecordDetail from './(guest)/record/[id]/index';
import Entry from './(guest)/record/[id]/entry';
import Categories from './(guest)/categories';
import type { GuestSnapshot } from '@/storage/models';

const samples = [
  ['home', 'Overview'], ['records', 'Records'], ['activity', 'Activity'], ['insights', 'Insights'], ['settings', 'Settings'],
  ['new', 'New record'], ['detail', 'Record details'], ['payment', 'Repayment'], ['collection', 'Collection'], ['settlement', 'Settlement'],
  ['correction', 'Correction'], ['closed', 'Closed record'], ['categories', 'Categories'], ['category-limit', 'Category limit'], ['missing', 'Not found'], ['states', 'UI states'],
] as const;
function UIStates() {
  const [confirm, setConfirm] = useState(false);
  return <DesignReadOnlyContext value={false}><Page title="Component states" subtitle="Interactive design samples. No financial writes occur.">
    <Section title="Inputs"><Card><Field label="Default input" placeholder="Enter an amount" /><Field label="Disabled input" value="Unavailable" editable={false} />
      <Field label="Input with error" value="-250" error="Enter a positive amount for this sample." /></Card></Section>
    <Section title="Buttons"><Button label="Primary action" onPress={() => undefined} /><Button label="Secondary action" secondary onPress={() => undefined} />
      <Button label="Selected option" secondary selected onPress={() => undefined} /><Button label="Disabled action" disabled onPress={() => undefined} />
      <Button label="Saving changes" loading onPress={() => undefined} /><Button label="Destructive action" tone="danger" onPress={() => undefined} /></Section>
    <Section title="Feedback"><Card><Badge label="Outstanding" tone="brand" /><Badge label="Overdue" tone="danger" /><Badge label="Paid off" tone="success" /><Badge label="Archived" /><Badge label="Pending" tone="warning" /></Card>
      <Problem message="Sample error. Review the information and try again." /><LoadingState /></Section>
    <Button label="Preview confirmation" onPress={() => setConfirm(true)} />
    <Confirmation visible={confirm} title="Confirm this sample?" description="This is a visual preview. No financial changes will be saved." confirmLabel="Confirm sample" onConfirm={() => setConfirm(false)} onCancel={() => setConfirm(false)} />
  </Page></DesignReadOnlyContext>;
}
/** Development-only catalog. Samples are memory-only; every financial write is blocked. */
export default function DesignPreview() {
  const params = useLocalSearchParams<{ view?: string; id?: string; kind?: string; entryId?: string }>(), theme = useTheme();
  if (!__DEV__) return <Redirect href="/home" />;
  // Keep the sample module synchronous and behind Metro's development-only guard.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro must include this development-only module synchronously.
  const { designSnapshot: snapshot } = require('@/features/design-preview/fixtures') as { designSnapshot: GuestSnapshot };
  const selected = params.view ?? 'home';
  const shownSnapshot: GuestSnapshot = selected === 'category-limit' ? { ...snapshot, categories: [...snapshot.categories,
    { id: 'preview-custom-2', direction: 'borrowed', name: 'Family events', kind: 'custom', freeDefault: false, archived: true, sortOrder: 101 },
    { id: 'preview-custom-3', direction: 'borrowed', name: 'Other expenses', kind: 'custom', freeDefault: false, archived: false, sortOrder: 102 },
  ] } : snapshot;
  const context: GuestContextValue = { snapshot: shownSnapshot, busy: false, today: '2026-10-30', createOperationId: () => 'preview-no-writes',
    execute: async () => { throw new Error('This design preview is read-only. No records were changed.'); } };
  function choose(screen: string) {
    router.replace({ pathname: '/design-preview', params: { view: screen,
      id: screen === 'collection' ? 'preview-friend' : screen === 'closed' ? 'preview-closed' : screen === 'missing' ? 'missing-sample' : 'preview-home',
      kind: screen === 'settlement' ? 'settlement' : 'payment', entryId: screen === 'correction' ? 'preview-home-payment' : '' } });
  }
  const content = selected === 'home' ? <Home /> : selected === 'records' ? <Records /> : selected === 'activity' ? <Activity /> : selected === 'insights' ? <Insights /> : selected === 'settings' ? <Settings /> :
    selected === 'new' ? <NewRecord /> : ['detail', 'closed', 'missing'].includes(selected) ? <RecordDetail /> : ['categories', 'category-limit'].includes(selected) ? <Categories /> : selected === 'states' ? <UIStates /> : <Entry />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.backgroundElement }} edges={['top']}>
    <View style={{ padding: 12, gap: 8, borderBottomWidth: 1, borderColor: theme.border }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View><Copy style={{ fontSize: 12 }}>Design preview · Sample data</Copy><Copy variant="caption">Read-only. Your guest ledger is untouched.</Copy></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close design preview" onPress={() => router.replace('/home')} style={{ padding: 12 }}><Copy>Close</Copy></Pressable>
    </View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{samples.map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: selected === value }} onPress={() => choose(value)}
      style={{ minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, borderRadius: 12, backgroundColor: selected === value ? theme.brandSurface : theme.background }}><Copy variant="caption">{label}</Copy></Pressable>)}</ScrollView></View>
    <GuestContext value={context}><DesignReadOnlyContext value><View key={selected} style={{ flex: 1 }}>{content}</View></DesignReadOnlyContext></GuestContext>
  </SafeAreaView>;
}
