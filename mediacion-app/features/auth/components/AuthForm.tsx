import { StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Input, Logo } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';

export type AuthFormStatus = 'idle' | 'submitting' | 'error';

export type AuthFormProps = {
  title: string;
  description: string;
  email: string;
  password: string;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
  status: AuthFormStatus;
  errorMessage?: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submitLabel: string;
  submittingLabel: string;
  errorTitle: string;
  retryLabel: string;
  footer?: React.ReactNode;
  /** Rendered above the email field. Sign-up uses it for nombre/apellido. */
  extraFields?: React.ReactNode;
  /**
   * Whether `extraFields` are filled in. Defaults to true so sign-in, which has
   * none, is unaffected. Without it the button would enable while a required
   * name was still blank.
   */
  extraFieldsValid?: boolean;
};

export function AuthForm({
  title,
  description,
  email,
  password,
  onChangeEmail,
  onChangePassword,
  onSubmit,
  status,
  errorMessage,
  emailLabel,
  emailPlaceholder,
  passwordLabel,
  passwordPlaceholder,
  submitLabel,
  submittingLabel,
  errorTitle,
  retryLabel,
  footer,
  extraFields,
  extraFieldsValid = true,
}: AuthFormProps) {
  const submitting = status === 'submitting';
  // An empty field is not an error to report — it is simply not submittable yet.
  const canSubmit =
    email.trim().length > 0 && password.length > 0 && extraFieldsValid && !submitting;

  return (
    <View style={styles.container}>
      {/*
        Sign-in and sign-up are the two screens a visitor can reach before the
        app has shown them anything else, so the mark goes here — once, in the
        shared form — rather than being pasted into both routes.

        Decorative on purpose: the heading right below already names the
        screen, and the product name is still undefined anyway (see `Logo`).
      */}
      <View style={styles.brand}>
        <Logo size={56} />
      </View>

      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>

      {extraFields}

      <Input
        label={emailLabel}
        placeholder={emailPlaceholder}
        value={email}
        onChangeText={onChangeEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        editable={!submitting}
      />

      <Input
        label={passwordLabel}
        placeholder={passwordPlaceholder}
        value={password}
        onChangeText={onChangePassword}
        autoCapitalize="none"
        autoComplete="current-password"
        secureTextEntry
        editable={!submitting}
      />

      {status === 'error' ? (
        <ErrorState title={errorTitle} description={errorMessage} retryLabel={retryLabel} onRetry={onSubmit} />
      ) : null}

      <Button variant="primary" fullWidth onPress={onSubmit} disabled={!canSubmit}>
        {submitting ? submittingLabel : submitLabel}
      </Button>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  brand: {
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 22,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    color: semanticColors.text.secondary,
  },
});
