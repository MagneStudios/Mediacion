import { StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { TaskCard } from './TaskCard';
import type { TaskStatus } from './TaskStatusBadge';

export type TaskListSectionStatus = 'loading' | 'error' | 'success';

/** Already-presentational task row data — no raw dates, no persisted-shape fields beyond what TaskCard needs. */
export type TaskListItem = {
  id: string;
  description: string;
  status: TaskStatus;
  statusLabel: string;
  eventDateLabel?: string;
  actionLabel?: string;
  actionLoading?: boolean;
  /** Shown in place of `actionLabel` while `actionLoading` — `TaskCard` has always taken one; this list simply never forwarded it. */
  actionLoadingLabel?: string;
  actionDisabled?: boolean;
  actionAccessibilityLabel?: string;
};

export type TaskListSectionProps = {
  status: TaskListSectionStatus;
  /** Ignored unless `status === 'success'`. An empty array in success renders the empty state. */
  tasks: TaskListItem[];
  title: string;
  loadingLabel: string;
  errorTitle: string;
  errorDescription?: string;
  retryLabel?: string;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription?: string;
  /** Fired with the task's `id` when its action is pressed — never a bulk/global action. */
  onTaskAction: (taskId: string) => void;
};

/**
 * Post-agreement tasks section. Presentational only — no fetch, no
 * sorting/filtering, no date parsing, no status mutation, no calendar
 * behavior. `status` gates loading/error/success as three mutually
 * exclusive branches (mirroring the agreement/mediator dashboards' own
 * fetch-status convention) so no two of loading/error/empty/success can
 * ever render together; "empty" is simply success with zero tasks.
 */
export function TaskListSection({
  status,
  tasks,
  title,
  loadingLabel,
  errorTitle,
  errorDescription,
  retryLabel,
  onRetry,
  emptyTitle,
  emptyDescription,
  onTaskAction,
}: TaskListSectionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>

      {status === 'loading' ? (
        <LoadingState label={loadingLabel} />
      ) : status === 'error' ? (
        <ErrorState title={errorTitle} description={errorDescription} retryLabel={retryLabel} onRetry={onRetry} />
      ) : tasks.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <View style={styles.list} accessibilityRole="list">
          {tasks.map((task) => (
            <View key={task.id}>
              <TaskCard
                description={task.description}
                status={task.status}
                statusLabel={task.statusLabel}
                eventDateLabel={task.eventDateLabel}
                actionLabel={task.actionLabel}
                onAction={task.actionLabel ? () => onTaskAction(task.id) : undefined}
                actionLoading={task.actionLoading}
                actionLoadingLabel={task.actionLoadingLabel}
                actionDisabled={task.actionDisabled}
                actionAccessibilityLabel={task.actionAccessibilityLabel}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 18,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  list: {
    gap: spacing.sm,
  },
});
