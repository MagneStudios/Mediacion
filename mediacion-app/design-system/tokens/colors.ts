/**
 * Mediación color tokens — ported from the Claude Design "Mediación Design
 * System" (tokens/colors.css). Cream canvas, white cards, charcoal ink, and a
 * single reserved sage accent for AI-assisted actions.
 */
export const colors = {
  // Base: brand & ink
  primary: '#324d5a',
  onPrimary: '#ffffff',
  ink: '#111111',
  inkMuted: '#626260',
  inkSubtle: '#7b7b78',
  inkTertiary: '#9c9fa5',
  mediationSage: '#45645e',
  supportBlue: '#324d5a',

  // Base: surfaces
  canvas: '#f5f1ec',
  surface1: '#ffffff',
  surface2: '#ebe7e1',
  inverseCanvas: '#000000',
  inverseSurface1: '#313130',
  inverseInk: '#ffffff',
  inverseInkMuted: '#9c9fa5',

  // Base: lines
  hairline: '#d3cec6',
  hairlineSoft: '#ebe7e1',

  // Base: status (used inside product surfaces only, never as brand backgrounds)
  statusWarning: '#c58a2b',
  statusInfo: '#4f7f93',
  statusSuccess: '#4f7a68',
  semanticError: '#c41c1c',
  semanticSuccess: '#4f7a68',
} as const;

export const semanticColors = {
  text: {
    primary: colors.ink,
    secondary: colors.inkMuted,
    tertiary: colors.inkSubtle,
    quaternary: colors.inkTertiary,
    onPrimary: colors.onPrimary,
    onDark: colors.inverseInk,
    onDarkMuted: colors.inverseInkMuted,
  },
  surface: {
    canvas: colors.canvas,
    card: colors.surface1,
    sunken: colors.surface2,
    inverse: colors.inverseCanvas,
    inverseRaised: colors.inverseSurface1,
  },
  border: {
    default: colors.hairline,
    soft: colors.hairlineSoft,
    strong: colors.ink,
    focus: colors.mediationSage,
  },
  action: {
    primaryBg: colors.ink,
    primaryFg: colors.onPrimary,
    primaryBgPressed: '#000000',
    secondaryBg: colors.surface1,
    secondaryFg: colors.ink,
    secondaryBorder: colors.hairline,
    tertiaryBg: 'transparent',
    tertiaryFg: colors.ink,
    aiBg: colors.mediationSage,
    aiFg: colors.onPrimary,
    aiBgPressed: '#37504b',
    disabledBg: colors.surface2,
    disabledFg: colors.inkTertiary,
  },
  status: {
    successFg: colors.statusSuccess,
    successBg: '#eaf0ec',
    warningFg: colors.statusWarning,
    warningBg: '#f6eddc',
    errorFg: colors.semanticError,
    errorBg: '#f6e4e4',
    infoFg: colors.statusInfo,
    infoBg: '#e6eef1',
    neutralFg: colors.inkMuted,
    neutralBg: colors.surface2,
  },
  ai: {
    accent: colors.mediationSage,
    tint: '#eaf0ee',
  },
} as const;
