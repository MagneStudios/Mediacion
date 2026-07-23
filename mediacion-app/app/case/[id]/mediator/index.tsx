import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { PrivacyNotice } from '@/features/cases/components/PrivacyNotice';
import { MediatorDemoNotice } from '@/features/mediator/components/MediatorDemoNotice';
import { MediatorRequestDialog } from '@/features/mediator/components/MediatorRequestDialog';
import { SharedMediatorProfileCard } from '@/features/mediator/components/SharedMediatorProfileCard';
import { useMediator } from '@/features/mediator/hooks/useMediator';
import { blurActiveElement } from '@/utils/blur-active-element';

const SUMMARY_KEY_BY_ELIGIBILITY = {
  unavailable_before_round_3: 'unavailableBeforeRound3',
  available: 'available',
  pending: 'pending',
  assigned: 'assigned',
  unavailable: 'unavailable',
  read_only: 'readOnly',
} as const;

export default function MediatorDashboardScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { status, state, reload, requestStatus, requestMediator, resetRequestStatus } = useMediator(caseId);
  const [confirmVisible, setConfirmVisible] = useState(false);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('mediator.dashboard.title') }} />
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (status === 'error' || !state) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('mediator.dashboard.title') }} />
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reload} />
      </View>
    );
  }

  const openConfirm = () => {
    resetRequestStatus();
    setConfirmVisible(true);
  };

  const handleConfirmRequest = async () => {
    await requestMediator();
    setConfirmVisible(false);
  };

  const summaryKey = SUMMARY_KEY_BY_ELIGIBILITY[state.eligibility];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('mediator.dashboard.title') }} />

      <Text style={styles.title} accessibilityRole="header">
        {t('mediator.dashboard.title')}
      </Text>
      <PrivacyNotice>{t('mediator.dashboard.privacyNotice')}</PrivacyNotice>
      <MediatorDemoNotice title={t('mediator.demoNotice.title')} body={t('mediator.demoNotice.body')} />

      <View style={styles.section}>
        <Text style={styles.sectionHeading} accessibilityRole="header">
          {t('mediator.explainer.title')}
        </Text>
        <Text style={styles.bodyText}>{t('mediator.explainer.helpsBody')}</Text>
        <Text style={styles.bodyText}>{t('mediator.explainer.decisionBody')}</Text>
        <Text style={styles.bodyText}>{t('mediator.explainer.privacyBody')}</Text>
        <Text style={styles.bodyText}>{t('mediator.explainer.demoBody')}</Text>
      </View>

      <View style={styles.statusSection} accessibilityLiveRegion="polite" accessibilityRole="text">
        <Text style={styles.statusTitle} accessibilityRole="header">
          {t(`mediator.summary.${summaryKey}.title`)}
        </Text>
        <Text style={styles.bodyText}>{t(`mediator.summary.${summaryKey}.description`)}</Text>
      </View>

      {state.eligibility === 'available' ? (
        <Button variant="secondary" fullWidth onPress={openConfirm} disabled={requestStatus === 'pending'}>
          {requestStatus === 'pending' ? t('common.loading') : t('mediator.summary.requestAction')}
        </Button>
      ) : null}

      {state.mediator ? <SharedMediatorProfileCard profile={state.mediator} assignedAt={state.mediation?.acceptedAt} /> : null}

      <Button
        variant="tertiary"
        fullWidth
        onPress={() => {
          blurActiveElement();
          router.push({ pathname: '/case/[id]/mediator/activity', params: { id: caseId } });
        }}
      >
        {t('mediator.activity.viewAction')}
      </Button>

      <MediatorRequestDialog
        visible={confirmVisible}
        status={requestStatus === 'pending' ? 'submitting' : requestStatus === 'error' ? 'error' : 'idle'}
        title={t('mediator.request.dialog.title')}
        body={t('mediator.request.dialog.body')}
        confirmLabel={t('mediator.request.dialog.confirm')}
        cancelLabel={t('mediator.request.dialog.cancel')}
        errorTitle={t('mediator.request.error.title')}
        retryLabel={t('common.retry')}
        onConfirm={handleConfirmRequest}
        onCancel={() => {
          if (requestStatus === 'pending') return;
          setConfirmVisible(false);
        }}
      />
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
  section: {
    gap: spacing.xs,
  },
  sectionHeading: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 16,
    color: semanticColors.text.primary,
  },
  statusSection: {
    gap: spacing.xxs,
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: 14,
    padding: spacing.md,
  },
  statusTitle: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 16,
    color: semanticColors.text.primary,
  },
  bodyText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
});
