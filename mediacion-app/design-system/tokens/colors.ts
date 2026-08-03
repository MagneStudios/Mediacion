/**
 * Mediación color tokens — aquatic palette (redesign phase 1, "foundations"),
 * ported from the approved `DESIGN-mediacion-actualizado.md` design-system
 * doc exported from Stitch (docs/frontend-redesign/stitch-export/). Hielo
 * canvas, white cards, deep-blue ink, Aero-derived primary, Cerúleo-derived
 * accent (focus/info), and a Turquesa accent reserved exclusively for
 * AI/mediation actions — replaces the previous cream-and-sage identity.
 *
 * `statusSuccess`/`semanticSuccess` deliberately do NOT reuse `mediationAqua`
 * even though the source doc's `status-success` token does (both `#2F858B`
 * there) — this codebase has an established, tested rule that the AI/
 * mediation accent is reserved exclusively for AI-assisted actions and must
 * never appear for any other purpose (see agents/front/AGENTS.md). Reusing
 * it for "success" would make an accepted proposal/signed agreement visually
 * indistinguishable from "AI-assisted", so success gets its own distinct
 * green instead, kept in the same muted/cool family as the rest of the
 * palette. Everything else below is taken verbatim from the source doc.
 */
export const colors = {
  // Base: brand & ink
  primary: '#3F6F9E',
  primaryHover: '#345F89',
  primaryPressed: '#294E72',
  onPrimary: '#FFFFFF',

  accent: '#2F83C5',
  accentSoft: '#DCEFFC',
  onAccent: '#FFFFFF',

  mediationAqua: '#2F858B',
  mediationAquaSoft: '#D8F2F2',
  onMediationAqua: '#FFFFFF',

  ink: '#17324A',
  inkMuted: '#526B7B',
  inkSubtle: '#718795',
  inkTertiary: '#93A6B1',

  // Base: surfaces
  canvas: '#F4FAFD',
  surface1: '#FFFFFF',
  surface2: '#EAF6FD',
  surface3: '#DCEFFC',
  surfaceAqua: '#E2F6F6',
  inverseCanvas: '#17324A',
  inverseSurface1: '#24445F',
  inverseInk: '#FFFFFF',
  inverseInkMuted: '#D7E5ED',

  // Base: lines
  hairline: '#C9DCE7',
  hairlineSoft: '#E1EDF3',
  focusRing: '#2F83C5',

  // Base: status (used inside product surfaces only, never as brand backgrounds)
  statusWarning: '#B7791F',
  statusInfo: '#2F83C5',
  statusSuccess: '#2F8F6B',
  semanticError: '#B93845',
  semanticSuccess: '#2F8F6B',
} as const;

/**
 * Migration reference only — never imported by app code. Documents the old
 * cream-and-sage hex values this redesign replaces, per the source doc's own
 * "Migration mapping" table, so a reviewer can trace what changed and why.
 */
export const legacyColorMigrationMap = {
  '#324d5a': { was: 'primary/support blue', now: 'colors.primary (Aero-derived)' },
  '#45645e': { was: 'mediation sage (AI accent)', now: 'colors.mediationAqua (Turquesa)' },
  '#f5f1ec': { was: 'cream canvas', now: 'colors.canvas (Hielo)' },
  '#ebe7e1': { was: 'cream surface', now: 'colors.surface2' },
  '#111111': { was: 'charcoal ink', now: 'colors.ink (deep blue)' },
  '#d3cec6': { was: 'warm gray hairline', now: 'colors.hairline (cool blue-gray)' },
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
    /** Soft aquatic tint reserved for AI-proposal / guided-resolution content (source doc's "proposal surface"). */
    supportAqua: colors.surfaceAqua,
    inverse: colors.inverseCanvas,
    inverseRaised: colors.inverseSurface1,
  },
  border: {
    default: colors.hairline,
    soft: colors.hairlineSoft,
    strong: colors.ink,
    // Cerúleo accent, not the AI/mediation accent — focus is a distinct
    // concern from "this action is AI-assisted" and must never share a color.
    focus: colors.accent,
  },
  action: {
    primaryBg: colors.primary,
    primaryFg: colors.onPrimary,
    primaryBgHover: colors.primaryHover,
    primaryBgPressed: colors.primaryPressed,
    secondaryBg: colors.surface1,
    // `canvas` sits a shade below white surface1 and above the `sunken`
    // pressed tone — the ramp already exists in the palette, just unused
    // as a button state until now.
    secondaryBgHover: colors.canvas,
    secondaryFg: colors.primary,
    secondaryBorder: colors.hairline,
    tertiaryBg: 'transparent',
    tertiaryFg: colors.primary,
    aiBg: colors.mediationAqua,
    aiFg: colors.onMediationAqua,
    // Midpoint between aiBg and aiBgPressed — no existing swatch sits between them.
    aiBgHover: '#2A7A80',
    aiBgPressed: '#256F74',
    disabledBg: colors.surface2,
    disabledFg: colors.inkTertiary,
  },
  status: {
    // The *Fg values below are deliberately darker than the base
    // colors.statusWarning/semanticError/statusSuccess tokens — verified
    // against their paired *Bg tint at ≥4.5:1 (WCAG AA for normal-size
    // text; the base tokens alone land at 3.3–4.0:1 against these light
    // backgrounds, which only clears the 3:1 non-text/large-text bar). The
    // warning/error pair reuses the source doc's own status-chip-warning/
    // status-chip-danger text values, chosen there for exactly this reason;
    // success has no doc-provided chip pairing (see the colors.ts top
    // comment on why it isn't sharing mediationAqua), so its darker text
    // shade is derived here the same way.
    successFg: '#1F6E4F',
    successBg: '#E1F3EA',
    warningFg: '#7A4B0B',
    warningBg: '#FFF2D8',
    errorFg: '#8E2632',
    errorBg: '#FCE5E8',
    // Midpoint between errorBg and errorBgPressed — no existing swatch sits between them.
    errorBgHover: '#F9D9DE',
    errorBgPressed: '#F5CDD3',
    infoFg: colors.primaryPressed,
    infoBg: colors.accentSoft,
    neutralFg: colors.inkMuted,
    neutralBg: colors.surface2,
  },
  ai: {
    accent: colors.mediationAqua,
    tint: colors.mediationAquaSoft,
    border: '#BFE3E1',
  },
} as const;
