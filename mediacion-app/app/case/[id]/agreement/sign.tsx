import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { SharedAgreementCard } from '@/features/agreements/components/SharedAgreementCard';
import { SignatureEnvironmentNotice } from '@/features/agreements/components/SignatureEnvironmentNotice';
import { SignatureProgressCard } from '@/features/agreements/components/SignatureProgressCard';
import { useAgreement } from '@/features/agreements/hooks/useAgreement';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';
import { formatAgreementDate } from '@/utils/format-agreement-date';

/**
 * Pantalla de firma, ahora de solo-lectura.
 *
 * La firma real ocurre por mail en SignNow, fuera de la app: el único disparo
 * de `POST /acuerdos/:id/firmar` es `prepareSignatureDocument`, y una segunda
 * llamada sobre un acuerdo ya en `enviado_a_firma` es un `409
 * acuerdo_not_borrador`. Así que acá no hay botón de "confirmar": se muestra
 * el estado por firmante y la invitación enviada, y el refetch en foco de
 * `useAgreement` refleja el estado cuando el webhook de SignNow lo actualice.
 */
export default function AgreementSignScreen() {
  // Lee por acuerdo cuando el dashboard dice cuál: es la pantalla que firma.
  const { id: caseId, agreementId: expectedAgreementId } = useLocalSearchParams<{ id: string; agreementId?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  const { status, state, reload } = useAgreement(caseId, expectedAgreementId);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('agreement.sign.title') }} />
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (status === 'error' || !state) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('agreement.sign.title') }} />
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reload} />
      </View>
    );
  }

  const { agreement, signers, canSign, ownSignatureComplete, waitingForOtherParty, allSignaturesComplete } = state;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.reading, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('agreement.sign.title') }} />

      <Text style={styles.title} accessibilityRole="header">
        {t('agreement.sign.title')}
      </Text>

      <SharedAgreementCard
        title={agreement.title}
        summary={agreement.summary}
        terms={agreement.terms}
        rationale={agreement.rationale}
        rationaleLabel={t('agreement.detail.rationaleTitle')}
        statusLabel={t(`agreement.status.${agreement.estado}`)}
        statusVisual={
          agreement.estado === 'con_aviso'
            ? 'warning'
            : agreement.estado === 'firmado'
              ? 'success'
              : agreement.estado === 'enviado_a_firma'
                ? 'info'
                : 'neutral'
        }
      />

      <SignatureEnvironmentNotice title={t('agreement.environment.title')} body={t('agreement.environment.body')} />

      <SignatureProgressCard
        title={t('agreement.progress.title')}
        signers={signers}
        ownRoleLabel={t('agreement.signer.own')}
        otherRoleLabel={t('agreement.signer.other')}
        signedStatusLabel={t('agreement.signer.signed')}
        pendingStatusLabel={t('agreement.signer.pending')}
        formatDate={formatAgreementDate}
      />

      {allSignaturesComplete ? (
        <Text style={styles.bodyText}>{t('agreement.response.completed')}</Text>
      ) : ownSignatureComplete || waitingForOtherParty ? (
        <Text style={styles.bodyText}>{t('agreement.response.waitingOther')}</Text>
      ) : canSign ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('agreement.sign.invitationSent.title')}</Text>
          <Text style={styles.bodyText}>{t('agreement.sign.invitationSent.body')}</Text>
        </View>
      ) : (
        <Text style={styles.bodyText}>{t('agreement.sign.notReady')}</Text>
      )}

      <Button
        variant="secondary"
        size="lg"
        fullWidth
        onPress={() => {
          blurActiveElement();
          router.back();
        }}
      >
        {t('agreement.sign.backToAgreement')}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  bodyText: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
});
