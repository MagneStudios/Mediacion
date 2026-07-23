/**
 * Mediación spacing tokens — ported from tokens/spacing.css (8px base grid).
 * Web-only sizing (container-max, sidebar-width for the studio panel) is
 * intentionally omitted; layout tokens here are the ones the source itself
 * carries over into mobile chrome (top bar / bottom tab bar heights).
 */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 96,
} as const;

export const layout = {
  navHeight: 56,
  touchTarget: 44,
} as const;
