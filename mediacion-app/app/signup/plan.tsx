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
 * A plan skips checkout in this wizard only if it is both self-serve
 * (`is_self_serve`, migración 45 — the alta can contract it on its own,
 * unlike `corporativo`, which is "a consultar" and goes through ventas) AND
 * priced at zero. Checking only one of the two would get either case wrong:
 * `corporativo` shares `precio === 0` with `base` in the catalog, so a
 * price-only check would activate it for free; and a self-serve-only check
 * would skip checkout for a paid self-serve plan (`simple`, `plus`,
 * `particular`), which still needs to go through Mercado Pago.
 *
 * Before `is_self_serve` existed, this gated on `plan.nombre === 'base'` — a
 * literal that worked only because `base` happened to be the one free
 * self-serve plan in the seed, not because it encoded the actual rule.
 */
function isSelfServeFree(plan: Plan): boolean {
  return plan.isSelfServe && plan.precio === 0;
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
    //
    // `startCheckout`, no `subscribeToPlan`: contra backend real,
    // `subscribeToPlan` es y seguirá siendo mock-only (no hay endpoint de
    // factura, ver `services/api/billing.backed-service.ts`) — llamarlo acá
    // simulaba un éxito local sin crear ninguna suscripción de verdad en el
    // servidor. Desde que BE activa un plan de precio 0 sin pasar por
    // Mercado Pago (`fix(pagos)` 10/09), `startCheckout` ya resuelve esto
    // igual que hace `/profile/plan/checkout` para el mismo caso.
    setSubscribingPlanId(plan.id);
    setStatus('submitting');
    try {
      const start = await billingService.startCheckout(plan.id);
      if (start.kind === 'redirect') {
        // Defensivo: el plan "base" se espera gratis, pero si el precio
        // cambiara del lado del servidor, mejor caer al checkout real (que
        // sí sabe abrir Mercado Pago) que manejar un pago acá.
        setStatus('idle');
        router.push({ pathname: '/profile/plan/checkout', params: { planId: plan.id } });
        return;
      }
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
