import { Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { JoinCaseForm, type JoinCaseFormStatus } from '@/features/cases/components/JoinCaseForm';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { casesService } from '@/services/cases.service';

export default function CaseJoinScreen() {
  const { t } = useTranslation();
  const { horizontalPadding } = useResponsiveLayout();

  const [token, setToken] = useState('');
  const [status, setStatus] = useState<JoinCaseFormStatus>('idle');

  const handleSubmit = useCallback(async () => {
    // Guarded so a double tap cannot fire a second redemption while the first
    // is in flight — redeeming twice is exactly what the server rejects.
    if (status === 'submitting' || token.trim() === '') {
      return;
    }
    setStatus('submitting');
    try {
      const joined = await casesService.joinCase(token);
      // `replace`, not `push`: once the token is redeemed this screen has
      // nothing left to do, and going back to it would only fail.
      router.replace(`/case/${joined.id}`);
    } catch {
      // Deliberately one error state. The server distinguishes unknown,
      // already-redeemed and expired tokens, but telling someone holding an
      // invitation which of those it was is an enumeration oracle, and the
      // recovery is the same in every case: check the code and try again.
      setStatus('error');
    }
  }, [status, token]);

  const handleChangeText = useCallback((next: string) => {
    setToken(next);
    // Clears the error as soon as the code changes, so a stale failure does not
    // sit under a value the user has already corrected.
    setStatus((current) => (current === 'error' ? 'idle' : current));
  }, []);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen options={{ title: t('caseJoin.title') }} />

        <JoinCaseForm
          value={token}
          onChangeText={handleChangeText}
          status={status}
          onSubmit={handleSubmit}
          title={t('caseJoin.title')}
          description={t('caseJoin.description')}
          inputLabel={t('caseJoin.inputLabel')}
          inputPlaceholder={t('caseJoin.inputPlaceholder')}
          submitLabel={t('caseJoin.submitAction')}
          submittingLabel={t('common.loading')}
          errorTitle={t('caseJoin.error.title')}
          errorDescription={t('caseJoin.error.description')}
          retryLabel={t('common.retry')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
});
