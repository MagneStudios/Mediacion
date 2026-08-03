/**
 * Mediación radius tokens — aquatic redesign scale, ported verbatim from
 * `DESIGN-mediacion-actualizado.md`'s `rounded:` block. Slightly softer than
 * the previous cream-and-sage scale (xs/sm/md/lg/xl each +2px). Modest
 * corners everywhere; pill radius is reserved for tab toggles / avatars /
 * status chips, never CTAs.
 */
export const radii = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  pill: 9999,
  full: 9999,
} as const;
