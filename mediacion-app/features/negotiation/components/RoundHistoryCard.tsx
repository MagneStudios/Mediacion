import { StyleSheet, Text, View } from 'react-native';

import { Card, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';

export type RoundHistoryCardProps = {
  roundLabel: string;
  proposalTitle: string;
  proposalSummary: string;
  statusLabel: string;
  statusVisual: StatusPillStatus;
  dateLabel?: string;
};

/** One completed round — immutable history, display only. */
export function RoundHistoryCard({
  roundLabel,
  proposalTitle,
  proposalSummary,
  statusLabel,
  statusVisual,
  dateLabel,
}: RoundHistoryCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.roundLabel}>{roundLabel}</Text>
        <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {proposalTitle}
      </Text>
      <Text style={styles.summary}>{proposalSummary}</Text>
      {dateLabel ? (
        <Text style={styles.date} accessibilityLabel={dateLabel}>
          {dateLabel}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  roundLabel: {
    ...typography.eyebrow,
    color: semanticColors.text.quaternary,
  },
  title: {
    ...typography.bodyLg,
    color: semanticColors.text.primary,
  },
  summary: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  date: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
});
