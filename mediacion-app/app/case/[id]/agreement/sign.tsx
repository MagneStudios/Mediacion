import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { MockSignatureConfirmation } from '@/features/agreements/components/MockSignatureConfirmation';
import { SharedAgreementCard } from '@/features/agreements/components/SharedAgreementCard';
import { SignatureEnvironmentNotice } from '@/features/agreements/components/SignatureEnvironmentNotice';
import { useAgreement } from '@/features/agreements/hooks/useAgreement';
import { blurActiveElement } from '@/utils/blur-active-element';

export default function AgreementSignScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { status, state, reload, signStatus, submitSignature, resetSignStatus } = useAgreement(caseId);

  const [confirmed, setConfirmed] = useState(false);

  // Reset the confirmation whenever a different case is opened.
  useEffect(() => {
    setConfirmed(false);
  }, [caseId]);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
        statusVisual={agreement.estado === 'enviado_a_firma' ? 'info' : 'neutral'}
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

          {signStatus === 'error' ? (
            <ErrorState
              title={t('agreement.sign.error.title')}
              retryLabel={t('common.retry')}
              onRetry={handleConfirmSignature}
            />
          ) : (
            <Button
              variant="primary"
              fullWidth
              onPress={handleConfirmSignature}
              disabled={!confirmed || signStatus === 'pending'}
            >
              {signStatus === 'pending' ? t('common.loading') : t('agreement.sign.action')}
            </Button>
          )}
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
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 24,
    letterSpacing: -0.4,
    color: semanticColors.text.primary,
  },
  bodyText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 18,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
});
