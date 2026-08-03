import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Icon, LoadingState, ResponsiveColumns, StatusPill } from '@/design-system';
import type { StatusPillStatus } from '@/design-system/components/StatusPill';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { PrivacyNotice } from '@/features/cases/components/PrivacyNotice';
import { MediatorDemoNotice } from '@/features/mediator/components/MediatorDemoNotice';
import { MediatorRequestDialog } from '@/features/mediator/components/MediatorRequestDialog';
import { SharedMediatorProfileCard } from '@/features/mediator/components/SharedMediatorProfileCard';
import { useMediator } from '@/features/mediator/hooks/useMediator';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';

const SUMMARY_KEY_BY_ELIGIBILITY = {
  unavailable_before_round_3: 'unavailableBeforeRound3',
  available: 'available',
  pending: 'pending',
  assigned: 'assigned',
  unavailable: 'unavailable',
  read_only: 'readOnly',
} as const;

const STATUS_BY_ELIGIBILITY: Record<keyof typeof SUMMARY_KEY_BY_ELIGIBILITY, StatusPillStatus> = {
  unavailable_before_round_3: 'neutral',
  available: 'neutral',
  pending: 'info',
  assigned: 'success',
  unavailable: 'neutral',
  read_only: 'neutral',
};

export default function MediatorDashboardScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { status, state, reload, requestStatus, requestMediator, resetRequestStatus } = useMediator(caseId);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const { horizontalPadding, isWide } = useResponsiveLayout();

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
  const statusVisual = STATUS_BY_ELIGIBILITY[state.eligibility];

  const primaryColumn = (
    <>
      <View style={styles.explainer}>
        <View style={styles.sectionHeadingRow}>
          <Icon name="scale" size={20} color={semanticColors.text.secondary} />
          <Text style={styles.sectionHeading} accessibilityRole="header">
            {t('mediator.explainer.title')}
          </Text>
        </View>
        <View style={styles.explainerBody}>
          <Text style={styles.bodyText}>{t('mediator.explainer.helpsBody')}</Text>
          <Text style={styles.bodyText}>{t('mediator.explainer.decisionBody')}</Text>
          <Text style={styles.bodyText}>{t('mediator.explainer.privacyBody')}</Text>
          <Text style={styles.bodyText}>{t('mediator.explainer.demoBody')}</Text>
        </View>
      </View>

      <View style={styles.statusSection} accessibilityLiveRegion="polite" accessibilityRole="text">
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle} accessibilityRole="header">
            {t(`mediator.summary.${summaryKey}.title`)}
          </Text>
          <StatusPill status={statusVisual}>{t(`mediator.summary.${summaryKey}.status`)}</StatusPill>
        </View>
        <Text style={styles.bodyText}>{t(`mediator.summary.${summaryKey}.description`)}</Text>
      </View>

      {state.eligibility === 'available' ? (
        <Button variant="secondary" size="lg" fullWidth onPress={openConfirm} loading={requestStatus === 'pending'} loadingLabel={t('common.loading')}>
          {t('mediator.summary.requestAction')}
        </Button>
      ) : null}
    </>
  );

  const secondaryColumn = (
    <>
      <View style={styles.notices}>
        <PrivacyNotice>{t('mediator.dashboard.privacyNotice')}</PrivacyNotice>
        <MediatorDemoNotice title={t('mediator.demoNotice.title')} body={t('mediator.demoNotice.body')} />
      </View>

      {state.mediator ? <SharedMediatorProfileCard profile={state.mediator} assignedAt={state.mediation?.acceptedAt} /> : null}

      <Button
        variant="tertiary"
        size="lg"
        fullWidth
        onPress={() => {
          blurActiveElement();
          router.push({ pathname: '/case/[id]/mediator/activity', params: { id: caseId } });
        }}
      >
        {t('mediator.activity.viewAction')}
      </Button>
    </>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.wide, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('mediator.dashboard.title') }} />

      <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
        {t('mediator.dashboard.title')}
      </Text>

      <ResponsiveColumns primary={primaryColumn} secondary={secondaryColumn} />

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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  titleWide: {
    ...typography.displayLg,
  },
  explainer: {
    gap: spacing.sm,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionHeading: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
    flex: 1,
  },
  explainerBody: {
    gap: spacing.sm,
  },
  statusSection: {
    gap: spacing.xs,
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statusTitle: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  bodyText: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  notices: {
    gap: spacing.sm,
  },
});
