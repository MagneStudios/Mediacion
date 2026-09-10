import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { PlanOptionCard } from '@/features/billing/components/PlanOptionCard';
import { usePlans } from '@/features/plans/hooks/usePlans';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { billingService } from '@/services/billing.service';
import type { Plan } from '@/types/plan';
import { blurActiveElement } from '@/utils/blur-active-element';

type SubscribeStatus = 'idle' | 'submitting' | 'error';

/**
 * `base` is the one plan actually meant to be picked up for free, self-serve,
 * no checkout — `corporativo` shares `precio === 0` in the catalog too, but
 * that zero means "a consultar", not "gratis" (see the extensive comment in
 * `mocks/plans.ts` — it is a known, still-open product/DB decision,
 * `docs/plan-frontend-monetizacion.md` §1.2–§1.3). Gating on the name instead
 * of `precio === 0` keeps this wizard from accidentally treating a
 * to-be-quoted enterprise plan as self-serve-free.
 */
function isSelfServeFree(plan: Plan): boolean {
  return plan.nombre === 'base';
}

export default function SignupPlanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  const plansResult = usePlans();
  // Punto #4: si esta cuenta se creó a partir de un link de invitación
  // (propagado desde app/signup/index.tsx), una vez que el plan queda
  // asignado el destino es /case/join con el código precargado, no el
  // dashboard vacío.
  const { joinToken } = useLocalSearchParams<{ joinToken?: string }>();

  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscribeStatus>('idle');

  const goNext = () => {
    blurActiveElement();
    if (joinToken) {
      router.replace({ pathname: '/case/join', params: { token: joinToken } });
      return;
    }
    router.replace('/');
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (status === 'submitting') return;

    if (!isSelfServeFree(plan)) {
      blurActiveElement();
      router.push({
        pathname: '/profile/plan/checkout',
        params: { planId: plan.id },
      });
      return;
    }

    // Punto #2: el plan free termina el alta ahí mismo, sin pasar por
    // checkout — ninguna cuenta debe quedar sin plan asignado.
    setSubscribingPlanId(plan.id);
    setStatus('submitting');
    try {
      await billingService.subscribeToPlan(plan.id);
      setStatus('idle');
      goNext();
    } catch {
      setStatus('error');
    }
  };

  if (plansResult.status === 'loading') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('auth.signUp.plan.title') }} />
        <LoadingState label={t('auth.signUp.plan.loading')} />
      </ScrollView>
    );
  }

  if (plansResult.status === 'error') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('auth.signUp.plan.title') }} />
        <ErrorState
          title={t('auth.signUp.plan.error.title')}
          retryLabel={t('auth.signUp.plan.error.retry')}
          onRetry={plansResult.reload}
        />
      </ScrollView>
    );
  }

  // `usePlans` also has an `empty` status (catalog with zero rows) — treated
  // here as "nothing to show", same as `success` with an empty array, rather
  // than its own screen: there is no retry action that would change it, and
  // this dead end is expected to never happen in practice (the catalog seed
  // always ships at least the free plan).
  const plans = plansResult.status === 'empty' ? [] : plansResult.plans;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('auth.signUp.plan.title') }} />

      <Text style={styles.title} accessibilityRole="header">
        {t('auth.signUp.plan.title')}
      </Text>
      <Text style={styles.description}>{t('auth.signUp.plan.description')}</Text>

      {status === 'error' ? (
        <ErrorState
          title={t('auth.signUp.plan.subscribeError.title')}
          retryLabel={t('auth.signUp.plan.subscribeError.retry')}
          onRetry={() => {
            const plan = plans.find((candidate) => candidate.id === subscribingPlanId);
            if (plan) void handleSelectPlan(plan);
          }}
        />
      ) : null}

      {plans.map((plan) => (
        <PlanOptionCard
          key={plan.id}
          plan={plan}
          isCurrent={false}
          currentBadgeLabel={t('billing.myPlan.currentBadge')}
          casosLabel={t('admin.planes.card.casosLabel')}
          carpetasLabel={t('admin.planes.card.carpetasLabel')}
          iteracionesLabel={t('admin.planes.card.iteracionesLabel')}
          negotiationsPerPeriodLabel={t('billing.myPlan.negotiationsPerPeriodLabel')}
          clientsPerPeriodLabel={t('billing.myPlan.clientsPerPeriodLabel')}
          taxesIncludedLabel={t('billing.myPlan.taxesIncluded')}
          netoLabel={t('billing.checkout.breakdown.neto')}
          subscribeLabel={
            status === 'submitting' && subscribingPlanId === plan.id
              ? t('auth.signUp.plan.subscribing')
              : t('billing.myPlan.subscribeAction')
          }
          onSubscribe={() => void handleSelectPlan(plan)}
          disabled={status === 'submitting'}
        />
      ))}
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
