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
import { isInvitationExpiredError } from '@/utils/is-invitation-expired-error';
import { isSubscriptionRequiredError } from '@/utils/is-subscription-required-error';

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
      // R-07: the invitador may have set "pagás vos" on this invitation —
      // gate straight into the payment-required screen instead of the case
      // itself, mirroring the backend's planned gate on this same endpoint.
      router.replace(
        joined.requiresPayment ? `/case/${joined.id}/payment-required` : `/case/${joined.id}`,
      );
    } catch (error) {
      // R-04: expired is the one distinction worth surfacing — the server
      // still treats unknown and already-redeemed tokens uniformly (that
      // stays an enumeration oracle otherwise), but an expired invitation
      // is one the person genuinely held, and "check the code and try
      // again" is actively misleading advice for it: no code fixes an
      // elapsed 72 h window, only a brand-new invitation does.
      // C-01: el gate exige suscripción activa en las dos partes antes de
      // activar el caso, y del lado del server la transacción hace rollback
      // entero — no queda nada a medio unir. Es un tercer estado y no el
      // error genérico por el mismo motivo que `expired`: el código que la
      // persona tiene está bien, así que "revisá el enlace o código" la manda
      // a corregir lo único que no está roto.
      if (isSubscriptionRequiredError(error)) {
        setStatus('subscriptionRequired');
        return;
      }
      setStatus(isInvitationExpiredError(error) ? 'expired' : 'error');
    }
  }, [status, token]);

  const handleChangeText = useCallback((next: string) => {
    setToken(next);
    // Clears the error/expired state as soon as the code changes, so a
    // stale failure does not sit under a value the user has already
    // corrected.
    // `subscriptionRequired` NO se limpia al tipear: el código no es el
    // problema, así que borrar el aviso mientras la persona lo edita esconde
    // la única explicación de por qué no pudo entrar.
    setStatus((current) => (current === 'error' || current === 'expired' ? 'idle' : current));
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
          expiredTitle={t('caseJoin.expired.title')}
          expiredDescription={t('caseJoin.expired.description')}
          subscriptionRequiredTitle={t('caseJoin.subscriptionRequired.title')}
          subscriptionRequiredDescription={t('caseJoin.subscriptionRequired.description')}
          subscriptionRequiredActionLabel={t('caseJoin.subscriptionRequired.action')}
          onSubscriptionRequiredAction={() => router.push('/profile/plan')}
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
