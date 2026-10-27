import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type TextInputProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

export function Copy({ children, variant = 'body' }: PropsWithChildren<{ variant?: 'body' | 'title' | 'heading' | 'caption' }>) {
  const theme = useTheme();
  return <Text style={[styles.text, variant === 'title' ? styles.title : variant === 'heading' ? styles.heading :
    variant === 'caption' ? styles.caption : undefined, { color: variant === 'caption' ? theme.textSecondary : theme.text }]}>{children}</Text>;
}
export function Page({ title, subtitle, back, children }: PropsWithChildren<{ title: string; subtitle?: string; back?: boolean }>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 32 }]}>
        {back && <Button label="‹ Back" secondary onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} />}
        <Copy variant="title">{title}</Copy>
        {subtitle && <Copy variant="caption">{subtitle}</Copy>}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function Card({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{children}</View>;
}
export function Row({ children }: PropsWithChildren) { return <View style={styles.row}>{children}</View>; }
export function Button({ label, onPress, disabled = false, secondary = false, selected = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; selected?: boolean;
}) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, {
      backgroundColor: secondary ? selected ? theme.backgroundSelected : theme.backgroundElement : theme.text,
      borderColor: selected ? theme.text : 'transparent', opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
    }]}><Text style={[styles.buttonText, { color: secondary ? theme.text : theme.background }]}>{label}</Text></Pressable>;
}
export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const theme = useTheme();
  return <View style={styles.field}>
    <Copy>{label}</Copy>
    <TextInput accessibilityLabel={label} autoCapitalize="none" placeholderTextColor={theme.textSecondary}
      {...props} style={[styles.input, { color: theme.text, borderColor: theme.textSecondary, backgroundColor: theme.background }]} />
    {hint && <Copy variant="caption">{hint}</Copy>}
  </View>;
}
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <View style={styles.switchRow}><View style={{ flex: 1 }}><Copy>{label}</Copy></View>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} /></View>;
}
export function Problem({ message }: { message?: string }) {
  const theme = useTheme();
  return message ? <View accessibilityRole="alert" style={[styles.card, { borderWidth: 1, borderColor: theme.textSecondary }]}>
    <Copy variant="heading">Please review</Copy><Copy>{message}</Copy>
  </View> : null;
}
export function errorMessage(error: unknown): string {
  if (error instanceof Error && /SQLITE|constraint|database is locked|disk|I\/O/i.test(error.message)) {
    return 'The change could not be saved. Existing records were not reset. Check device storage, then retry. If this persists, restart Nodebt.';
  }
  return error instanceof Error ? error.message : 'The change could not be saved. Please retry.';
}
const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 24, gap: 16, flexGrow: 1 },
  text: { fontSize: 16, lineHeight: 24 }, title: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  heading: { fontSize: 19, lineHeight: 26, fontWeight: '600' }, caption: { fontSize: 14, lineHeight: 21 },
  card: { borderRadius: 16, padding: 18, gap: 10 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { minHeight: 48, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center' }, buttonText: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  field: { gap: 6 }, input: { minHeight: 48, borderWidth: 1, padding: 12, borderRadius: 10, fontSize: 16 },
  switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 16 },
});