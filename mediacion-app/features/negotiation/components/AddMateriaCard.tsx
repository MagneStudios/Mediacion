import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { negotiationService } from '../../../services/negotiation.service';
import type { MateriaAcuerdo } from '../../../types/negotiation';
import { blurActiveElement } from '../../../utils/blur-active-element';

export type AddMateriaCardProps = {
  caseId: string;
  /** Materias que el caso ya tiene abiertas — la legacy incluida, como `null`. */
  existingSubjectTypes: (MateriaAcuerdo | null)[];
  /** Relee la lista de negociaciones. */
  onAdded: () => void;
};

type Status = 'idle' | 'pending' | 'error';

const allMaterias: MateriaAcuerdo[] = ['tenencia', 'alimentos', 'bienes', 'otro'];

/**
 * RN de acuerdos modulares — *"el usuario tiene que poder abrir una
 * negociación nueva sobre otra materia dentro del mismo caso, sin arrancar un
 * caso nuevo"* (`docs/CAMBIOS-PACTUM-v2-2026-09-01.md`).
 *
 * Acción directa, sin diálogo: agregar una materia no es destructivo, mismo
 * criterio que los presets de `CaseDeadlineCard`. Un botón por cada materia
 * **todavía no usada**; si las cuatro están abiertas, no hay nada que ofrecer
 * y la tarjeta no se dibuja.
 *
 * Los dos `409` posibles (materia repetida, caso no negociable) no deberían
 * ocurrir nunca si el filtrado de acá y `canAddMateria` en el caso ya
 * decidieron mostrar esta tarjeta — así que si igual pasan (una carrera entre
 * dos pestañas) caen al error genérico con reintento, como el resto de la app
 * hace con un 409 que "no debería pasar".
 */
export function AddMateriaCard({ caseId, existingSubjectTypes, onAdded }: AddMateriaCardProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');

  const available = allMaterias.filter((materia) => !existingSubjectTypes.includes(materia));
  if (available.length === 0) return null;

  const add = async (materia: MateriaAcuerdo) => {
    if (status === 'pending') return;
    setStatus('pending');
    try {
      await negotiationService.createNegotiation(caseId, materia);
      blurActiveElement();
      setStatus('idle');
      onAdded();
    } catch {
      setStatus('error');
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {t('negotiation.addMateria.title')}
      </Text>

      <View style={styles.options}>
        {available.map((materia) => (
          <Button
            key={materia}
            variant="secondary"
            size="sm"
            onPress={() => void add(materia)}
            disabled={status === 'pending'}
          >
            {t(`subjectTypes.${materia}`)}
          </Button>
        ))}
      </View>

      {/* Se dice acá y no reemplaza la tarjeta: las opciones siguen a mano para reintentar. */}
      {status === 'error' ? <Text style={styles.error}>{t('negotiation.addMateria.error')}</Text> : null}
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
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: semanticColors.status.errorFg,
  },
});
