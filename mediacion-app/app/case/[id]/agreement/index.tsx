import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { PrivacyNotice } from '@/features/cases/components/PrivacyNotice';
import { DocumentPreparationState } from '@/features/agreements/components/DocumentPreparationState';
import { SharedAgreementCard } from '@/features/agreements/components/SharedAgreementCard';
import { SignatureProgressCard } from '@/features/agreements/components/SignatureProgressCard';
import { useAgreement } from '@/features/agreements/hooks/useAgreement';
import { blurActiveElement } from '@/utils/blur-active-element';
import { formatAgreementDate } from '@/utils/format-agreement-date';

export default function AgreementDashboardScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { status, state, reload, prepareStatus, prepareDocument } = useAgreement(caseId);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('agreement.dashboard.title') }} />
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('agreement.dashboard.title') }} />
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reload} />
      </View>
    );
  }

  if (!state) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('agreement.dashboard.title') }} />
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reload} />
      </View>
    );
  }

  const { agreement, signers, waitingForOtherParty, allSignaturesComplete, canPrepareDocument, canSign, readOnly } = state;

  const statusLabel = allSignaturesComplete
    ? t('agreement.status.firmado')
    : agreement.estado === 'enviado_a_firma'
      ? t('agreement.status.enviado_a_firma')
      : agreement.estado === 'con_aviso'
        ? t('agreement.status.con_aviso')
        : t('agreement.status.borrador');
  const statusVisual = allSignaturesComplete ? 'success' : agreement.estado === 'enviado_a_firma' ? 'info' : 'neutral';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('agreement.dashboard.title') }} />

      <Text style={styles.title} accessibilityRole="header">
        {t('agreement.dashboard.title')}
      </Text>
      <PrivacyNotice title={t('agreement.sharedMarker.title')}>{t('agreement.sharedMarker.body')}</PrivacyNotice>

      <SharedAgreementCard
        title={agreement.title}
        summary={agreement.summary}
        terms={agreement.terms}
        rationale={agreement.rationale}
        rationaleLabel={t('agreement.detail.rationaleTitle')}
        statusLabel={statusLabel}
        statusVisual={statusVisual}
      />

      <SignatureProgressCard
        title={t('agreement.progress.title')}
        signers={signers}
        ownRoleLabel={t('agreement.signer.own')}
        otherRoleLabel={t('agreement.signer.other')}
        signedStatusLabel={t('agreement.signer.signed')}
        pendingStatusLabel={t('agreement.signer.pending')}
        formatDate={formatAgreementDate}
      />

      {canPrepareDocument ? (
        prepareStatus === 'pending' ? (
          <DocumentPreparationState title={t('agreement.prepare.preparingTitle')} description={t('agreement.prepare.preparingBody')} />
        ) : prepareStatus === 'error' ? (
          <ErrorState title={t('agreement.prepare.error.title')} retryLabel={t('common.retry')} onRetry={prepareDocument} />
        ) : (
          <Button variant="primary" fullWidth onPress={prepareDocument}>
            {t('agreement.prepare.action')}
          </Button>
        )
      ) : null}

      {canSign ? (
        <Button
          variant="primary"
          fullWidth
          onPress={() => {
            blurActiveElement();
            router.push({ pathname: '/case/[id]/agreement/sign', params: { id: caseId } });
          }}
        >
          {t('agreement.sign.goToAction')}
        </Button>
      ) : null}

      {waitingForOtherParty ? <Text style={styles.bodyText}>{t('agreement.response.waitingOther')}</Text> : null}

      {allSignaturesComplete ? <Text style={styles.bodyText}>{t('agreement.response.completed')}</Text> : null}

      {readOnly && agreement.estado === 'con_aviso' ? <Text style={styles.bodyText}>{t('agreement.status.conAvisoNotice')}</Text> : null}

      <Button
        variant="tertiary"
        fullWidth
        onPress={() => {
          blurActiveElement();
          router.push({ pathname: '/case/[id]/agreement/history', params: { id: caseId } });
        }}
      >
        {t('agreement.history.viewAction')}
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
});
