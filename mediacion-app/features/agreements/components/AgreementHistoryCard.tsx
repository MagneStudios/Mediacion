import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type AgreementHistoryCardProps = {
  eventLabel: string;
  dateLabel: string;
};

/** One immutable history event — display only. */
export function AgreementHistoryCard({ eventLabel, dateLabel }: AgreementHistoryCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label} accessibilityRole="header">
          {eventLabel}
        </Text>
        <Text style={styles.date} accessibilityLabel={dateLabel}>
          {dateLabel}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  label: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: semanticColors.text.primary,
  },
  date: {
    fontFamily: typography.mono.fontFamily,
    fontSize: 11,
    color: semanticColors.text.tertiary,
  },
});
