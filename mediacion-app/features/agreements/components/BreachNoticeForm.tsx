import { StyleSheet, Text, View } from 'react-native';

import { Button, Input } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type BreachNoticeFormStatus = 'idle' | 'submitting';

export type BreachNoticeFormProps = {
  description: string;
  onChangeDescription: (value: string) => void;
  /** Caller-computed validation text (e.g. after a submit attempt on a blank field) — this component never tracks its own "touched" state. */
  descriptionError?: string;
  status: BreachNoticeFormStatus;
  onSubmit: () => void;
  title: string;
  descriptionLabel: string;
  descriptionHint?: string;
  descriptionPlaceholder?: string;
  submitLabel: string;
  submittingLabel: string;
};

/**
 * Presentational-only breach-notice report form. Records a neutral,
 * free-text description only — no fault, severity, or evidence field
 * exists here or on the backend (`incumplimientos` has no such column).
 * Submitting only opens the confirming dialog (see `BreachNoticeDialog`)
 * — this component never calls a service itself.
 */
export function BreachNoticeForm({
  description,
  onChangeDescription,
  descriptionError,
  status,
  onSubmit,
  title,
  descriptionLabel,
  descriptionHint,
  descriptionPlaceholder,
  submitLabel,
  submittingLabel,
}: BreachNoticeFormProps) {
  const isSubmitting = status === 'submitting';
  const canSubmit = description.trim().length > 0 && !isSubmitting;

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>

      <Input
        label={descriptionLabel}
        hint={descriptionError ? undefined : descriptionHint}
        placeholder={descriptionPlaceholder}
        value={description}
        onChangeText={onChangeDescription}
        error={descriptionError}
        editable={!isSubmitting}
        multiline
        numberOfLines={4}
      />

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canSubmit}
        loading={isSubmitting}
        loadingLabel={isSubmitting ? submittingLabel : undefined}
        onPress={onSubmit}
      >
        {submitLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
});
