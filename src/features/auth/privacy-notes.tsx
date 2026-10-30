import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { palette, radius, space, stroke, type } from '@/design/tokens';

const items: { icon: ImageSourcePropType; label: string }[] = [
  { icon: require('../../../assets/auth/privacy.png'), label: 'Your data\nstays private' },
  { icon: require('../../../assets/auth/lock.png'), label: 'Encrypted\non your device' },
  { icon: require('../../../assets/auth/cloud.png'), label: 'No automatic\ncloud upload' },
];
export function PrivacyNotes() {
  return <View style={styles.row}>{items.map((item, index) => <View key={item.label} style={[styles.item, index > 0 && styles.divider]}>
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.badge}><Image source={item.icon} style={styles.icon} resizeMode="contain" /></View>
    <Text style={styles.label}>{item.label}</Text>
  </View>)}</View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginHorizontal: space.lg, alignItems: 'stretch' },
  item: { flex: 1, alignItems: 'center', gap: space.xxs, paddingHorizontal: space.xxs },
  divider: { borderLeftWidth: stroke.hairline, borderColor: palette.border },
  badge: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: palette.privacySurface, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 20, height: 22 },
  label: { ...type.caption, lineHeight: 15, includeFontPadding: false, color: palette.textSecondary, textAlign: 'center' },
});
