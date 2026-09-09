import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { AgreementSummaryCard } from '../../agreements/components/AgreementSummaryCard';
import { useNegotiations } from '../hooks/useNegotiations';
import { NegotiationMateriaCard } from './NegotiationMateriaCard';
import { NegotiationSummaryCard } from './NegotiationSummaryCard';

export type NegotiationsListSectionProps = {
  caseId: string;
  /** Relee el caso. Renegociar lo devuelve de `acordado` a `en_negociacion`. */
  onCaseChanged: () => void;
};

/**
 * Las negociaciones del caso, en lista — una por materia, como las devuelve
 * `GET /casos/:id/negociaciones`.
 *
 * **La tarjeta de resumen se dibuja una vez, arriba.** Es el estado del flujo
 * de propuestas, que sigue siendo **por caso**: las rutas de propuestas no
 * llevan `negotiationId` porque dijimos que no lo consumíamos. Dibujarla N
 * veces mostraría N copias del mismo dato.
 *
 * **El acuerdo se muestra porque existe, no porque el caso esté `acordado`.**
 * Ese gate vivía acá y ya no alcanza: `acordado` ahora se deriva al completarse
 * la última firma —llega al final del ciclo, no al principio— y con más de una
 * materia, firmar tenencia no dice nada de alimentos. Lo que sí lo dice es el
 * `acuerdo_vigente` de cada negociación, y con su id la tarjeta lee y navega
 * por acuerdo.
 *
 * Una lista vacía es un caso recién creado, no un error. Un error se dice
 * adentro de la sección, con reintento, sin que la sección desaparezca.
 */
export function NegotiationsListSection({ caseId, onCaseChanged }: NegotiationsListSectionProps) {
  const { t } = useTranslation();
  const result = useNegotiations(caseId);

  return (
    <>
      <NegotiationSummaryCard caseId={caseId} />

      {result.status === 'error' ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>{t('negotiation.list.error.title')}</Text>
          <Button variant="secondary" size="sm" onPress={result.reload}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : null}

      {result.status === 'success'
        ? result.items.map((negotiation) => (
            <Fragment key={negotiation.id}>
              <NegotiationMateriaCard negotiation={negotiation} onChanged={result.reload} onCaseChanged={onCaseChanged} />
              {negotiation.currentAgreement ? (
                <AgreementSummaryCard caseId={caseId} agreementId={negotiation.currentAgreement.id} />
              ) : null}
            </Fragment>
          ))
        : null}
    </>
  );
}

const styles = StyleSheet.create({
  errorCard: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
});
