import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { lawyerService } from '@/services/lawyer.service';
import { blurActiveElement } from '@/utils/blur-active-element';

import { useLawyerRequest } from '../hooks/useLawyerRequest';
import { LawyerHandoffCard } from './LawyerHandoffCard';
import { LawyerRequestButton } from './LawyerRequestButton';

/**
 * El espacio del abogado dentro del caso: o se contrata, o —si ya está
 * pagado— se coordina la consulta.
 *
 * Existe para que la decisión de cuál de las dos cosas mostrar viva en un solo
 * lugar y no adentro del botón, que no tiene por qué saber que existe un
 * handoff. `LawyerRequestButton` queda exactamente como estaba.
 */
export function LawyerSection({ casoId }: { casoId: string }) {
  const { t } = useTranslation();
  const { status, request, publish } = useLawyerRequest(casoId);
  const [simulateError, setSimulateError] = useState(false);

  const simulatePayment = useCallback(async () => {
    blurActiveElement();
    setSimulateError(false);
    try {
      publish(await lawyerService.simulatePaymentConfirmation(casoId));
    } catch {
      setSimulateError(true);
    }
  }, [casoId, publish]);

  // Mientras carga no se dibuja nada, por el mismo motivo que el botón no se
  // dibuja sin la suscripción resuelta: una tarjeta que aparece y se
  // reemplaza sola es peor que una que llega tarde.
  if (status !== 'success') {
    return null;
  }

  if (request?.estado === 'pagada') {
    return <LawyerHandoffCard request={request} />;
  }

  return (
    <View style={styles.container}>
      <LawyerRequestButton casoId={casoId} onRequested={publish} />

      {request?.estado === 'pendiente_pago' ? (
        /*
          Afordancia de demo, rotulada como tal — mismo criterio que
          `SimulateInvitationAcceptanceDialog` y que el bypass de
          `payment-required.tsx`. No hay checkout de Mercado Pago ni webhook
          (§7.4, de BE), así que sin esto la pantalla de handoff no es
          alcanzable. Se cae junto con el mock.
        */
        <View style={styles.demoSection}>
          <Text style={styles.demoText}>{t('lawyer.simulatePayment.hint')}</Text>
          <Button variant="tertiary" fullWidth onPress={simulatePayment}>
            {t('lawyer.simulatePayment.action')}
          </Button>
          {simulateError ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {t('lawyer.simulatePayment.error')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  demoSection: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  demoText: {
    ...typography.bodySm,
    color: semanticColors.text.tertiary,
    textAlign: 'center',
  },
  errorText: {
    ...typography.bodySm,
    color: semanticColors.status.errorFg,
  },
});
