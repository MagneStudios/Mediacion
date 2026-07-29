import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { TaskStatusBadge, type TaskStatus } from './TaskStatusBadge';

export type TaskCardProps = {
  description: string;
  /** Already-formatted, locale-aware string — never a raw ISO date. */
  eventDateLabel?: string;
  status: TaskStatus;
  statusLabel: string;
  /** Presence of both `actionLabel` and `onAction` renders the optional primary action; either alone renders none. */
  actionLabel?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  actionLoadingLabel?: string;
  actionDisabled?: boolean;
  /** Distinguishes this row's action from identical labels on sibling cards in a list — e.g. "Mark complete: Deliver documents". */
  actionAccessibilityLabel?: string;
};

/**
 * One post-agreement task row. Presentational only — no fetch, no
 * mutation; the action (e.g. mark complete) is entirely the caller's
 * responsibility. Mirrors NoticeCard's non-interactive-Card +
 * sibling-Button convention: the Card itself is never a Pressable here.
 */
export function TaskCard({
  description,
  eventDateLabel,
  status,
  statusLabel,
  actionLabel,
  onAction,
  actionLoading = false,
  actionLoadingLabel,
  actionDisabled = false,
  actionAccessibilityLabel,
}: TaskCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.description} accessibilityRole="header">
          {description}
        </Text>
        <TaskStatusBadge status={status} label={statusLabel} />
      </View>

      {eventDateLabel ? (
        <Text style={styles.dateLabel} accessibilityLabel={eventDateLabel}>
          {eventDateLabel}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          variant="secondary"
          size="sm"
          onPress={onAction}
          loading={actionLoading}
          loadingLabel={actionLoading ? actionLoadingLabel : undefined}
          disabled={actionDisabled}
          accessibilityLabel={actionAccessibilityLabel}
          style={styles.actionButton}
        >
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  description: {
    flex: 1,
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 16,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  dateLabel: {
    fontFamily: typography.mono.fontFamily,
    fontSize: 11,
    color: semanticColors.text.tertiary,
  },
  actionButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    marginTop: spacing.xxs,
  },
});
