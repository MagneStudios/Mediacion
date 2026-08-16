import { Link, Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { Card, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { useAuthSession } from '@/features/auth/auth-session';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { useAuthForm } from '@/features/auth/useAuthForm';
import { AcceptanceCheckboxes } from '@/features/legal/components/AcceptanceCheckboxes';
import { LegalFooter } from '@/features/legal/components/LegalFooter';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { legalService } from '@/services/legal.service';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  const { signUp, status } = useAuthSession();

  const [submitted, setSubmitted] = useState(false);
  // nombre/apellido are not decoration: signUp puts them in the user metadata
  // and the on_auth_user_created trigger reads raw_user_meta_data to populate
  // public.usuarios. Skipping them creates a real user with an empty name.
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  // R-05: optional, unlike nombre/apellido — never gates form submission.
  const [numeroMatricula, setNumeroMatricula] = useState('');
  // Instructivo TyC §2: both start unchecked, never pre-ticked. Only the
  // TyC+Privacidad one gates the submit; marketing is optional and its
  // "no" is also a recorded answer.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);

  const onSuccess = useCallback(() => {
    setSubmitted(true);
    // A signup that produced a session can go straight in. One that did not is
    // waiting on email confirmation, and the notice below says so rather than
    // dropping the user on a login screen with no explanation.
    if (status === 'signedIn') {
      router.replace('/');
    }
  }, [router, status]);

  const submitFn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      await signUp({
        email,
        password,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        numeroMatricula: numeroMatricula.trim() || undefined,
      });
      // Best-effort: the client only reports the marketing opt-in — IP, user
      // agent, timestamp and version are the server's to capture, and the
      // guarantee that no one contracts without accepting is the future DB
      // constraint, not this call. A failure here must not strand a user
      // whose account already exists, so it does not fail the signup.
      try {
        await legalService.registerAcceptance({ marketing: marketingAccepted });
      } catch {
        // Server-side enforcement will re-request acceptance on first use.
      }
    },
    [signUp, nombre, apellido, numeroMatricula, marketingAccepted],
  );

  const form = useAuthForm(submitFn, t('auth.signUp.genericError'), onSuccess);

  const awaitingConfirmation = submitted && status !== 'signedIn';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding }),
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: t('auth.signUp.title') }} />

        {awaitingConfirmation ? (
          <Card>
            <Text style={styles.noticeTitle} accessibilityRole="header">
              {t('auth.signUp.checkEmail.title')}
            </Text>
            <Text style={styles.notice}>{t('auth.signUp.checkEmail.description')}</Text>
            <Text style={styles.footer}>
              <Link href="/login" style={styles.link}>
                {t('auth.signIn.title')}
              </Link>
            </Text>
          </Card>
        ) : (
          <AuthForm
            title={t('auth.signUp.title')}
            description={t('auth.signUp.description')}
            email={form.email}
            password={form.password}
            onChangeEmail={form.setEmail}
            onChangePassword={form.setPassword}
            onSubmit={form.submit}
            status={form.status}
            errorMessage={form.errorMessage}
            emailLabel={t('auth.emailLabel')}
            emailPlaceholder={t('auth.emailPlaceholder')}
            passwordLabel={t('auth.passwordLabel')}
            passwordPlaceholder={t('auth.newPasswordPlaceholder')}
            submitLabel={t('auth.signUp.submitAction')}
            submittingLabel={t('common.loading')}
            errorTitle={t('auth.signUp.error.title')}
            retryLabel={t('common.retry')}
            extraFieldsValid={nombre.trim().length > 0 && apellido.trim().length > 0 && termsAccepted}
            extraFields={
              <>
                <Input
                  label={t('auth.nombreLabel')}
                  placeholder={t('auth.nombrePlaceholder')}
                  value={nombre}
                  onChangeText={setNombre}
                  autoComplete="given-name"
                  editable={form.status !== 'submitting'}
                />
                <Input
                  label={t('auth.apellidoLabel')}
                  placeholder={t('auth.apellidoPlaceholder')}
                  value={apellido}
                  onChangeText={setApellido}
                  autoComplete="family-name"
                  editable={form.status !== 'submitting'}
                />
                <Input
                  label={t('auth.numeroMatriculaLabel')}
                  hint={t('auth.numeroMatriculaHint')}
                  placeholder={t('auth.numeroMatriculaPlaceholder')}
                  value={numeroMatricula}
                  onChangeText={setNumeroMatricula}
                  editable={form.status !== 'submitting'}
                />
                <AcceptanceCheckboxes
                  termsAccepted={termsAccepted}
                  onChangeTerms={setTermsAccepted}
                  marketingAccepted={marketingAccepted}
                  onChangeMarketing={setMarketingAccepted}
                  disabled={form.status === 'submitting'}
                />
              </>
            }
            footer={
              <Text style={styles.footer}>
                {t('auth.signUp.hasAccount')}{' '}
                <Link href="/login" style={styles.link}>
                  {t('auth.signIn.title')}
                </Link>
              </Text>
            }
          />
        )}

        <LegalFooter />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  noticeTitle: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 18,
    color: semanticColors.text.primary,
    marginBottom: spacing.sm,
  },
  notice: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    color: semanticColors.text.secondary,
    marginBottom: spacing.md,
  },
  footer: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    color: semanticColors.text.secondary,
    textAlign: 'center',
  },
  link: {
    color: semanticColors.text.primary,
    fontFamily: typography.bodySm.fontFamily,
  },
});
