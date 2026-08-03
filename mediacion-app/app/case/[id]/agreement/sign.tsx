import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { MockSignatureConfirmation } from '@/features/agreements/components/MockSignatureConfirmation';
import { SharedAgreementCard } from '@/features/agreements/components/SharedAgreementCard';
import { SignatureEnvironmentNotice } from '@/features/agreements/components/SignatureEnvironmentNotice';
import { useAgreement } from '@/features/agreements/hooks/useAgreement';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';

export default function AgreementSignScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  const { status, state, reload, signStatus, submitSignature, resetSignStatus } = useAgreement(caseId);

  const [confirmed, setConfirmed] = useState(false);
  const agreementId = state?.agreement.id;

  // A confirmation applies only to the exact agreement the user reviewed.
  useEffect(() => {
    setConfirmed(false);
  }, [caseId, agreementId]);

  // Reset when leaving the screen.
  useFocusEffect(
    useCallback(() => {
      return () => setConfirmed(false);
    }, []),
  );

  // Reset after a failed attempt, so retrying requires reconfirming.
  useEffect(() => {
    if (signStatus === 'error') setConfirmed(false);
  }, [signStatus]);

  const ownComplete = state?.ownSignatureComplete ?? false;

  // Reset once the agreement becomes signed.
  useEffect(() => {
    if (ownComplete) setConfirmed(false);
  }, [ownComplete]);

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

  const { agreement, canSign, waitingForOtherParty, allSignaturesComplete } = state;

  const handleConfirmSignature = async () => {
    if (!confirmed || signStatus === 'pending') return;
    resetSignStatus();
    await submitSignature(agreement.id);
  };

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

      {ownComplete ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('agreement.sign.registered.title')}</Text>
          <Text style={styles.bodyText}>{t('agreement.sign.registered.body')}</Text>
          {allSignaturesComplete ? (
            <Text style={styles.bodyText}>{t('agreement.response.completed')}</Text>
          ) : waitingForOtherParty ? (
            <Text style={styles.bodyText}>{t('agreement.response.waitingOther')}</Text>
          ) : null}
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
        </View>
      ) : canSign ? (
        <>
          <MockSignatureConfirmation
            checked={confirmed}
            onToggle={() => setConfirmed((value) => !value)}
            label={t('agreement.sign.confirmationLabel')}
            disabled={signStatus === 'pending'}
          />

          {signStatus === 'error' ? <ErrorState title={t('agreement.sign.error.title')} /> : null}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleConfirmSignature}
            disabled={!confirmed}
            loading={signStatus === 'pending'}
            loadingLabel={t('common.loading')}
            accessibilityLabel={t('agreement.sign.action')}
          >
            {t('agreement.sign.action')}
          </Button>
        </>
      ) : (
        <Text style={styles.bodyText}>{t('agreement.sign.notReady')}</Text>
      )}
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
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
});
