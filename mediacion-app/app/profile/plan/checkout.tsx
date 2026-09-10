import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { TaxBreakdownSummary } from '@/features/billing/components/TaxBreakdownSummary';
import { AcceptanceCheckboxes } from '@/features/legal/components/AcceptanceCheckboxes';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { billingService } from '@/services/billing.service';
import { legalService } from '@/services/legal.service';
import { plansService } from '@/services/plans.service';
import type { Plan } from '@/types/plan';
import { blurActiveElement } from '@/utils/blur-active-element';
import { computeTaxBreakdown } from '@/utils/compute-tax-breakdown';

type FetchStatus = 'loading' | 'error' | 'success';
/**
 * `checkoutPending` es el estado que sólo existe contra backend real: la
 * suscripción ya está creada y el checkout de Mercado Pago no se pudo abrir.
 * Se distingue de `error` porque **reintentar no debe volver a empezar** — ver
 * `openCheckout`.
 */
type PayStatus = 'idle' | 'submitting' | 'error' | 'checkoutPending';

export default function PlanCheckoutScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();

  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('loading');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [payStatus, setPayStatus] = useState<PayStatus>('idle');
  // Instructivo TyC §2: the checkout is a contracting point, so acceptance is
  // asked here too — unchecked by default, and the pay button stays disabled
  // until the mandatory one is ticked. Marketing remains optional.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  /**
   * El checkout que ya devolvió el servidor, si lo devolvió.
   *
   * **Se guarda para no volver a crear una suscripción.** `POST /suscripciones`
   * no es idempotente —verificado en `suscripciones.service.ts:104-115`, cada
   * llamada inserta una fila— así que un reintento ciego dejaría al usuario con
   * varias suscripciones en `pendiente_pago`. Con la URL en mano, reintentar es
   * volver a abrirla, no volver a contratar.
   */
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

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
        {/* No plan loaded yet — a plain title; interpolating here would render the raw {{nombre}} placeholder. */}
        <Stack.Screen options={{ title: t('billing.checkout.screenTitle') }} />
        <LoadingState label={t('common.loading')} />
      </ScrollView>
    );
  }

  if (fetchStatus === 'error' || !plan) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('billing.checkout.screenTitle') }} />
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

  /**
   * Abre el checkout de Mercado Pago y deja la app esperando en el callback.
   *
   * El orden importa: **primero se abre y después se navega.** Si `openURL`
   * rechaza —sin navegador, o un esquema que el sistema no sabe abrir— navegar
   * igual dejaría a la persona en una pantalla que espera para siempre un pago
   * que nunca va a poder hacer.
   */
  const openCheckout = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setPayStatus('checkoutPending');
      return;
    }
    blurActiveElement();
    // `/billing/callback` no decide nada: pregunta por la suscripción hasta que
    // el webhook la ponga en `activa`. `replace` porque volver a este checkout
    // sólo re-ofrecería un pago que ya está en curso.
    router.replace('/billing/callback');
  };

  const handlePay = async () => {
    // The disabled button is UI courtesy; this guard covers programmatic
    // calls. The real guarantee is the future DB constraint that rejects a
    // contract without a current acceptance (docs/reparto-tyc-devs.md #11).
    if (payStatus === 'submitting' || !termsAccepted) return;
    // Ya hay una suscripción creada y un checkout devuelto: esto es "abrir de
    // nuevo", no "contratar de nuevo".
    if (checkoutUrl !== null) {
      await openCheckout(checkoutUrl);
      return;
    }
    setPayStatus('submitting');
    try {
      // Recorded before contracting so the server-side record exists when
      // the subscription insert hits the acceptance constraint. The body
      // only carries the marketing opt-in — IP/UA/version are server-side.
      await legalService.registerAcceptance({ marketing: marketingAccepted });
      const start = await billingService.startCheckout(plan.id);
      if (start.kind === 'simulated') {
        blurActiveElement();
        // replace, not push: a completed checkout has nothing left to do —
        // going back to it would only re-offer a payment already made.
        router.replace({ pathname: '/profile/plan/receipt', params: { subscriptionId: start.subscription.id } });
        return;
      }
      if (start.kind === 'activated') {
        blurActiveElement();
        // Plan gratuito: la suscripción ya está `activa`, así que no hay pago
        // que esperar. Va al callback y no al receipt porque el receipt vive
        // de una factura, y acá no hay ninguna: nadie cobró nada. El callback
        // lee `GET /suscripciones/vigente`, que ya responde `activa`.
        router.replace('/billing/callback');
        return;
      }
      // Se guarda antes de abrir: si abrir falla, la suscripción ya existe y
      // esta URL es la única forma de pagarla sin crear otra.
      setCheckoutUrl(start.checkoutUrl);
      await openCheckout(start.checkoutUrl);
    } catch {
      setPayStatus('error');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('billing.checkout.title', { nombre: plan.nombre }) }} />

      <Text style={styles.title} accessibilityRole="header">
        {t('billing.checkout.title', { nombre: plan.nombre })}
      </Text>
      <Text style={styles.description}>{t('billing.checkout.description')}</Text>

      <TaxBreakdownSummary
        breakdown={breakdown}
        moneda={plan.moneda}
        netoLabel={t('billing.checkout.breakdown.neto')}
        ivaLabel={t('billing.checkout.breakdown.iva')}
        otrosImpuestosLabel={t('billing.checkout.breakdown.otrosImpuestos')}
        totalLabel={t('billing.checkout.breakdown.total')}
      />

      <Text style={styles.sandboxNotice}>{t('billing.checkout.sandboxNotice')}</Text>

      <AcceptanceCheckboxes
        termsAccepted={termsAccepted}
        onChangeTerms={setTermsAccepted}
        marketingAccepted={marketingAccepted}
        onChangeMarketing={setMarketingAccepted}
        disabled={payStatus === 'submitting'}
      />

      {payStatus === 'checkoutPending' ? (
        <ErrorState
          title={t('billing.checkout.checkoutPending.title')}
          description={t('billing.checkout.checkoutPending.description')}
          retryLabel={t('billing.checkout.checkoutPending.action')}
          onRetry={handlePay}
        />
      ) : payStatus === 'error' ? (
        <ErrorState title={t('billing.checkout.error.title')} retryLabel={t('common.retry')} onRetry={handlePay} />
      ) : (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={handlePay}
          disabled={!termsAccepted}
          loading={payStatus === 'submitting'}
          loadingLabel={t('billing.checkout.paying')}
        >
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
