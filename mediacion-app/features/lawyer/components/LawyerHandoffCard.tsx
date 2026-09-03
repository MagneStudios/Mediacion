import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { expoPublicEnv } from '@/config/env-source';
import { readEstudioWhatsapp } from '@/config/env';
import { Button, Card, Icon } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { InvitationResultCard } from '@/features/cases/components/InvitationResultCard';
import type { LawyerRequest } from '@/types/lawyer';
import { blurActiveElement } from '@/utils/blur-active-element';
import { buildHandoffUrl } from '@/utils/whatsapp-handoff';

type OpenStatus = 'idle' | 'unavailable';

/**
 * El handoff al estudio, después de que el pago se confirmó — spec §7.5 y
 * respuesta del cliente del 01/09 punto 2.
 *
 * **El usuario dispara la conversación, no nosotros.** Es el fallback v1 que
 * el spec ya tenía escrito y que el cliente eligió: un `wa.me` con el mensaje
 * precargado, sin WhatsApp Business API, sin Meta y sin Twilio. De paso abre
 * la ventana de 24 h del lado de Meta, que era el otro beneficio anotado.
 *
 * **En la URL va el código de la solicitud y nada más** (§7.5: nunca datos
 * sensibles de la negociación). El mensaje se arma en `utils/whatsapp-handoff.ts`,
 * que rechaza cualquier cosa que no sea un identificador corto.
 *
 * **Y el respaldo por mail no es de acá.** §7.5 pide que el estudio reciba
 * siempre un email con el mismo contenido, porque si el usuario no toca este
 * botón el mail es lo único que avisa que hay un caso pagado. Eso es de BE, y
 * con el handoff ahora manual importa más, no menos.
 */
export function LawyerHandoffCard({ request }: { request: LawyerRequest }) {
  const { t } = useTranslation();
  const [openStatus, setOpenStatus] = useState<OpenStatus>('idle');

  const codigo = request.handoff?.codigo ?? request.id;
  // El payload de BE gana sobre la config local: cuando el endpoint exista, el
  // número viaja con la solicitud y el env queda como respaldo de desarrollo.
  const phone = request.handoff?.estudioWhatsapp ?? readEstudioWhatsapp(expoPublicEnv);
  const message = t('lawyer.handoff.message', { code: codigo });
  const url = buildHandoffUrl({ phone, message, code: codigo });

  const open = useCallback(async () => {
    if (url === null) return;
    blurActiveElement();
    try {
      await Linking.openURL(url);
    } catch {
      // Sin WhatsApp instalado `openURL` rechaza. No es un error del que haya
      // que disculparse: se muestra el número para que la persona escriba por
      // donde pueda.
      setOpenStatus('unavailable');
    }
  }, [url]);

  return (
    <Card style={styles.card}>
      <View style={styles.iconWrap}>
        <Icon name="messages-square" size={22} color={semanticColors.ai.accent} />
      </View>

      <Text style={styles.title} accessibilityRole="header">
        {t('lawyer.handoff.title')}
      </Text>

      {url === null ? (
        /*
          Mismo criterio que el alcance pendiente del modal y que los
          `[COMPLETAR]` de los textos legales: el bloqueo se ve. Falta el
          número del estudio, que es un dato de Administración — mostrar un
          botón que no lleva a ningún lado sería peor que decirlo.
        */
        <Text style={styles.body}>{t('lawyer.handoff.numberPending', { code: codigo })}</Text>
      ) : (
        <>
          <Text style={styles.body}>{t('lawyer.handoff.body', { code: codigo })}</Text>
          <Button variant="primary" fullWidth onPress={open}>
            {t('lawyer.handoff.action')}
          </Button>

          {openStatus === 'unavailable' ? (
            <View style={styles.fallback} accessibilityLiveRegion="polite">
              <Text style={styles.body}>{t('lawyer.handoff.unavailable')}</Text>
              <InvitationResultCard
                label={t('lawyer.handoff.numberLabel')}
                value={phone ?? ''}
                copyLabel={t('lawyer.handoff.copy')}
                copiedLabel={t('lawyer.handoff.copied')}
              />
            </View>
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: semanticColors.surface.supportAqua,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: semanticColors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  body: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  fallback: {
    gap: spacing.xs,
  },
});
