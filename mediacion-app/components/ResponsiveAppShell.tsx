import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { semanticColors } from '../design-system/tokens/colors';
import { LegalFooter } from '../features/legal/components/LegalFooter';
import { useResponsiveLayout } from '../hooks/use-responsive-layout';
import { DesktopSidebar } from './DesktopSidebar';
import { DesktopTopbar } from './DesktopTopbar';

export type ResponsiveAppShellProps = {
  children: ReactNode;
};

/**
 * Wraps the app's root `<Stack>` (mounted once in `app/_layout.tsx`, above
 * both the `(tabs)` navigator and every pushed route) so the desktop
 * sidebar stays visible across nested authenticated routes like
 * `/case/[id]/negotiation` or `/profile/edit`, not just the four tab
 * screens. `showDesktopSidebar` is web-only and already excludes
 * `/signed-out` (see getDesktopNavigationSection) — that route renders
 * `children` unwrapped, exactly like every non-web/non-wide case.
 *
 * A plain, non-scrolling flex row — each screen underneath keeps full
 * ownership of its own ScrollView/FlatList; this component never scrolls
 * and never wraps one.
 */
export function ResponsiveAppShell({ children }: ResponsiveAppShellProps) {
  const { showDesktopSidebar } = useResponsiveLayout();

  if (!showDesktopSidebar) {
    return <>{children}</>;
  }

  return (
    <View style={styles.row}>
      <DesktopSidebar />
      <View style={styles.main}>
        <DesktopTopbar />
        <View style={styles.content}>{children}</View>
        {/* Instructivo TyC §1.2: legal links in the footer of every page.
            This covers the whole desktop shell; the narrow/native layout
            carries LegalFooter on its auth screens instead. */}
        <LegalFooter />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: semanticColors.surface.canvas,
  },
  main: {
    flex: 1,
    minWidth: 0,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
});
