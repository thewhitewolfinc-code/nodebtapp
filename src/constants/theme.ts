import '@/global.css';
import { Platform } from 'react-native';
import { palette } from '@/design/tokens';

export const Colors = {
  light: {
    text: '#12231B', background: '#F6F8F5', backgroundElement: '#FFFFFF', backgroundSelected: '#E6F2E4', textSecondary: '#617065',
    border: '#E0E7DD', controlBorder: '#7E8C79', muted: '#657368', brand: '#0D593F', brandSurface: '#EBF5E8',
    action: palette.action, actionPressed: palette.actionPressed, actionInk: palette.actionText, focus: '#176640',
    success: '#137A3B', successSurface: '#ECF8EF', error: '#A32932', errorSurface: '#FFF0F0',
    warning: '#805600', warningSurface: '#FFF5D8', info: '#175A91', infoSurface: '#EEF6FE',
  },
  dark: {
    text: '#EDF5EE', background: '#0D1712', backgroundElement: '#17251D', backgroundSelected: '#2C432F', textSecondary: '#B0C0B3',
    border: '#314537', controlBorder: '#607765', muted: '#A7BAAC', brand: '#B5E68A', brandSurface: '#233C2A',
    action: '#C2F568', actionPressed: '#ACE34D', actionInk: '#101909', focus: '#C2F568',
    success: '#95D7A8', successSurface: '#203B2B', error: '#FFB6BC', errorSurface: '#43272C',
    warning: '#EDCE85', warningSurface: '#3B3320', info: '#A7CFF0', infoSurface: '#203448',
  },
} as const;
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', serif: 'var(--font-serif)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
});
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 1040;
