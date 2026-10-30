import { Text } from 'react-native';
import glyphs from '../../../assets/icons/feather.json';
export type IconName = keyof typeof glyphs;
/** Bundled, MIT-licensed outline glyphs loaded by the existing Expo Font module. */
export function Icon({ name, size = 20, color = '#12231B' }: { name: IconName; size?: number; color?: string }) {
  return <Text accessible={false} importantForAccessibility="no-hide-descendants" allowFontScaling={false}
    style={{ fontFamily: 'NoDebtIcons', fontSize: size, lineHeight: size + 3, width: size + 3, textAlign: 'center', color, includeFontPadding: false }}>
    {String.fromCodePoint(glyphs[name])}
  </Text>;
}
