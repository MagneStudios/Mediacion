import { Link, Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { useAuthSession } from '@/features/auth/auth-session';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { useAuthForm } from '@/features/auth/useAuthForm';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  const { signIn } = useAuthSession();

  const form = useAuthForm(signIn, t('auth.signIn.genericError'), () => {
    router.replace('/');
  });

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
        <Stack.Screen options={{ title: t('auth.signIn.title') }} />

        <AuthForm
          title={t('auth.signIn.title')}
          description={t('auth.signIn.description')}
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
          passwordPlaceholder={t('auth.passwordPlaceholder')}
          submitLabel={t('auth.signIn.submitAction')}
          submittingLabel={t('common.loading')}
          errorTitle={t('auth.signIn.error.title')}
          retryLabel={t('common.retry')}
          footer={
            <Text style={styles.footer}>
              {t('auth.signIn.noAccount')}{' '}
              <Link href="/signup" style={styles.link}>
                {t('auth.signUp.title')}
              </Link>
            </Text>
          }
        />
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
