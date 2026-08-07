import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type PositionReviewRow = {
  label: string;
  value: string;
};

export type PositionReviewCardProps = {
  rows: PositionReviewRow[];
};

/** Neutral review of the current party's own private item — this card is explicitly a private screen (see review.tsx's privacy marker). */
export function PositionReviewCard({ rows }: PositionReviewCardProps) {
  return (
    <Card style={styles.card}>
      {rows.map((row, index) => (
        <View key={row.label} style={[styles.row, index > 0 ? styles.rowBorder : null]}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  row: {
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: semanticColors.border.soft,
  },
  label: {
    ...typography.eyebrow,
    color: semanticColors.text.tertiary,
  },
  value: {
    ...typography.body,
    color: semanticColors.text.primary,
  },
});
