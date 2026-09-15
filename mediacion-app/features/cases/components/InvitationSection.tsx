import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, ConfirmationDialog, ErrorState, LoadingState } from '../../../design-system';
import { radii } from '../../../design-system/tokens/radii';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { casesService } from '../../../services/cases.service';
import { blurActiveElement } from '../../../utils/blur-active-element';
import { isInvitacionNoReenviableError } from '../../../utils/is-invitacion-no-reenviable-error';
import type { CaseInvitation, EstadoCaso } from '../../../types/case';
import { InvitationResultCard } from './InvitationResultCard';

export type InvitationSectionProps = {
  caseId: string;
  estado: EstadoCaso;
};

type MutationStatus = 'idle' | 'pending' | 'error';
type MutationErrorKind = 'noReenviable' | 'generic';

/**
 * Tarjeta de invitación al caso, autónoma: posee su propio fetch
 * (`casesService.getInvitation`) y no recibe la invitación por props. Así se
 * puede renderizar tanto en el flujo `nuevo` como en `secondary` para el resto
 * de los estados en los que `canInviteCounterparty` da `true`, sin duplicar el
 * fetch en los dos call sites.
 *
 * Reenviar/regenerar están conectados a `POST .../reenviar` y `.../regenerar`
 * (`docs/pedidos-post-auditoria-14-09.md` §2.6, endpoints reales desde
 * `ed15e4e`). Solo se muestran cuando hay una invitación — `getInvitation` ya
 * filtra por `estado === 'pendiente'`, así que su sola presencia implica que
 * ambas acciones son válidas. Regenerar rota el token compartido, así que va
 * detrás de un diálogo de confirmación; reenviar no cambia nada visible y no
 * lo necesita.
 */
export function InvitationSection({ caseId, estado }: InvitationSectionProps) {
  const { t } = useTranslation();
  const [invitation, setInvitation] = useState<CaseInvitation | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const [resendStatus, setResendStatus] = useState<MutationStatus>('idle');
  const [resendErrorKind, setResendErrorKind] = useState<MutationErrorKind | null>(null);

  const [regenerateDialogVisible, setRegenerateDialogVisible] = useState(false);
  const [regenerateStatus, setRegenerateStatus] = useState<MutationStatus>('idle');
  const [regenerateErrorKind, setRegenerateErrorKind] = useState<MutationErrorKind | null>(null);

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

  const handleResend = async () => {
    if (!invitation || resendStatus === 'pending') return;
    setResendStatus('pending');
    setResendErrorKind(null);
    try {
      const refreshed = await casesService.resendInvitation(caseId, invitation.id);
      setInvitation(refreshed);
      setResendStatus('idle');
    } catch (error) {
      setResendStatus('error');
      setResendErrorKind(isInvitacionNoReenviableError(error) ? 'noReenviable' : 'generic');
    }
  };

  const openRegenerateDialog = () => {
    setRegenerateStatus('idle');
    setRegenerateErrorKind(null);
    setRegenerateDialogVisible(true);
  };

  const handleConfirmRegenerate = async () => {
    if (!invitation || regenerateStatus === 'pending') return;
    setRegenerateStatus('pending');
    try {
      const refreshed = await casesService.regenerateInvitation(caseId, invitation.id);
      setInvitation(refreshed);
      setRegenerateStatus('idle');
      setRegenerateDialogVisible(false);
      blurActiveElement();
    } catch (error) {
      setRegenerateStatus('error');
      setRegenerateErrorKind(isInvitacionNoReenviableError(error) ? 'noReenviable' : 'generic');
    }
  };

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

          <View style={styles.actions}>
            <Button
              variant="secondary"
              fullWidth
              onPress={handleResend}
              loading={resendStatus === 'pending'}
              loadingLabel={t('common.loading')}
            >
              {t('caseDetail.invitation.resend')}
            </Button>
            <Button variant="secondary" fullWidth onPress={openRegenerateDialog}>
              {t('caseDetail.invitation.regenerateCode')}
            </Button>
            {resendStatus === 'error' ? (
              <Text style={styles.errorText}>
                {resendErrorKind === 'noReenviable'
                  ? t('caseDetail.invitation.noLongerResendable')
                  : t('caseDetail.invitation.resendError')}
              </Text>
            ) : null}
          </View>
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

      <ConfirmationDialog
        visible={regenerateDialogVisible}
        title={t('caseDetail.invitation.regenerateDialog.title')}
        icon="refresh-cw"
        confirmLabel={t('caseDetail.invitation.regenerateDialog.confirm')}
        confirmVariant="primary"
        onConfirm={handleConfirmRegenerate}
        cancelLabel={t('caseDetail.invitation.regenerateDialog.cancel')}
        onCancel={() => {
          if (regenerateStatus === 'pending') return;
          setRegenerateDialogVisible(false);
        }}
        loading={regenerateStatus === 'pending'}
        errorTitle={
          regenerateStatus === 'error'
            ? regenerateErrorKind === 'noReenviable'
              ? t('caseDetail.invitation.noLongerResendable')
              : t('caseDetail.invitation.regenerateDialog.error')
            : undefined
        }
        retryLabel={regenerateStatus === 'error' ? t('common.retry') : undefined}
      >
        {t('caseDetail.invitation.regenerateDialog.body')}
      </ConfirmationDialog>
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
  errorText: {
    ...typography.bodySm,
    color: semanticColors.status.errorFg,
  },
});
