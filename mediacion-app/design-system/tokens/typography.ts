/**
 * Mediación typography tokens — ported from tokens/typography.css. React
 * Native has no font-weight synthesis for custom fonts, so each role maps
 * directly to the loaded static font file (weight baked into the name) via
 * @expo-google-fonts/inter and @expo-google-fonts/jetbrains-mono. Line height
 * is expressed in absolute points (fontSize * the source's line-height
 * multiplier), matching how RN expects `lineHeight`.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

type TypeRole = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

function role(fontFamily: string, fontSize: number, lineHeightMultiplier: number, letterSpacing: number): TypeRole {
  return {
    fontFamily,
    fontSize,
    lineHeight: Math.round(fontSize * lineHeightMultiplier),
    letterSpacing,
  };
}

export const typography = {
  displayXl: role(fontFamily.medium, 72, 1.05, -2),
  displayLg: role(fontFamily.medium, 56, 1.1, -1.4),
  displayMd: role(fontFamily.medium, 40, 1.15, -0.8),
  headline: role(fontFamily.medium, 28, 1.2, -0.5),
  cardTitle: role(fontFamily.medium, 22, 1.25, -0.3),
  subhead: role(fontFamily.regular, 20, 1.4, -0.2),
  bodyLg: role(fontFamily.regular, 18, 1.5, -0.1),
  body: role(fontFamily.regular, 16, 1.5, 0),
  bodySm: role(fontFamily.regular, 14, 1.5, 0),
  caption: role(fontFamily.regular, 12, 1.4, 0),
  button: role(fontFamily.medium, 15, 1.2, 0),
  eyebrow: role(fontFamily.medium, 14, 1.3, 0),
  mono: role(fontFamily.mono, 13, 1.5, 0),
} as const;

export type TypographyRole = keyof typeof typography;
