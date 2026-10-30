import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { layout, palette, radius, space, stroke, type } from '@/design/tokens';

/** Shared action with a stable label, 54dp target, and visible focus/pressed/loading states. */
export function ActionButton({ label, onPress, icon, secondary = false, loading = false, disabled = false }: {
  label: string; onPress: () => void; icon?: ReactNode; secondary?: boolean; loading?: boolean; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: unavailable, busy: loading }} disabled={unavailable}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary ? styles.secondary : styles.primary,
      pressed && { backgroundColor: secondary ? palette.surfaceSubtle : palette.actionPressed },
      unavailable && { opacity: 0.65 }, focused && styles.focus]}>
    <View importantForAccessibility="no-hide-descendants" style={[styles.icon, secondary && styles.guestIcon]}>
      {loading ? <ActivityIndicator color={palette.brand[900]} /> : icon}
    </View>
    <Text style={styles.label}>{label}</Text>
    <View importantForAccessibility="no-hide-descendants" style={styles.arrow}><View style={styles.arrowLine} /><View style={styles.arrowHead} /></View>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: layout.buttonHeight, borderRadius: radius.pill, borderWidth: stroke.hairline,
    flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs, paddingLeft: space.lg, paddingRight: space.lg, gap: space.lg },
  primary: { backgroundColor: palette.action, borderColor: palette.action },
  secondary: { backgroundColor: palette.surface, borderColor: palette.border },
  focus: { borderColor: palette.focus, borderWidth: stroke.strong },
  icon: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: palette.surface,
    alignItems: 'center', justifyContent: 'center' },
  guestIcon: { backgroundColor: palette.brand[50] },
  label: { ...type.label, flex: 1, color: palette.actionText, letterSpacing: -0.5 },
  arrow: { width: 16, height: 20, justifyContent: 'center' },
  arrowLine: { height: 1.5, width: 14, backgroundColor: palette.text },
  arrowHead: { position: 'absolute', right: 1, width: 8, height: 8, borderRightWidth: 1.5, borderTopWidth: 1.5,
    borderColor: palette.text, transform: [{ rotate: '45deg' }] },
});
