import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorState, Icon, LoadingState, ResponsiveColumns } from '../../design-system';
import { semanticColors } from '../../design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '../../design-system/tokens/layout';
import { radii } from '../../design-system/tokens/radii';
import { typography } from '../../design-system/tokens/typography';
import { spacing } from '../../design-system/tokens/spacing';
import { useResponsiveLayout } from '../../hooks/use-responsive-layout';
import { appendCaseActivity } from '../../services/activity.service';
import { casesService } from '../../services/cases.service';
import { appendCaseNotice } from '../../services/notices.service';
import type { CaseInvitation } from '../../types/case';
import { blurActiveElement } from '../../utils/blur-active-element';
import { getPositionEligibility } from '../../utils/position-eligibility';
import { AgreementSummaryCard } from '../agreements/components/AgreementSummaryCard';
import { MediatorSummaryCard } from '../mediator/components/MediatorSummaryCard';
import { NegotiationSummaryCard } from '../negotiation/components/NegotiationSummaryCard';
import { CaseDetailHeader } from './components/CaseDetailHeader';
import { InvitationResultCard } from './components/InvitationResultCard';
import { SimulateInvitationAcceptanceDialog } from './components/SimulateInvitationAcceptanceDialog';
import { useCaseDetail } from './hooks/useCaseDetail';

export type CaseDetailScreenProps = {
  caseId: string;
};

type MutationStatus = 'idle' | 'pending' | 'error';

