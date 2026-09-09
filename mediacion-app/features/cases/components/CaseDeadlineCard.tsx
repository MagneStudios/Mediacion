import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { casesService } from '../../../services/cases.service';
import { blurActiveElement } from '../../../utils/blur-active-element';
import { deadlinePresetHours, toDeadlineIso } from '../../../utils/case-actions';

export type CaseDeadlineCardProps = {
  caseId: string;
  /** Horas restantes del plazo vigente, o `null` si no hay ninguno. */
  slaHours: number | null;
  /** Recarga el caso. El servidor no devuelve un caso completo — ver el servicio. */
  onChanged: () => void;
};

type Status = 'idle' | 'pending' | 'error';

/**
 * RN-10 — *"una parte puede fijar un plazo puntual (ej. respuesta para el día
 * siguiente)"*.
 *
 * **Ofrece duraciones y no una fecha de calendario.** El ejemplo del propio
 * requisito es una duración, el design system no tiene date picker, y un campo
 * de fecha a mano arrastra zonas horarias y formatos por locale para expresar
 * algo que la persona piensa como "mañana". Lo que viaja al servidor es un
 * instante ISO igual, así que el día que haya calendario se suma sin tocar el
 * contrato (`utils/case-actions.ts`).
 *
 * Hasta hoy el semáforo que dibuja el dashboard era decoración de sólo lectura:
 * la app leía `plazo` y `semaforo` y no tenía forma de escribirlos. Esta tarjeta
 * es lo que le da sentido.
 */
export function CaseDeadlineCard({ caseId, slaHours, onChanged }: CaseDeadlineCardProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');

  const choose = async (hours: (typeof deadlinePresetHours)[number]) => {
    if (status === 'pending') return;
    setStatus('pending');
    try {
      await casesService.setCaseDeadline(caseId, toDeadlineIso(hours));
      blurActiveElement();
      setStatus('idle');
      // Recargar en vez de aplicar la respuesta: el servidor contesta
      // `{ id, plazo, semaforo }`, y derivar `slaHours` de nuevo acá sería una
      // segunda fuente para el mismo número.
      onChanged();
    } catch {
      setStatus('error');
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {t('caseDetail.deadline.title')}
      </Text>

      <Text style={styles.body}>
        {slaHours === null
          ? t('caseDetail.deadline.none')
          : t('caseDetail.deadline.remaining', { hours: slaHours })}
      </Text>

      <Text style={styles.hint}>{t('caseDetail.deadline.description')}</Text>

      <View style={styles.presets}>
        {deadlinePresetHours.map((hours) => (
          <Button
            key={hours}
            variant="secondary"
            size="sm"
            onPress={() => void choose(hours)}
            disabled={status === 'pending'}
          >
            {t(`caseDetail.deadline.preset.${hours}`)}
          </Button>
        ))}
      </View>

      {/*
        El error se dice acá y no reemplaza la tarjeta: el plazo vigente sigue
        siendo información útil aunque el último intento de cambiarlo haya
        fallado, y los botones siguen a mano para reintentar.
      */}
      {status === 'error' ? <Text style={styles.error}>{t('caseDetail.deadline.error')}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.eyebrow,
    color: semanticColors.text.tertiary,
  },
  body: {
    ...typography.body,
    color: semanticColors.text.primary,
  },
  hint: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: semanticColors.status.errorFg,
  },
});
