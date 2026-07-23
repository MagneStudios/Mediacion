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
};

/**
 * Stacks `primary` then `secondary` (unchanged source order) below `wide`;
 * becomes a 2:1 side-by-side row at `wide` (1024px) and above. Never
 * reorders its children — DOM order is identical to visual order at every
 * breakpoint, so screen-reader/keyboard tab order never becomes confusing
 * and no action ever "disappears" at a breakpoint, only relocates spatially.
 */
export function ResponsiveColumns({ primary, secondary }: ResponsiveColumnsProps) {
  const { isWide } = useResponsiveLayout();

  if (!isWide) {
    return (
      <View style={styles.stacked}>
        {primary}
        {secondary}
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
});
