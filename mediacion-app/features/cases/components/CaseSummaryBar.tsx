import { StyleSheet, View } from 'react-native';

import { Text } from '../../../design-system/components/Text';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';

export type CaseSummaryBarProps = {
  total: number;
  totalLabel: string;
  pendingResponse: number;
  pendingResponseLabel: string;
};

export function CaseSummaryBar({ total, totalLabel, pendingResponse, pendingResponseLabel }: CaseSummaryBarProps) {
  // The one number on this bar that means "act now" — same warning tone +
  // left-accent grammar CaseCard already uses for its own urgent contextual
  // block, so it reads as a flag rather than another neutral stat.
  const hasPending = pendingResponse > 0;

  return (
    <View style={styles.row} accessibilityRole="summary">
      <View style={styles.card}>
        <Text variant="headline" color="primary" style={styles.number}>
          {total}
        </Text>
        <Text variant="caption" color="tertiary">
          {totalLabel}
        </Text>
      </View>
      <View style={[styles.card, hasPending && styles.cardPending]}>
        <Text variant="headline" color="primary" style={[styles.number, hasPending && styles.textPending]}>
          {pendingResponse}
        </Text>
        <Text variant="caption" color="tertiary" style={hasPending && styles.textPending}>
          {pendingResponseLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.sm,
  },
  card: {
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 112,
    alignItems: 'flex-start',
  },
  cardPending: {
    backgroundColor: semanticColors.status.warningBg,
    borderLeftWidth: 4,
    borderLeftColor: semanticColors.status.warningFg,
  },
  number: {
    lineHeight: 30,
  },
  textPending: {
    color: semanticColors.status.warningFg,
  },
});
