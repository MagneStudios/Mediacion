import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../design-system/components/Card';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type ActivityTimelineItemProps = {
  eventLabel: string;
  dateLabel: string;
  caseLine?: string;
  actionable?: boolean;
  onPress?: () => void;
};

/** One immutable, read-only activity entry — display only, mirroring AgreementHistoryCard's convention. Optionally navigable, never mutable. */
export function ActivityTimelineItem({ eventLabel, dateLabel, caseLine, actionable, onPress }: ActivityTimelineItemProps) {
  return (
    <Card interactive={Boolean(actionable)} onPress={actionable ? onPress : undefined} accessibilityLabel={actionable ? eventLabel : undefined} style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label} accessibilityRole="header">
          {eventLabel}
        </Text>
        <Text style={styles.date} accessibilityLabel={dateLabel}>
          {dateLabel}
        </Text>
      </View>
      {caseLine ? <Text style={styles.caseLine}>{caseLine}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  label: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: semanticColors.text.primary,
  },
  date: {
    flexShrink: 0,
    fontFamily: typography.mono.fontFamily,
    fontSize: 11,
    color: semanticColors.text.tertiary,
  },
  caseLine: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.tertiary,
  },
});
