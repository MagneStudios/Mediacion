import { StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { DocumentPreparationState } from '../../agreements/components/DocumentPreparationState';

export type TaskCalendarActionStatus = 'idle' | 'pending' | 'success' | 'error';

export type TaskCalendarActionProps = {
  status: TaskCalendarActionStatus;
  onGenerate: () => void;
  onRetry?: () => void;
  /** When set, the action renders disabled with this reason instead of `status`. */
  disabled?: boolean;
  disabledReason?: string;
  actionLabel: string;
  preparingTitle: string;
  preparingBody: string;
  successTitle: string;
  successBody: string;
  errorTitle: string;
  retryLabel: string;
};

/**
 * Presentational-only calendar action for a post-agreement task. Owns
 * idle/pending/success/error/disabled rendering — never calls a service,
 * never generates/saves/downloads/opens an `.ics` file, never touches a
 * real calendar (Google/Apple/device). "Success" only confirms the event
 * data is ready in this demonstration — callers must not pass copy
 * implying the event was actually added anywhere.
 */
export function TaskCalendarAction({
  status,
  onGenerate,
  onRetry,
  disabled = false,
  disabledReason,
  actionLabel,
  preparingTitle,
  preparingBody,
  successTitle,
  successBody,
  errorTitle,
  retryLabel,
}: TaskCalendarActionProps) {
  if (disabled) {
    return (
      <View style={styles.container}>
        <Button variant="secondary" size="sm" disabled style={styles.taskButton}>
          {actionLabel}
        </Button>
        {disabledReason ? <Text style={styles.disabledReason}>{disabledReason}</Text> : null}
      </View>
    );
  }

  if (status === 'pending') {
    return <DocumentPreparationState title={preparingTitle} description={preparingBody} />;
  }

  if (status === 'error') {
    return <ErrorState title={errorTitle} retryLabel={retryLabel} onRetry={onRetry ?? onGenerate} />;
  }

  if (status === 'success') {
    return (
      <View style={styles.container} accessibilityLiveRegion="polite">
        <Text style={styles.successTitle}>{successTitle}</Text>
        <Text style={styles.successBody}>{successBody}</Text>
      </View>
    );
  }

  return (
    <Button variant="secondary" size="sm" onPress={onGenerate} style={styles.taskButton}>
      {actionLabel}
    </Button>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
  },
  taskButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  disabledReason: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
  successTitle: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 16,
    color: semanticColors.text.primary,
  },
  successBody: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
});
