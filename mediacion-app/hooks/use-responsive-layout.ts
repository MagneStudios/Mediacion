import { usePathname } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';

import { breakpoints, horizontalPadding } from '../design-system/tokens/layout';
import { getDesktopNavigationSection } from '../utils/get-desktop-navigation-section';

export type ResponsiveLayout = {
  width: number;
  isCompact: boolean;
  isMedium: boolean;
  /** True at `wideMin` (1024) and above — includes `isExtraWide`. */
  isWide: boolean;
  /** True at `extraWideMin` (1440) and above — a finer signal layered on top of `isWide`, never used to add a 3rd grid column. */
  isExtraWide: boolean;
  /** Only true on web, at wide widths, on a route that belongs to the authenticated shell (see getDesktopNavigationSection) — never on native, never on /signed-out. */
  showDesktopSidebar: boolean;
  horizontalPadding: number;
};

/**
 * Single source of truth for responsive layout decisions. Reads only
 * `useWindowDimensions()` (never `window`/`document` directly) and the
 * current route via `usePathname()` — both safe, deterministic-per-render
 * RN/Expo Router APIs. Never derives business/mutation state — only visual
 * chrome (sidebar visibility, content padding/max-width) depends on this.
 *
 * On the static web export, first paint may briefly reflect a fallback
 * width before client hydration reports the real one — this is expected
 * CSR behavior, not an error, and never affects the route tree (the
 * `<Stack>`/`<Tabs>` navigators are structurally identical regardless of
 * width; only `tabBarStyle` and whether `DesktopSidebar` renders change).
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();
  const pathname = usePathname();

  const isCompact = width < breakpoints.mediumMin;
  const isMedium = width >= breakpoints.mediumMin && width < breakpoints.wideMin;
  const isWide = width >= breakpoints.wideMin;
  const isExtraWide = width >= breakpoints.extraWideMin;

  const section = getDesktopNavigationSection(pathname);
  const showDesktopSidebar = Platform.OS === 'web' && isWide && section !== null;

  const padding = isCompact
    ? horizontalPadding.compact
    : isMedium
      ? horizontalPadding.medium
      : isExtraWide
        ? horizontalPadding.extraWide
        : horizontalPadding.wide;

  return { width, isCompact, isMedium, isWide, isExtraWide, showDesktopSidebar, horizontalPadding: padding };
}
