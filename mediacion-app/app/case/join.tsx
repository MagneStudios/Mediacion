import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { JoinCaseForm, type JoinCaseFormStatus } from '@/features/cases/components/JoinCaseForm';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

// Placeholder shell only — no case-join service exists yet in this phase
// (see `POST /casos/unirse` in docs/integration-contract.md). `status` is a
// fixed constant, never state, because there is no real submission to
// transition it: never fabricate a submitting/error/success result without
// a real backend call behind it.
const status: JoinCaseFormStatus = 'idle';

export default function CaseJoinScreen() {
  const { t } = useTranslation();
  const { horizontalPadding } = useResponsiveLayout();

  const [token, setToken] = useState('');

  const handleSubmit = () => {
    // Intentional no-op — wiring this to a real POST /casos/unirse call is
    // out of scope for this presentational-only screen.
  };

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
          onChangeText={setToken}
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
