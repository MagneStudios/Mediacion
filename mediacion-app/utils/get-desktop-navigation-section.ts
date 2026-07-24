export type DesktopNavigationSection = 'cases' | 'signatures' | 'notices' | 'profile';

/**
 * Single, pure route → desktop-sidebar-section classifier — never scattered
 * `pathname.startsWith(...)` checks inside JSX. Returns `null` for any route
 * outside the authenticated shell (currently only `/signed-out`), which
 * doubles as the desktop-sidebar visibility gate in
 * `hooks/use-responsive-layout.ts` — a signed-out/unknown route never shows
 * the sidebar, no separate exclusion list needed.
 *
 * Mapping (verified against Expo Router's resolved pathnames, `(tabs)`
 * being a non-URL route group):
 * - cases:      '/'  and everything under '/case' (creation wizard,
 *               case detail, positions, negotiation, an agreement opened
 *               from a case, mediator — all pushed under /case/[id]/*)
 * - signatures: '/signatures' only (the cross-case Firmas inbox tab)
 * - notices:    '/messages' (the Avisos tab's route file) and '/notices/*'
 * - profile:    '/profile' (tab overview) and every '/profile/*' subroute
 */
export function getDesktopNavigationSection(pathname: string): DesktopNavigationSection | null {
  if (pathname === '/' || pathname === '' || pathname.startsWith('/case')) return 'cases';
  if (pathname === '/signatures') return 'signatures';
  if (pathname === '/messages' || pathname.startsWith('/notices')) return 'notices';
  if (pathname.startsWith('/profile')) return 'profile';
  return null;
}
