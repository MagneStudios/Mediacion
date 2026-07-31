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

/**
 * Sizes/weights/letterSpacing below are ported verbatim from
 * `DESIGN-mediacion-actualizado.md`'s `typography:` block (aquatic redesign,
 * phase 1 foundations). Two changes from the previous scale: display sizes
 * shrank (72/56/40 → 48/40/34 — this role has zero current usages anywhere
 * in the app, confirmed by grep, so this is a zero-ripple change) and every
 * "weight 600" role (the display roles, headline, cardTitle, button, eyebrow) now maps to
 * `fontFamily.semibold` instead of `.medium` — the doc is explicit that
 * headings/important actions use 600, not 500.
 */
export const typography = {
  displayXl: role(fontFamily.semibold, 48, 1.08, -1.2),
  displayLg: role(fontFamily.semibold, 40, 1.12, -0.8),
  displayMd: role(fontFamily.semibold, 34, 1.16, -0.6),
  headline: role(fontFamily.semibold, 28, 1.22, -0.4),
  cardTitle: role(fontFamily.semibold, 22, 1.28, -0.2),
  subhead: role(fontFamily.regular, 20, 1.45, -0.1),
  bodyLg: role(fontFamily.regular, 18, 1.55, 0),
  body: role(fontFamily.regular, 16, 1.5, 0),
  bodySm: role(fontFamily.regular, 14, 1.5, 0),
  caption: role(fontFamily.regular, 12, 1.4, 0),
  button: role(fontFamily.semibold, 15, 1.2, 0),
  eyebrow: role(fontFamily.semibold, 14, 1.3, 0),
  mono: role(fontFamily.mono, 13, 1.5, 0),
} as const;

export type TypographyRole = keyof typeof typography;
