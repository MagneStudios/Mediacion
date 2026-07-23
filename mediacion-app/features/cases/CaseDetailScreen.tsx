import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, ErrorState, Icon, LoadingState, StatusPill } from '../../design-system';
import { semanticColors } from '../../design-system/tokens/colors';
import { typography } from '../../design-system/tokens/typography';
import { spacing } from '../../design-system/tokens/spacing';
import { casesService } from '../../services/cases.service';
import type { CaseInvitation } from '../../types/case';
import { getPositionEligibility } from '../../utils/position-eligibility';
import { AgreementSummaryCard } from '../agreements/components/AgreementSummaryCard';
import { MediatorSummaryCard } from '../mediator/components/MediatorSummaryCard';
import { NegotiationSummaryCard } from '../negotiation/components/NegotiationSummaryCard';
import { InvitationResultCard } from './components/InvitationResultCard';
import { PrivacyNotice } from './components/PrivacyNotice';
import { useCaseDetail } from './hooks/useCaseDetail';

export type CaseDetailScreenProps = {
  caseId: string;
};

export function CaseDetailScreen({ caseId }: CaseDetailScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, detail, reload } = useCaseDetail(caseId);

  const [invitation, setInvitation] = useState<CaseInvitation | null>(null);
  const [invitationStatus, setInvitationStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const handleViewInvitation = async () => {
    setInvitationStatus('loading');
    try {
      const result = await casesService.getInvitation(caseId);
      setInvitation(result);
      setInvitationStatus('idle');
    } catch {
      setInvitationStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (status === 'error' || !detail) {
    return (
      <View style={styles.container}>
        <ErrorState
          title={t('states.error.title')}
          retryLabel={t('states.error.retry')}
          onRetry={reload}
        />
      </View>
    );
  }

  const isAwaitingCounterparty = detail.estado === 'nuevo';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{detail.title}</Text>
      <Text style={styles.subtitle}>{t('caseDetail.caseCode', { code: detail.caseCode })}</Text>

      <PrivacyNotice>{t('caseDetail.privacyNotice')}</PrivacyNotice>

      {isAwaitingCounterparty ? (
        <View style={styles.section}>
          <View style={styles.methodRow}>
            <Badge variant="neutral">{t(`methods.${detail.metodo}`)}</Badge>
            <StatusPill status="info">{t('cases.status.awaitingCounterparty')}</StatusPill>
          </View>
          <Text style={styles.sectionLabel}>{t('caseDetail.awaitingCounterparty.title')}</Text>
          <Text style={styles.bodyText}>{t('caseDetail.awaitingCounterparty.description')}</Text>

          {invitation ? (
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
            />
          ) : invitationStatus === 'error' ? (
            <ErrorState
              title={t('caseDetail.awaitingCounterparty.invitationError')}
              retryLabel={t('common.retry')}
              onRetry={handleViewInvitation}
            />
          ) : (
            <Button variant="secondary" onPress={handleViewInvitation} disabled={invitationStatus === 'loading'}>
              {invitationStatus === 'loading'
                ? t('common.loading')
                : t('caseDetail.awaitingCounterparty.viewInvitation')}
            </Button>
          )}
        </View>
      ) : (
        <>
          {(() => {
            const eligibility = getPositionEligibility(detail.estado);
            const canCreate = eligibility === 'editable';
            return (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('caseDetail.positions.title')}</Text>
                <PrivacyNotice>{t('caseDetail.positions.supportingCopy')}</PrivacyNotice>
                <View style={styles.positionsActions}>
                  {canCreate ? (
                    <Button
                      variant="primary"
                      fullWidth
                      iconLeft={<Icon name="plus" size={16} color={semanticColors.action.primaryFg} />}
                      onPress={() =>
                        router.push({ pathname: '/case/[id]/positions/create', params: { id: caseId } })
                      }
                    >
                      {t('caseDetail.positions.createAction')}
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    fullWidth
                    onPress={() => router.push({ pathname: '/case/[id]/positions', params: { id: caseId } })}
                  >
                    {t('caseDetail.positions.viewAction')}
                  </Button>
                </View>
              </View>
            );
          })()}

          <NegotiationSummaryCard caseId={caseId} />

          <MediatorSummaryCard caseId={caseId} hideWhenUnavailable />

          {detail.estado === 'acordado' ? <AgreementSummaryCard caseId={caseId} /> : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  positionsActions: {
    gap: spacing.xs,
  },
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 22,
    letterSpacing: -0.3,
    color: semanticColors.text.primary,
  },
  subtitle: {
    fontFamily: typography.mono.fontFamily,
    fontSize: 12,
    color: semanticColors.text.tertiary,
    marginTop: -spacing.xs,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.quaternary,
  },
  bodyText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
});
