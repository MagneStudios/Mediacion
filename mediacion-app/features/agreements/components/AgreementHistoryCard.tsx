import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
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
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  label: {
    flex: 1,
    minWidth: 180,
    ...typography.body,
    color: semanticColors.text.primary,
  },
  date: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
});
