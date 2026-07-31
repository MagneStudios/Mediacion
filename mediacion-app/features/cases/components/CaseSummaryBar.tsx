import { StyleSheet, View } from 'react-native';

import { Text } from '../../../design-system/components/Text';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';

export type CaseSummaryBarProps = {
  /** Total number of cases in the (unfiltered) list — already fetched, never a separate metrics call. */
  total: number;
  totalLabel: string;
  /** Count of cases whose statusLabelKey is 'proposalReady' — a real, already-existing presentation bucket, not a derived/invented metric. */
  pendingResponse: number;
  pendingResponseLabel: string;
};

/**
 * Purely presentational — every number it renders is a prop computed by the
 * screen from the array `useCases()` already returned. No fetch, no
 * business logic, no metric that doesn't already exist in the list.
 */
export function CaseSummaryBar({ total, totalLabel, pendingResponse, pendingResponseLabel }: CaseSummaryBarProps) {
  return (
    <View style={styles.row} accessibilityRole="summary">
      <View style={styles.item}>
        <Text variant="cardTitle" color="primary">
          {total}
        </Text>
        <Text variant="caption" color="tertiary">
          {totalLabel}
        </Text>
      </View>
      <View style={[styles.item, styles.itemBordered]}>
        <Text variant="cardTitle" color="primary">
          {pendingResponse}
        </Text>
        <Text variant="caption" color="tertiary">
          {pendingResponseLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  item: {
    gap: 2,
  },
  itemBordered: {
    paddingLeft: spacing.lg,
    borderLeftWidth: 1,
    borderLeftColor: semanticColors.border.default,
  },
});
