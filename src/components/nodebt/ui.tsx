import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Children, createContext, useContext, useEffect, useRef, useState, type ComponentRef, type PropsWithChildren, type ReactNode } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  useWindowDimensions, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, layout, radius, space } from '@/design/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Icon, type IconName } from './icon';
export { Icon, type IconName } from './icon';
export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
export const DesignReadOnlyContext = createContext(false);

export function Copy({ children, variant = 'body', color, style }: PropsWithChildren<{
  variant?: 'body' | 'title' | 'heading' | 'caption' | 'metric' | 'overline'; color?: string; style?: StyleProp<TextStyle>;
}>) {
  const theme = useTheme();
  return <Text accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : undefined}
    style={[styles.text, styles[variant], { color: color ?? (variant === 'caption' || variant === 'overline' ? theme.textSecondary : theme.text) }, style]}>{children}</Text>;
}
export function Page({ title, subtitle, back, backTarget = '/home', eyebrow, action, headerBadge, revealBottom, children }: PropsWithChildren<{
  title: string; subtitle?: string; back?: boolean; backTarget?: Href; eyebrow?: string; action?: ReactNode; headerBadge?: ReactNode; revealBottom?: string;
}>) {
  const theme = useTheme(), insets = useSafeAreaInsets(), scheme = useColorScheme(), readOnly = useContext(DesignReadOnlyContext);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { if (revealBottom) requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true })); }, [revealBottom]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={readOnly ? ['left', 'right'] : ['top', 'left', 'right']}>
    <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.page, { maxWidth: back ? 720 : 1040, paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.brandRow}>
          {back ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" disabled={readOnly} style={styles.back}
            onPress={() => router.canGoBack() ? router.back() : router.replace(backTarget)}>
            <Icon name="arrow-left" color={theme.text} /><Copy style={{ fontFamily: font.medium }}>Back</Copy>
          </Pressable> : <View style={styles.brand}><Image source={require('../../../assets/auth/brand-mark.png')} style={styles.brandMark} resizeMode="contain" accessible={false} />
            <Copy style={styles.brandName}>NoDebt</Copy></View>}
          {headerBadge ?? <Badge label="On-device" icon="shield" tone="brand" />}
        </View>
        <View style={styles.pageHeading}><View style={{ flex: 1, gap: space.xxs }}>
          {eyebrow && <Copy variant="overline" color={theme.brand}>{eyebrow}</Copy>}
          <Copy variant="title">{title}</Copy>
          {subtitle && <Copy variant="caption" style={{ fontSize: 13, lineHeight: 20 }}>{subtitle}</Copy>}
        </View>{action}</View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function Card({ children, tone = 'neutral', style, padded = true }: PropsWithChildren<{ tone?: Tone; style?: StyleProp<ViewStyle>; padded?: boolean }>) {
  const theme = useTheme();
  const background = tone === 'brand' ? theme.brandSurface : tone === 'warning' ? theme.warningSurface : tone === 'danger' ? theme.errorSurface : tone === 'info' ? theme.infoSurface : theme.backgroundElement;
  return <View style={[styles.card, { backgroundColor: background, borderColor: theme.border }, !padded && { padding: 0, gap: 0 }, style]}>{children}</View>;
}
export function Row({ children }: PropsWithChildren) { return <View style={styles.row}>{children}</View>; }
export function Grid({ children, columns = 2 }: PropsWithChildren<{ columns?: number }>) {
  const { width, fontScale } = useWindowDimensions();
  const count = width < 380 || fontScale > 1.25 ? 1 : width >= 900 ? columns : Math.min(2, columns);
  return <View style={styles.row}>{Children.toArray(children).map((child, index) => <View key={index} style={{ flexGrow: 1, flexBasis: `${Math.floor(100 / count) - 2}%`, minWidth: 0 }}>{child}</View>)}</View>;
}
export function Button({ label, onPress, disabled = false, secondary = false, selected = false, icon, tone, loading = false, previewSafe = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; selected?: boolean; icon?: IconName; tone?: 'danger'; loading?: boolean; previewSafe?: boolean;
}) {
  const theme = useTheme(), readOnly = useContext(DesignReadOnlyContext);
  const [focused, setFocused] = useState(false);
  const locked = disabled || loading || (readOnly && !previewSafe);
  const ink = tone === 'danger' ? theme.error : secondary ? selected ? theme.brand : theme.text : theme.actionInk;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: locked, selected, busy: loading }} disabled={locked}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={onPress}
    style={({ pressed }) => [styles.button, {
      backgroundColor: tone === 'danger' ? theme.errorSurface : secondary ? selected ? theme.backgroundSelected : theme.backgroundElement : pressed ? theme.actionPressed : theme.action,
      borderColor: focused ? theme.focus : selected ? theme.brand : secondary ? theme.controlBorder : 'transparent',
      opacity: locked && !readOnly ? 0.48 : pressed ? 0.8 : 1,
    }]}>{loading ? <ActivityIndicator color={ink} /> : icon && <Icon name={icon} size={18} color={ink} />}
    <Text style={[styles.buttonText, { color: ink }]}>{label}</Text>
  </Pressable>;
}
export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme(), readOnly = useContext(DesignReadOnlyContext);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={readOnly} onPress={onPress}
    style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.action, opacity: pressed ? 0.75 : 1 }]}><Icon name={icon} color={theme.actionInk} /></Pressable>;
}
export function Field({ label, hint, icon, error, style, ...props }: TextInputProps & { label: string; hint?: string; icon?: IconName; error?: string }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}>
    <Copy style={styles.fieldLabel}>{label}</Copy>
    <View style={[styles.inputWrap, { backgroundColor: focused ? theme.backgroundElement : theme.background,
      borderColor: error ? theme.error : focused ? theme.focus : theme.controlBorder }, focused && { borderWidth: 2 }, props.editable === false && { opacity: 0.6 }]}>
      {icon && <Icon name={icon} size={18} color={theme.textSecondary} />}
      <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? label} autoCapitalize={props.autoCapitalize ?? 'none'}
        editable={props.editable !== false} placeholderTextColor={theme.muted} selectionColor={theme.brand}
        underlineColorAndroid="transparent" onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
        style={[styles.input, { color: theme.text }, props.multiline && { minHeight: 88, textAlignVertical: 'top' }, style]} />
    </View>
    {error ? <Copy variant="caption" color={theme.error}>{error}</Copy> : hint && <Copy variant="caption">{hint}</Copy>}
  </View>;
}
export function Toggle({ label, value, onChange, disabled, hint }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; hint?: string }) {
  const theme = useTheme();
  return <View style={[styles.switchRow, { borderBottomColor: theme.border }]}><View style={{ flex: 1, gap: 4 }}><Copy style={{ fontFamily: font.medium }}>{label}</Copy>{hint && <Copy variant="caption">{hint}</Copy>}</View>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled}
      trackColor={{ false: theme.controlBorder, true: theme.brand }} thumbColor={theme.backgroundElement} /></View>;
}
export function Segments<T extends string>({ options, value, onChange, disabled }: {
  options: readonly { value: T; label: string; icon?: IconName }[]; value: T; onChange: (value: T) => void; disabled?: boolean;
}) {
  const theme = useTheme();
  return <View accessibilityRole="tablist" style={[styles.segments, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
    {options.map((option) => <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: value === option.value, disabled: !!disabled }}
      disabled={disabled} onPress={() => onChange(option.value)} style={({ pressed }) => [styles.segment, {
        backgroundColor: value === option.value ? theme.backgroundElement : 'transparent', opacity: pressed ? 0.65 : 1,
        borderColor: value === option.value ? theme.border : 'transparent' }]}>
      {option.icon && <Icon name={option.icon} size={16} color={value === option.value ? theme.brand : theme.textSecondary} />}
      <Text style={[styles.segmentLabel, { color: value === option.value ? theme.brand : theme.textSecondary }]}>{option.label}</Text>
    </Pressable>)}
  </View>;
}
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const theme = useTheme();
  const foreground = tone === 'danger' ? theme.error : tone === 'warning' ? theme.warning : tone === 'success' ? theme.success : tone === 'brand' ? theme.brand : tone === 'info' ? theme.info : theme.textSecondary;
  const background = tone === 'danger' ? theme.errorSurface : tone === 'warning' ? theme.warningSurface : tone === 'success' ? theme.successSurface : tone === 'brand' ? theme.brandSurface : tone === 'info' ? theme.infoSurface : theme.background;
  return <View style={[styles.badge, { backgroundColor: background }]}>{icon && <Icon name={icon} size={12} color={foreground} />}<Text style={[styles.badgeText, { color: foreground }]}>{label}</Text></View>;
}
export function IconCircle({ icon, tone = 'brand', size = 40 }: { icon: IconName; tone?: Tone; size?: number }) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.error : tone === 'warning' ? theme.warning : tone === 'info' ? theme.info : theme.brand;
  const background = tone === 'danger' ? theme.errorSurface : tone === 'warning' ? theme.warningSurface : tone === 'info' ? theme.infoSurface : theme.brandSurface;
  return <View style={{ width: size, height: size, borderRadius: radius.md, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={Math.round(size * 0.45)} color={color} /></View>;
}
export function Section({ title, subtitle, action, children }: PropsWithChildren<{ title: string; subtitle?: string; action?: ReactNode }>) {
  return <View style={styles.section}><View style={styles.sectionHeader}><View style={{ flex: 1, gap: 3 }}><Copy variant="heading">{title}</Copy>{subtitle && <Copy variant="caption">{subtitle}</Copy>}</View>{action}</View>{children}</View>;
}
export function EmptyState({ icon = 'inbox', title, description, action }: { icon?: IconName; title: string; description: string; action?: ReactNode }) {
  return <Card style={styles.empty}><IconCircle icon={icon} size={56} /><Copy variant="heading" style={{ textAlign: 'center' }}>{title}</Copy><Copy variant="caption" style={{ textAlign: 'center', maxWidth: 320 }}>{description}</Copy>{action}</Card>;
}
export function Notice({ children, tone = 'info', icon = 'info' }: PropsWithChildren<{ tone?: Tone; icon?: IconName }>) {
  const theme = useTheme();
  return <Card tone={tone} style={styles.notice}><Icon name={icon} size={18} color={tone === 'warning' ? theme.warning : tone === 'danger' ? theme.error : theme.brand} /><View style={{ flex: 1 }}><Copy variant="caption">{children}</Copy></View></Card>;
}
export function Metric({ label, value, icon, tone = 'brand', note }: { label: string; value: string; icon: IconName; tone?: Tone; note?: string }) {
  const theme = useTheme();
  return <Card style={{ flex: 1, gap: 8 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}><IconCircle icon={icon} tone={tone} size={30} /><Copy variant="caption" style={{ flex: 1 }}>{label}</Copy></View>
    <Copy variant="metric" color={theme.text} style={{ fontSize: value.length > 20 ? 16 : value.length >= 10 ? 20 : 26, lineHeight: 34 }}>{value}</Copy>{note && <Copy variant="caption">{note}</Copy>}
  </Card>;
}
export function DataRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const theme = useTheme(), { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.25 || value.length > 30;
  return <View style={[styles.dataRow, { flexDirection: stacked ? 'column' : 'row', gap: stacked ? 4 : 16, borderBottomColor: theme.border, borderBottomWidth: last ? 0 : 1 }]}>
    <Copy variant="caption" style={{ flex: stacked ? undefined : 1 }}>{label}</Copy><Copy style={{ fontFamily: font.medium, flexShrink: 1, textAlign: stacked ? 'left' : 'right' }}>{value}</Copy>
  </View>;
}
export function LinkRow({ title, subtitle, icon, onPress, value, disabled, last = false }: {
  title: string; subtitle?: string; icon: IconName; onPress?: () => void; value?: string; disabled?: boolean; last?: boolean;
}) {
  const theme = useTheme(), readOnly = useContext(DesignReadOnlyContext);
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress || disabled || readOnly} onPress={onPress}
    accessibilityState={{ disabled: !!disabled }} style={({ pressed }) => [styles.linkRow, { borderBottomColor: theme.border, borderBottomWidth: last ? 0 : 1, opacity: pressed ? 0.7 : 1 }]}>
    <IconCircle icon={icon} size={36} /><View style={{ flex: 1, gap: 3 }}><Copy style={{ fontFamily: font.medium }}>{title}</Copy>{subtitle && <Copy variant="caption">{subtitle}</Copy>}</View>
    {value && <Badge label={value} />}{onPress && <Icon name="chevron-right" size={18} color={theme.textSecondary} />}
  </Pressable>;
}
export function Confirmation({ visible, title, description, busy, confirmLabel, onConfirm, onCancel, children }: PropsWithChildren<{
  visible: boolean; title: string; description: string; busy?: boolean; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}>) {
  const theme = useTheme();
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { if (!busy) onCancel(); }}>
    <View style={styles.modalBackdrop}><View accessibilityViewIsModal style={[styles.modal, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled"><IconCircle icon="help-circle" size={48} /><Copy variant="heading">{title}</Copy><Copy>{description}</Copy>{children}
      <Button label={confirmLabel} loading={busy} onPress={onConfirm} /><Button label="Cancel" previewSafe secondary disabled={busy} onPress={onCancel} /></ScrollView>
    </View></View>
  </Modal>;
}
export function LoadingState({ title = 'Getting your ledger ready', description = 'Opening your private records on this device.' }: { title?: string; description?: string }) {
  const theme = useTheme();
  return <Card style={{ paddingVertical: space.xxl }}><ActivityIndicator color={theme.brand} /><Copy variant="heading" style={{ textAlign: 'center' }}>{title}</Copy><Copy variant="caption" style={{ textAlign: 'center' }}>{description}</Copy>
    {[1, 2, 3].map((value) => <View key={value} style={{ height: value === 1 ? 24 : 12, width: value === 1 ? '65%' : '90%', alignSelf: 'center', borderRadius: 8, backgroundColor: theme.border, marginTop: 4 }} />)}</Card>;
}
export function Problem({ message }: { message?: string }) {
  const theme = useTheme();
  return message ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.card, { backgroundColor: theme.errorSurface, borderColor: theme.error }]}>
    <View style={styles.row}><Icon name="alert-circle" color={theme.error} /><Copy style={{ color: theme.error, fontFamily: font.semibold }}>Please review</Copy></View><Copy color={theme.error}>{message}</Copy>
  </View> : null;
}
export function errorMessage(error: unknown): string {
  if (error instanceof Error && /SQLITE|constraint|database is locked|disk|I\/O/i.test(error.message)) {
    return 'The change could not be saved. Existing records were not reset. Check device storage, then retry. If this persists, restart Nodebt.';
  }
  return error instanceof Error ? error.message : 'The change could not be saved. Please retry.';
}
export function Disclosure({ title, subtitle, children, initiallyOpen = false }: PropsWithChildren<{ title: string; subtitle?: string; initiallyOpen?: boolean }>) {
  const theme = useTheme(); const [open, setOpen] = useState(initiallyOpen);
  return <Card><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
    style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ flex: 1, gap: 4 }}><Copy style={{ fontFamily: font.semibold }}>{title}</Copy>{subtitle && <Copy variant="caption">{subtitle}</Copy>}</View>
    <Icon name={open ? 'chevron-up' : 'chevron-down'} color={theme.textSecondary} size={18} />
  </Pressable>{open && <View style={{ gap: 12, paddingTop: 8 }}>{children}</View>}</Card>;
}
const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 1040, alignSelf: 'center', padding: 20, gap: space.md, flexGrow: 1 },
  text: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, includeFontPadding: false },
  body: {}, title: { fontFamily: font.bold, fontSize: 28, lineHeight: 36, letterSpacing: -0.8 },
  heading: { fontFamily: font.semibold, fontSize: 18, lineHeight: 25, letterSpacing: -0.3 },
  caption: { fontSize: 12, lineHeight: 18 }, metric: { fontFamily: font.semibold, fontSize: 29, lineHeight: 38, letterSpacing: -0.9, fontVariant: ['tabular-nums'] },
  overline: { fontFamily: font.semibold, fontSize: 10, lineHeight: 16, letterSpacing: 1.5, textTransform: 'uppercase' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 40 },
  brand: { flexDirection: 'row', gap: 8, alignItems: 'center' }, brandMark: { width: 22, height: 26 }, brandName: { fontFamily: font.bold, fontSize: 18, letterSpacing: -0.6 },
  back: { minHeight: layout.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 },
  pageHeading: { flexDirection: 'row', gap: space.sm, alignItems: 'center', paddingVertical: space.xs },
  card: { padding: space.md, borderRadius: radius.lg, borderWidth: 1, gap: space.sm }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'stretch' },
  button: { minHeight: layout.minTouchTarget, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1.5,
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: font.semibold, fontSize: 13, lineHeight: 20, textAlign: 'center', flexShrink: 1, includeFontPadding: false },
  iconButton: { height: 48, width: 48, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' },
  field: { gap: 7 }, fieldLabel: { fontSize: 12, lineHeight: 18, fontFamily: font.medium },
  inputWrap: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: space.sm },
  input: { minHeight: 50, paddingVertical: space.sm, flex: 1, fontSize: 14, lineHeight: 21, fontFamily: font.regular, includeFontPadding: false },
  switchRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  segments: { padding: 4, gap: 4, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap' },
  segment: { flexGrow: 1, flexBasis: 80, minHeight: 44, borderRadius: radius.md, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 8, gap: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { fontFamily: font.semibold, fontSize: 12, lineHeight: 18, flexShrink: 1, textAlign: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, gap: 4, flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  badgeText: { fontFamily: font.medium, fontSize: 10, lineHeight: 14, flexShrink: 1, includeFontPadding: false },
  section: { gap: space.sm, paddingTop: space.xs }, sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  empty: { alignItems: 'center', paddingVertical: space.xl, gap: space.sm }, notice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dataRow: { flexDirection: 'row', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10 },
  linkRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', padding: 14, gap: space.sm },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(6,20,12,0.48)', justifyContent: 'center', padding: 24 },
  modal: { padding: 24, gap: 16, borderRadius: radius.xl, borderWidth: 1, width: '100%', maxWidth: 460, maxHeight: '90%', alignSelf: 'center' },
});
