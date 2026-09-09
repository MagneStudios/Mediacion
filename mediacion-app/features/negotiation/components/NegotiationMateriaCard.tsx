import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, ConfirmationDialog, StatusPill } from '../../../design-system';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { negotiationService } from '../../../services/negotiation.service';
import type { EstadoNegociacion, Negotiation } from '../../../types/negotiation';
import { blurActiveElement } from '../../../utils/blur-active-element';
import { isNegotiationNotAcordadaError } from '../../../utils/is-negotiation-not-acordada-error';

export type NegotiationMateriaCardProps = {
  negotiation: Negotiation;
  /** Relee la lista de negociaciones. Renegociar cambia estado, ronda y acuerdo vigente. */
  onChanged: () => void;
  /** Relee el caso: renegociar lo devuelve de `acordado` a `en_negociacion`. */
  onCaseChanged: () => void;
};

type RenegotiateStatus = 'idle' | 'pending' | 'error' | 'notAcordada';

const estadoVisual: Record<EstadoNegociacion, StatusPillStatus> = {
  borrador: 'neutral',
  activa: 'info',
  acordada: 'success',
  cerrada: 'neutral',
  terminada: 'warning',
};

/**
 * Una negociación del caso — una materia — como la devuelve
 * `GET /casos/:id/negociaciones`: materia, método, estado propio, ronda y
 * acuerdo vigente. **El estado que muestra es el de la negociación, no el del
 * caso**: con más de una materia, `casos.estado` ya no dice qué se puede hacer
 * con cada una.
 *
 * `subjectType: null` es "todavía no está dividido por materia" — el modelo
 * viejo — y se dice así. Nunca "Otro": esa es una materia real del enum.
 *
 * El botón de renegociar aparece sólo con un acuerdo vigente **firmado**,
 * que es exactamente el gate del servidor (`409 negociacion_not_acordada` en
 * cualquier otro caso, `con_aviso` incluido). Mismo criterio que
 * `utils/case-actions.ts`: no ofrecer lo que devolvería un 409 genérico.
 */
export function NegotiationMateriaCard({ negotiation, onChanged, onCaseChanged }: NegotiationMateriaCardProps) {
  const { t } = useTranslation();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [status, setStatus] = useState<RenegotiateStatus>('idle');

  const canRenegotiate = negotiation.currentAgreement?.estado === 'firmado';

  const confirmRenegotiate = async () => {
    if (status === 'pending') return;
    setStatus('pending');
    try {
      await negotiationService.renegotiate(negotiation.id);
      blurActiveElement();
      setStatus('idle');
      setDialogVisible(false);
      // Releer en vez de aplicar la respuesta: el servidor contesta sólo los
      // dos ids, y la ronda, el estado y el acuerdo nuevos salen de la lista.
      onChanged();
      onCaseChanged();
    } catch (error) {
      if (isNegotiationNotAcordadaError(error)) {
        // La materia ya no tiene un acuerdo firmado vigente — lo más
        // probable es que la otra parte haya renegociado primero. Reintentar
        // no lo arregla; ver la lista actualizada, sí.
        setStatus('notAcordada');
        setDialogVisible(false);
        onChanged();
        return;
      }
      setStatus('error');
    }
  };

  const subjectLabel =
    negotiation.subjectType === null ? t('negotiation.materia.none') : t(`subjectTypes.${negotiation.subjectType}`);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.subject} accessibilityRole="header">
          {subjectLabel}
        </Text>
        <StatusPill status={estadoVisual[negotiation.estado]}>{t(`negotiation.estado.${negotiation.estado}`)}</StatusPill>
      </View>

      <View style={styles.meta}>
        <Badge variant="neutral">{t(`methods.${negotiation.metodo}`)}</Badge>
        <Text style={styles.metaText}>{t('negotiation.round.label', { number: negotiation.roundNumber })}</Text>
        {negotiation.currentAgreement ? (
          <Text style={styles.metaText}>
            {t('negotiation.agreementVersion', { version: negotiation.currentAgreement.version })}
            {' · '}
            {t(`agreement.status.${negotiation.currentAgreement.estado}`)}
          </Text>
        ) : null}
      </View>

      {canRenegotiate ? (
        <Button
          variant="secondary"
          size="sm"
          onPress={() => {
            setStatus('idle');
            setDialogVisible(true);
          }}
        >
          {t('negotiation.renegotiate.action')}
        </Button>
      ) : null}

      {/*
        Se dice acá y no reemplaza la tarjeta: la materia sigue siendo
        información útil aunque el último intento haya fallado.
      */}
      {status === 'notAcordada' ? <Text style={styles.error}>{t('negotiation.renegotiate.error.notAcordada')}</Text> : null}

      <ConfirmationDialog
        visible={dialogVisible}
        title={t('negotiation.renegotiate.dialog.title')}
        icon="pencil"
        confirmLabel={t('negotiation.renegotiate.dialog.confirm')}
        confirmVariant="primary"
        onConfirm={() => void confirmRenegotiate()}
        cancelLabel={t('negotiation.renegotiate.dialog.cancel')}
        onCancel={() => {
          setDialogVisible(false);
          setStatus('idle');
        }}
        loading={status === 'pending'}
        errorTitle={status === 'error' ? t('negotiation.renegotiate.error.title') : undefined}
        retryLabel={status === 'error' ? t('common.retry') : undefined}
      >
        {t('negotiation.renegotiate.dialog.body')}
      </ConfirmationDialog>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  subject: {
    flex: 1,
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 17,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
    color: semanticColors.text.secondary,
  },
  error: {
    ...typography.caption,
    color: semanticColors.status.errorFg,
  },
});
