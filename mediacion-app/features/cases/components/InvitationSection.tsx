import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, ErrorState, LoadingState } from '../../../design-system';
import { radii } from '../../../design-system/tokens/radii';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { casesService } from '../../../services/cases.service';
import type { CaseInvitation, EstadoCaso } from '../../../types/case';
import { InvitationResultCard } from './InvitationResultCard';

export type InvitationSectionProps = {
  caseId: string;
  estado: EstadoCaso;
};

/**
 * Tarjeta de invitación al caso, autónoma: posee su propio fetch
 * (`casesService.getInvitation`) y no recibe la invitación por props. Así se
 * puede renderizar tanto en el flujo `nuevo` como en `secondary` para el resto
 * de los estados en los que `canInviteCounterparty` da `true`, sin duplicar el
 * fetch en los dos call sites.
 *
 * Los botones de reenviar/regenerar son `disabled` con un `disabledReason`
 * fijo —el backend todavía no expone esos endpoints
 * (`docs/pedidos-post-auditoria-14-09.md` §2.6). Es el punto de extensión
 * documentado: cuando existan, se cablean a `casesService` sin tocar esta vista.
 */
export function InvitationSection({ caseId, estado }: InvitationSectionProps) {
  const { t } = useTranslation();
  const [invitation, setInvitation] = useState<CaseInvitation | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await casesService.getInvitation(caseId);
      setInvitation(result);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const disabledReason = t('caseDetail.invitation.disabledReason');

  return (
    <Card style={styles.card}>
      {status === 'error' ? (
        <ErrorState
          title={t('caseDetail.awaitingCounterparty.invitationError')}
          retryLabel={t('common.retry')}
          onRetry={load}
        />
      ) : invitation ? (
        <>
          <Badge variant={invitation.estado === 'aceptada' ? 'solid' : 'neutral'}>
            {t(`caseDetail.awaitingCounterparty.invitationStatus.${invitation.estado}`)}
          </Badge>
          <InvitationResultCard
            label={
              invitation.tipo === 'link'
                ? t('caseCreation.invite.linkLabel')
                : invitation.tipo === 'codigo'
                  ? t('caseCreation.invite.codeLabel')
                  : t('caseCreation.invite.emailLabel')
            }
            value={invitation.token ?? invitation.emailDestino ?? ''}
            monospace={invitation.tipo === 'codigo'}
            copyLabel={invitation.tipo !== 'email' ? t(`caseCreation.invite.copy.${invitation.tipo}`) : undefined}
            copiedLabel={t('caseCreation.invite.copied')}
            shareLabel={invitation.tipo !== 'email' ? t(`caseCreation.invite.share.${invitation.tipo}`) : undefined}
          />
        </>
      ) : status === 'loading' ? (
        <LoadingState label={t('common.loading')} />
      ) : estado === 'nuevo' ? (
        <Button variant="primary" fullWidth onPress={load}>
          {t('caseDetail.awaitingCounterparty.viewInvitation')}
        </Button>
      ) : (
        <Text style={styles.emptyText}>{t('caseDetail.invitation.noPending')}</Text>
      )}

      <View style={styles.actions}>
        <Button variant="secondary" fullWidth disabled>
          {t('caseDetail.invitation.resend')}
        </Button>
        <Button variant="secondary" fullWidth disabled>
          {t('caseDetail.invitation.regenerateCode')}
        </Button>
        <Text style={styles.disabledReason}>{disabledReason}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
  actions: {
    gap: spacing.xs,
  },
  disabledReason: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
