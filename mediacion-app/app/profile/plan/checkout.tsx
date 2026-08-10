import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { TaxBreakdownSummary } from '@/features/billing/components/TaxBreakdownSummary';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { billingService } from '@/services/billing.service';
import { plansService } from '@/services/plans.service';
import type { Plan } from '@/types/plan';
import { blurActiveElement } from '@/utils/blur-active-element';
import { computeTaxBreakdown } from '@/utils/compute-tax-breakdown';

type FetchStatus = 'loading' | 'error' | 'success';
type PayStatus = 'idle' | 'submitting' | 'error';

export default function PlanCheckoutScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();

  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('loading');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [payStatus, setPayStatus] = useState<PayStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    setFetchStatus('loading');
    plansService
      .getPlan(planId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setFetchStatus('error');
          return;
        }
        setPlan(result);
        setFetchStatus('success');
      })
      .catch(() => {
        if (cancelled) return;
        setFetchStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  if (fetchStatus === 'loading') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('billing.checkout.title') }} />
        <LoadingState label={t('common.loading')} />
      </ScrollView>
    );
  }

  if (fetchStatus === 'error' || !plan) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('billing.checkout.title') }} />
        <ErrorState
          title={t('billing.checkout.notFound.title')}
          retryLabel={t('common.back')}
          onRetry={() => {
            blurActiveElement();
            router.back();
          }}
        />
      </ScrollView>
    );
  }

  const breakdown = computeTaxBreakdown(plan.precio);

  const handlePay = async () => {
    if (payStatus === 'submitting') return;
    setPayStatus('submitting');
    try {
      const { subscription } = await billingService.subscribeToPlan(plan.id);
      blurActiveElement();
      // replace, not push: a completed checkout has nothing left to do —
      // going back to it would only re-offer a payment already made.
      router.replace({ pathname: '/profile/plan/receipt', params: { subscriptionId: subscription.id } });
    } catch {
      setPayStatus('error');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('billing.checkout.title') }} />

      <Text style={styles.title} accessibilityRole="header">
        {t('billing.checkout.title', { nombre: plan.nombre })}
      </Text>
      <Text style={styles.description}>{t('billing.checkout.description')}</Text>

      <TaxBreakdownSummary
        breakdown={breakdown}
        netoLabel={t('billing.checkout.breakdown.neto')}
        ivaLabel={t('billing.checkout.breakdown.iva')}
        otrosImpuestosLabel={t('billing.checkout.breakdown.otrosImpuestos')}
        totalLabel={t('billing.checkout.breakdown.total')}
      />

      <Text style={styles.sandboxNotice}>{t('billing.checkout.sandboxNotice')}</Text>

      {payStatus === 'error' ? (
        <ErrorState title={t('billing.checkout.error.title')} retryLabel={t('common.retry')} onRetry={handlePay} />
      ) : (
        <Button variant="primary" size="lg" fullWidth onPress={handlePay} loading={payStatus === 'submitting'} loadingLabel={t('billing.checkout.paying')}>
          {t('billing.checkout.payAction')}
        </Button>
      )}
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
    gap: spacing.lg,
  },
  title: {
    ...typography.headline,
    textTransform: 'capitalize',
    color: semanticColors.text.primary,
  },
  description: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
    marginTop: -spacing.sm,
  },
  sandboxNotice: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
});
