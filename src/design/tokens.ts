/** NoDebt's approved light visual system. Auth keeps this treatment in either OS theme. */
export const palette = {
  brand: { 50: '#F2FBF0', 100: '#E4F6DC', 300: '#9CE574', 500: '#24C94B', 700: '#13852C', 900: '#003C2E' },
  canvas: '#FAFCF8', wordmark: '#002D24', privacySurface: '#EAF6D9', surface: '#FFFFFF', surfaceSubtle: '#F0F4EF',
  border: '#E2E7E1', text: '#101820', textSecondary: '#58616C', textMuted: '#6B746F',
  action: '#C2F568', actionPressed: '#ACE34D', actionText: '#101909',
  focus: '#176640', disabled: '#E9EDE7', disabledText: '#697166',
  success: '#137A3B', successSurface: '#ECF8EF', warning: '#805600', warningSurface: '#FFF5D8',
  error: '#A32932', errorSurface: '#FFF0F0', info: '#175A91', infoSurface: '#EEF6FE',
} as const;

export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40, xxxl: 48, huge: 64 } as const;
export const radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const stroke = { hairline: 1, strong: 2 } as const;
export const elevation = { none: 0, subtle: 1, raised: 3 } as const;
export const font = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' } as const;
export const type = {
  display: { fontFamily: font.bold, fontSize: 48, lineHeight: 58, letterSpacing: -2 },
  title: { fontFamily: font.bold, fontSize: 32, lineHeight: 40, letterSpacing: -0.8 },
  heading: { fontFamily: font.semibold, fontSize: 24, lineHeight: 32 },
  bodyLarge: { fontFamily: font.medium, fontSize: 15, lineHeight: 19 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: font.semibold, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
} as const;
export const layout = { minTouchTarget: 48, buttonHeight: 54, authMaxWidth: 480, pageGutter: 30 } as const;
