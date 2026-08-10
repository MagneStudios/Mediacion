import { StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Input } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type JoinCaseFormStatus = 'idle' | 'submitting' | 'error' | 'expired';

export type JoinCaseFormProps = {
  value: string;
  onChangeText: (value: string) => void;
  status: JoinCaseFormStatus;
  onSubmit: () => void;
  title: string;
  description?: string;
  inputLabel: string;
  inputPlaceholder: string;
  submitLabel: string;
  submittingLabel: string;
  errorTitle: string;
  errorDescription?: string;
  retryLabel: string;
  /**
   * R-04: shown instead of `errorTitle`/`errorDescription` when the
   * invitation is known but past its 72 h TTL. No retry action is offered —
   * unlike a generic failure, resubmitting the same expired token can never
   * succeed.
   */
  expiredTitle: string;
  expiredDescription?: string;
};

/**
 * Presentational-only shell for entering an invitation link/code to join a
 * case. Owns idle/submitting/error/disabled rendering only — never calls
 * `POST /casos/unirse`, never fabricates a success result, never navigates.
 * The submit callback is entirely the caller's responsibility.
 */
export function JoinCaseForm({
  value,
  onChangeText,
  status,
  onSubmit,
  title,
  description,
  inputLabel,
  inputPlaceholder,
  submitLabel,
  submittingLabel,
  errorTitle,
  errorDescription,
  retryLabel,
  expiredTitle,
  expiredDescription,
}: JoinCaseFormProps) {
  const isSubmitting = status === 'submitting';
  const canSubmit = value.trim().length > 0 && !isSubmitting;

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}

      <Input
        label={inputLabel}
        placeholder={inputPlaceholder}
        value={value}
        onChangeText={onChangeText}
        editable={!isSubmitting}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {status === 'expired' ? (
        // No onRetry/retryLabel on purpose — an expired token cannot become
        // valid by resubmitting it.
        <ErrorState title={expiredTitle} description={expiredDescription} />
      ) : status === 'error' ? (
        <ErrorState title={errorTitle} description={errorDescription} retryLabel={retryLabel} onRetry={onSubmit} />
      ) : (
        <Button
          variant="primary"
          fullWidth
          disabled={!canSubmit}
          loading={isSubmitting}
          loadingLabel={isSubmitting ? submittingLabel : undefined}
          onPress={onSubmit}
        >
          {submitLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 24,
    letterSpacing: -0.4,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    lineHeight: 22,
    color: semanticColors.text.secondary,
    marginTop: -spacing.sm,
  },
});
