import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ConfirmationDialog } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { useCurrentSubscription } from '@/features/billing/hooks/useCurrentSubscription';
import i18n from '@/i18n';
import { lawyerService } from '@/services/lawyer.service';
import type { LawyerRequest, LawyerServiceOffer } from '@/types/lawyer';
import { blurActiveElement } from '@/utils/blur-active-element';
import { formatMinorAmount } from '@/utils/format-money';
import { canRequestLawyer } from '@/utils/subscription-access';

type RequestStatus = 'idle' | 'submitting' | 'error';

/**
 * "Necesito un abogado" — el escalamiento manual del spec de monetización §7.2.
 *
 * **Sólo botón manual, sin disparadores automáticos** (§7.1, decidido): el
 * usuario decide cuándo pedir ayuda profesional. No hay heurística de "esta
 * negociación escaló" ni la vamos a inventar.
 *
 * **Hoy no se puede contratar, y eso se muestra en vez de disimularse.** El
 * alcance del servicio de ARS 50.000 —qué incluye, en cuánto responden— lo
 * debe Solmi & Asociados (decisión #1 del spec), que lo marca como
 * *bloqueante para publicar*: "no se puede cobrar sin decir qué se entrega".
 * Así que mientras `offer.scope` sea null, el modal lo dice y el botón de
 * pagar queda deshabilitado. Es el mismo criterio que los `[COMPLETAR]`
 * visibles de los textos legales: el bloqueo se ve, no se tapa con copy de
 * relleno.
 *
 * El gate por estado de suscripción es UX, no seguridad: la validación real va
 * en el endpoint (§7.4). Ver `utils/subscription-access.ts`.
 */
export function LawyerRequestButton({
  casoId,
  onRequested,
}: {
  casoId: string;
  /** Avisa la solicitud recién creada, para que quien envuelva no refetchee. */
  onRequested?: (request: LawyerRequest) => void;
}) {
  const { t } = useTranslation();
  const { subscription, status: subscriptionStatus } = useCurrentSubscription();

  const [dialogVisible, setDialogVisible] = useState(false);
  const [offer, setOffer] = useState<LawyerServiceOffer | null>(null);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    lawyerService
      .getOffer()
      .then((result) => {
        if (!cancelled) setOffer(result);
      })
      .catch(() => {
        // Sin oferta no se puede contratar, y el modal ya sabe representarlo.
        if (!cancelled) setOffer(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const confirm = useCallback(async () => {
    setRequestStatus('submitting');
    try {
      const created = await lawyerService.requestLawyer(casoId);
      setRequestStatus('idle');
      setDialogVisible(false);
      blurActiveElement();
      onRequested?.(created);
    } catch {
      setRequestStatus('error');
    }
  }, [casoId, onRequested]);

  // Mientras carga la suscripción no se dibuja nada: un botón que aparece
  // habilitado y se apaga medio segundo después es peor que uno que llega
  // tarde.
  if (subscriptionStatus !== 'success') {
    return null;
  }

  const allowed = canRequestLawyer(subscription);
  // Sin alcance definido no hay nada que contratar todavía.
  const canPay = allowed && offer !== null && offer.scope !== null;

  const price = offer
    ? formatMinorAmount(offer.fee.amountMinor, offer.fee.currency, i18n.language)
    : '';

  return (
    <View style={styles.container}>
      <Button
        variant="secondary"
        fullWidth
        onPress={() => {
          setRequestStatus('idle');
          setDialogVisible(true);
        }}
        disabled={!allowed}
      >
        {t('lawyer.action')}
      </Button>
      {!allowed ? <Text style={styles.hint}>{t('lawyer.needsActivePlan')}</Text> : null}

      <ConfirmationDialog
        visible={dialogVisible}
        title={t('lawyer.dialog.title')}
        icon="shield-check"
        confirmLabel={t('lawyer.dialog.confirm')}
        confirmVariant="primary"
        onConfirm={confirm}
        cancelLabel={t('lawyer.dialog.cancel')}
        onCancel={() => {
          if (requestStatus === 'submitting') return;
          setDialogVisible(false);
        }}
        loading={requestStatus === 'submitting'}
        disabled={!canPay}
        errorTitle={requestStatus === 'error' ? t('lawyer.dialog.error.title') : undefined}
        retryLabel={t('common.retry')}
      >
        {/*
          Cada parte en su propio nodo de texto en vez de un bloque
          concatenado: se lee igual, pero el alcance, el precio y el plazo
          quedan como piezas separadas — que es lo que son, y lo que hace
          asertable que el alcance pendiente esté realmente ahí.
        */}
        {offer?.scope ? (
          offer.scope.map((line) => <Text key={line}>{`• ${line}\n`}</Text>)
        ) : (
          <Text>{`${t('lawyer.dialog.scopePending')}\n`}</Text>
        )}
        {offer ? <Text>{`\n${t('lawyer.dialog.price', { price })}`}</Text> : null}
        {offer?.responseHours ? (
          <Text>{`\n${t('lawyer.dialog.responseTime', { hours: offer.responseHours })}`}</Text>
        ) : null}
      </ConfirmationDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  hint: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