export function CaseDetailScreen({ caseId }: CaseDetailScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, detail, reload } = useCaseDetail(caseId);
  const { horizontalPadding, isWide } = useResponsiveLayout();

  const [invitation, setInvitation] = useState<CaseInvitation | null>(null);
  const [invitationStatus, setInvitationStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const [simulateDialogVisible, setSimulateDialogVisible] = useState(false);
  const [simulateStatus, setSimulateStatus] = useState<MutationStatus>('idle');

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

  const openSimulateDialog = () => {
    setSimulateStatus('idle');
    setSimulateDialogVisible(true);
  };

  const handleConfirmSimulateAcceptance = async () => {
    if (simulateStatus === 'pending') return;
    setSimulateStatus('pending');
    try {
      await casesService.simulateInvitationAcceptance(caseId);
      setSimulateStatus('idle');
      setSimulateDialogVisible(false);
      reload();

      try {
        await appendCaseNotice({ caseId, eventKey: 'invitation_accepted_simulated' });
      } catch {
        // Best-effort mock side effect — never surfaced, never rolled back.
      }
      try {
        await appendCaseActivity({ caseId, eventKey: 'invitation_accepted' });
      } catch {
        // Best-effort mock side effect — never surfaced, never rolled back.
      }
    } catch {
      setSimulateStatus('error');
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

  const positionsSection = (() => {
    const eligibility = getPositionEligibility(detail.estado);
    const canCreate = eligibility === 'editable';
    return (
      <Card style={styles.positionsCard}>
        <View style={styles.positionsHeader}>
          <Text style={styles.positionsEyebrow} accessibilityRole="header">
            {t('caseDetail.positions.title')}
          </Text>
        </View>

        <View style={styles.privacyBanner}>
          <View style={styles.privacyIconWrap}>
            <Icon name="lock" size={20} color={semanticColors.ai.accent} />
          </View>
          <View style={styles.privacyTextCol}>
            <Text style={styles.privacyBody}>{t('caseDetail.positions.supportingCopy')}</Text>
          </View>
        </View>

        <View style={[styles.positionsActions, isWide && styles.positionsActionsRow]}>
          {canCreate ? (
            <Button
              variant="primary"
              fullWidth={!isWide}
              iconLeft={<Icon name="plus" size={16} color={semanticColors.action.primaryFg} />}
              onPress={() => {
                blurActiveElement();
                router.push({ pathname: '/case/[id]/positions/create', params: { id: caseId } });
              }}
            >
              {t('caseDetail.positions.createAction')}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            fullWidth={!isWide}
            onPress={() => {
              blurActiveElement();
              router.push({ pathname: '/case/[id]/positions', params: { id: caseId } });
            }}
          >
            {t('caseDetail.positions.viewAction')}
          </Button>
        </View>
      </Card>
    );
  })();

  const workspaceMaxWidth = isWide ? 1480 : contentWidths.wide;

  const contentStyle = getResponsiveContentStyle({ maxWidth: workspaceMaxWidth, horizontalPadding });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, contentStyle]}
    >
      <CaseDetailHeader detail={detail} isWide={isWide} />

      {isAwaitingCounterparty ? (
        <View style={styles.awaitingSection}>
          <Card style={styles.awaitingGuidanceCard}>
            <View style={styles.awaitingGuidanceHeader}>
              <View style={styles.awaitingGuidanceIconWrap}>
                <Icon name="info" size={22} color={semanticColors.ai.accent} />
              </View>
              <View style={styles.awaitingGuidanceTextCol}>
                <Text style={styles.awaitingGuidanceTitle}>{t('caseDetail.awaitingCounterparty.title')}</Text>
                <Text style={styles.bodyText}>{t('caseDetail.awaitingCounterparty.description')}</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.awaitingInvitationCard}>
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
              <Button variant="primary" fullWidth onPress={handleViewInvitation} disabled={invitationStatus === 'loading'}>
                {invitationStatus === 'loading'
                  ? t('common.loading')
                  : t('caseDetail.awaitingCounterparty.viewInvitation')}
              </Button>
            )}
          </Card>

          <View style={styles.awaitingDemoSection}>
            <View style={styles.awaitingDemoHeader}>
              <Icon name="sparkles" size={20} color={semanticColors.text.tertiary} />
            </View>
            <Text style={styles.bodyText}>{t('caseDetail.awaitingCounterparty.simulateAcceptance.description')}</Text>
            <Button variant="secondary" fullWidth onPress={openSimulateDialog} disabled={simulateStatus === 'pending'}>
              {simulateStatus === 'pending' ? t('common.loading') : t('caseDetail.awaitingCounterparty.simulateAcceptance.action')}
            </Button>
          </View>
        </View>
      ) : (
        <ResponsiveColumns
          collapseEmptySecondary
          primary={positionsSection}
          secondary={
            <>
              <NegotiationSummaryCard caseId={caseId} />
              <MediatorSummaryCard caseId={caseId} hideWhenUnavailable />
              {detail.estado === 'acordado' ? <AgreementSummaryCard caseId={caseId} /> : null}
            </>
          }
        />
      )}

      <SimulateInvitationAcceptanceDialog
        visible={simulateDialogVisible}
        status={simulateStatus === 'pending' ? 'submitting' : simulateStatus === 'error' ? 'error' : 'idle'}
        title={t('caseDetail.awaitingCounterparty.simulateAcceptance.dialog.title')}
        body={t('caseDetail.awaitingCounterparty.simulateAcceptance.dialog.body')}
        confirmLabel={t('caseDetail.awaitingCounterparty.simulateAcceptance.dialog.confirm')}
        cancelLabel={t('caseDetail.awaitingCounterparty.simulateAcceptance.dialog.cancel')}
        errorTitle={t('caseDetail.awaitingCounterparty.simulateAcceptance.error.title')}
        retryLabel={t('common.retry')}
        onConfirm={handleConfirmSimulateAcceptance}
        onCancel={() => {
          if (simulateStatus === 'pending') return;
          setSimulateDialogVisible(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    paddingVertical: spacing.xl,
    gap: spacing.xl,
  },
  module: {
    gap: spacing.sm,
  },
  moduleLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.quaternary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  positionsCard: {
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  positionsHeader: {
    gap: spacing.xxs,
  },
  positionsEyebrow: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: semanticColors.text.secondary,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: semanticColors.surface.supportAqua,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  privacyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: semanticColors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  privacyTextCol: {
    flex: 1,
    gap: 2,
  },
  privacyBody: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
  positionsActions: {
    gap: spacing.xs,
  },
  positionsActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  awaitingSection: {
    gap: spacing.md,
  },
  awaitingGuidanceCard: {
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: semanticColors.surface.supportAqua,
    borderLeftWidth: 4,
    borderLeftColor: semanticColors.ai.accent,
  },
  awaitingGuidanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  awaitingGuidanceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: semanticColors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  awaitingGuidanceTextCol: {
    flex: 1,
    gap: spacing.xxs,
  },
  awaitingGuidanceTitle: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  awaitingInvitationCard: {
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.md,
  },
  awaitingInvitationEyebrow: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: semanticColors.text.secondary,
  },
  awaitingDemoSection: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: semanticColors.border.soft,
    alignItems: 'center',
  },
  awaitingDemoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bodyText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
});
