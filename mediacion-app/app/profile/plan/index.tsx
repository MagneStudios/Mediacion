import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, ConfirmationDialog, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { PlanOptionCard } from '@/features/billing/components/PlanOptionCard';
import { useCurrentSubscription } from '@/features/billing/hooks/useCurrentSubscription';
import { usePlans } from '@/features/plans/hooks/usePlans';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { billingService } from '@/services/billing.service';
import { blurActiveElement } from '@/utils/blur-active-element';

type CancelStatus = 'idle' | 'submitting' | 'error';

export default function MyPlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  const subscriptionResult = useCurrentSubscription();
  const plansResult = usePlans();

  const [cancelDialogVisible, setCancelDialogVisible] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<CancelStatus>('idle');

  const confirmCancel = async () => {
    setCancelStatus('submitting');
    try {
      await billingService.cancelSubscription();
      setCancelStatus('idle');
      setCancelDialogVisible(false);
      blurActiveElement();
      subscriptionResult.reload();
    } catch {
      setCancelStatus('error');
    }
  };

  const loading = subscriptionResult.status === 'loading' || plansResult.status === 'loading';
  const failed = subscriptionResult.status === 'error' || plansResult.status === 'error';

  if (loading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('billing.myPlan.title') }} />
        <LoadingState label={t('common.loading')} />
      </ScrollView>
    );
  }

  if (failed) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('billing.myPlan.title') }} />
        <ErrorState
          title={t('billing.myPlan.error.title')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            subscriptionResult.status === 'error' && subscriptionResult.reload();
            plansResult.status === 'error' && plansResult.reload();
          }}
        />
      </ScrollView>
    );
  }

  const plans = plansResult.status === 'success' ? plansResult.plans : [];
  const currentPlanId = subscriptionResult.subscription?.planId ?? null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.standard, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('billing.myPlan.title') }} />

      <Text style={styles.title} accessibilityRole="header">
        {t('billing.myPlan.title')}
      </Text>
      <Text style={styles.description}>
        {currentPlanId ? t('billing.myPlan.hasSubscription') : t('billing.myPlan.noSubscription')}
      </Text>

      {plans.map((plan) => (
        <PlanOptionCard
          key={plan.id}
          plan={plan}
          isCurrent={plan.id === currentPlanId}
          currentBadgeLabel={t('billing.myPlan.currentBadge')}
          casosLabel={t('admin.planes.card.casosLabel')}
          carpetasLabel={t('admin.planes.card.carpetasLabel')}
          iteracionesLabel={t('admin.planes.card.iteracionesLabel')}
          subscribeLabel={t('billing.myPlan.subscribeAction')}
          onSubscribe={() => {
            blurActiveElement();
            router.push({ pathname: '/profile/plan/checkout', params: { planId: plan.id } });
          }}
        />
      ))}

      {/*
        Botón de baja online (instructivo TyC §5): same medium the user
        contracted through, no phone call, no email. This ends the recurring
        charge — account deactivation lives separately in profile/account.
      */}
      {subscriptionResult.subscription?.estado === 'activa' ? (
        <Button
          variant="destructive"
          size="lg"
          fullWidth
          onPress={() => {
            setCancelStatus('idle');
            setCancelDialogVisible(true);
          }}
        >
          {t('billing.myPlan.cancel.action')}
        </Button>
      ) : null}

      <ConfirmationDialog
        visible={cancelDialogVisible}
        title={t('billing.myPlan.cancel.dialogTitle')}
        icon="alert-circle"
        destructive
        confirmLabel={t('billing.myPlan.cancel.confirm')}
        confirmVariant="destructive"
        onConfirm={confirmCancel}
        cancelLabel={t('billing.myPlan.cancel.keep')}
        onCancel={() => {
          if (cancelStatus === 'submitting') return;
          setCancelDialogVisible(false);
        }}
        loading={cancelStatus === 'submitting'}
        errorTitle={cancelStatus === 'error' ? t('billing.myPlan.cancel.error.title') : undefined}
        retryLabel={t('common.retry')}
      >
        {t('billing.myPlan.cancel.dialogBody')}
      </ConfirmationDialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  loadingContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  description: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
    marginBottom: spacing.xs,
  },
});
