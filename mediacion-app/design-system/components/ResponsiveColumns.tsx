import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useResponsiveLayout } from '../../hooks/use-responsive-layout';
import { secondaryColumnMaxWidth } from '../tokens/layout';
import { spacing } from '../tokens/spacing';

export type ResponsiveColumnsProps = {
  /** Primary task content — status, main form/content, key actions. */
  primary: ReactNode;
  /** Contextual/supporting content — status summaries, related actions, notices. */
  secondary: ReactNode;
  /**
   * Opt-in (default false): size the secondary column to its real content
   * width (up to `secondaryColumnMaxWidth`) and let the primary column grow
   * to fill the rest. When `secondary` renders nothing, the rail collapses
   * to zero instead of leaving a fixed empty slot. Consumers whose
   * secondary always has content keep the default fixed 2:1 split.
   */
  collapseEmptySecondary?: boolean;
};

/**
 * Stacks `primary` then `secondary` (unchanged source order) below `wide`;
 * becomes a side-by-side row at `wide` (1024px) and above. Never reorders
 * its children — DOM order is identical to visual order at every breakpoint,
 * so screen-reader/keyboard tab order never becomes confusing and no action
 * ever "disappears" at a breakpoint, only relocates spatially.
 *
 * With `collapseEmptySecondary` the split is content-driven rather than a
 * fixed 2:1 ratio: the primary column grows to fill all available space,
 * while the secondary column takes only its own content width (up to
 * `secondaryColumnMaxWidth`) and collapses to zero when its children render
 * nothing — so an empty rail never leaves a gap beside the primary column.
 */
export function ResponsiveColumns({ primary, secondary, collapseEmptySecondary = false }: ResponsiveColumnsProps) {
  const { isWide } = useResponsiveLayout();

  if (!isWide) {
    return (
      <View style={styles.stacked}>
        {primary}
        {secondary}
      </View>
    );
  }

  if (collapseEmptySecondary) {
    return (
      <View style={styles.row}>
        <View style={styles.primaryColumnFluid}>{primary}</View>
        <View style={styles.secondaryColumnAuto}>{secondary}</View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.primaryColumn}>{primary}</View>
      <View style={styles.secondaryColumn}>{secondary}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  stacked: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  primaryColumn: {
    flex: 2,
    minWidth: 0,
    gap: spacing.md,
  },
  secondaryColumn: {
    flex: 1,
    minWidth: 0,
    maxWidth: secondaryColumnMaxWidth,
    gap: spacing.md,
  },
  primaryColumnFluid: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: spacing.md,
  },
  secondaryColumnAuto: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
    maxWidth: secondaryColumnMaxWidth,
    gap: spacing.md,
  },
});
