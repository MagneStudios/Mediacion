import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AIProcessingState, Button, ErrorState, Icon, LoadingState, ResponsiveColumns } from '@/design-system';
import { Text } from '@/design-system/components/Text';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { useCaseDetail } from '@/features/cases/hooks/useCaseDetail';
import { PrivacyNotice } from '@/features/cases/components/PrivacyNotice';
import { MediatorSummaryCard } from '@/features/mediator/components/MediatorSummaryCard';
import { CurrentRoundCard } from '@/features/negotiation/components/CurrentRoundCard';
import { ProposalOutcomeNotice } from '@/features/negotiation/components/ProposalOutcomeNotice';
import { ProposalResponseActions } from '@/features/negotiation/components/ProposalResponseActions';
import { ProposalResponseDialog } from '@/features/negotiation/components/ProposalResponseDialog';
import { SharedProposalCard } from '@/features/negotiation/components/SharedProposalCard';
import { WaitingForPartyState } from '@/features/negotiation/components/WaitingForPartyState';
import { useNegotiation } from '@/features/negotiation/hooks/useNegotiation';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { isProposalPending, type DecisionPropuesta } from '@/types/negotiation';
import { blurActiveElement } from '@/utils/blur-active-element';

export default function NegotiationDashboardScreen() {
  const { id: caseId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  // getNegotiationState() never rejects for an unknown case (it has no
  // "case not found" signal of its own — see negotiation.service.ts) — the
  // case's own existence is validated separately here via the same
  // accessor every other route uses, so a direct/unknown-id entry gets the
  // same explicit not-found presentation as every sibling route instead of
  // a silent, near-blank read_only render.
  const { status: caseStatus, detail: caseDetail } = useCaseDetail(caseId);
  const { horizontalPadding, isWide } = useResponsiveLayout();
  const {
    status,
    state,
    reload,
    startRoundStatus,
    startNextRound,
    generateStatus,
    generateProposal,
    respondStatus,
    submitResponse,
    resetRespondStatus,
  } = useNegotiation(caseId);

  const [pendingResponse, setPendingResponse] = useState<{
    caseId: string;
    proposalId: string;
    decision: DecisionPropuesta;
  } | null>(null);

  useEffect(() => {
    if (!pendingResponse) return;
    const responseStillCurrent =
      pendingResponse.caseId === caseId &&
      pendingResponse.proposalId === state?.currentProposal?.id &&
      state.currentProposal.estado === 'pendiente' &&
      !state.ownResponse;
    if (!responseStillCurrent) {
      setPendingResponse(null);
      resetRespondStatus();
    }
  }, [caseId, pendingResponse, resetRespondStatus, state]);

  if (caseStatus === 'loading' || status === 'loading') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('negotiation.dashboard.title') }} />
        <LoadingState label={t('common.loading')} />
      </View>
    );
  }

  if (caseStatus === 'error' || !caseDetail) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('negotiation.dashboard.title') }} />
        <ErrorState
          title={t('negotiation.notFound.title')}
          description={t('negotiation.notFound.description')}
          retryLabel={t('common.back')}
          onRetry={() => {
            blurActiveElement();
            router.back();
          }}
        />
      </View>
    );
  }

  if (status === 'error' || !state) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('negotiation.dashboard.title') }} />
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reload} />
      </View>
    );
  }

  const { eligibility, currentRound, currentProposal, ownResponse, waitingForOtherParty, bothAccepted, roundResolved } = state;

  const canRespond =
    eligibility === 'in_progress' &&
    currentProposal?.estado === 'pendiente' &&
    !isProposalPending(currentProposal) &&
    !ownResponse;
  const canStartRound = eligibility === 'ready' && (!currentRound || currentRound.estado === 'completada');
  const canGenerate = eligibility === 'ready' && currentRound?.estado === 'activa' && !currentRound.proposalId;

  const openConfirm = (decision: DecisionPropuesta) => {
    if (!currentProposal || !canRespond) return;
    resetRespondStatus();
    setPendingResponse({ caseId, proposalId: currentProposal.id, decision });
  };

  const handleConfirmResponse = async () => {
    if (
      !pendingResponse ||
      pendingResponse.caseId !== caseId ||
      pendingResponse.proposalId !== currentProposal?.id ||
      !canRespond
    ) {
      setPendingResponse(null);
      resetRespondStatus();
      return;
    }
    await submitResponse(pendingResponse.proposalId, pendingResponse.decision);
  };

  const proposalStatusLabel =
    currentProposal?.estado === 'pendiente'
      ? t('negotiation.proposal.statusPending')
      : currentProposal?.estado === 'aceptada'
        ? t('negotiation.proposal.statusAccepted')
        : t('negotiation.proposal.statusRejected');
  const proposalStatusVisual =
    currentProposal?.estado === 'pendiente' ? 'ai' : currentProposal?.estado === 'aceptada' ? 'success' : 'warning';

  const primaryColumn = (
    <>
      {currentRound ? (
        <CurrentRoundCard
          roundLabel={t('negotiation.round.label', { number: currentRound.number })}
          statusLabel={currentRound.estado === 'activa' ? t('negotiation.round.statusActive') : t('negotiation.round.statusCompleted')}
          statusVisual={currentRound.estado === 'activa' ? 'info' : 'neutral'}
        />
      ) : null}

      {eligibility === 'waiting_counterparty' ? (
        <WaitingForPartyState
          title={t('negotiation.summary.waitingCounterparty.title')}
          description={t('negotiation.summary.waitingCounterparty.description')}
        />
      ) : null}
      {eligibility === 'positions_incomplete' ? (
        <WaitingForPartyState
          title={t('negotiation.summary.positionsIncomplete.title')}
          description={t('negotiation.summary.positionsIncomplete.description')}
        />
      ) : null}
      {eligibility === 'waiting_other_party' ? (
        <WaitingForPartyState
          title={t('negotiation.summary.waitingOtherParty.title')}
          description={t('negotiation.summary.waitingOtherParty.description')}
        />
      ) : null}

      {generateStatus === 'pending' ? (
        <AIProcessingState
          badgeLabel={t('negotiation.generate.badge')}
          statusLabel={t('negotiation.generate.generatingTitle')}
          description={t('negotiation.generate.generatingBody')}
        />
      ) : null}

      {currentProposal ? (
        <SharedProposalCard
          title={t('negotiation.proposal.title', {
            round: currentProposal.roundNumber,
          })}
          intro={t('negotiation.proposal.intro')}
          meetingPointSectionTitle={t('negotiation.proposal.meetingPointSectionTitle')}
          meetingPoint={currentProposal.meetingPoint}
          narrative={currentProposal.narrative}
          pendingLabel={t('negotiation.proposal.generating')}
          emptyMeetingPointLabel={t('negotiation.proposal.emptyMeetingPoint')}
          renderEntryLabels={(entry) => ({
            // Categories are shared with the positions feature, so their copy
            // lives there. An unknown key falls back to the raw value rather
            // than rendering an i18n path at the user.
            categoryLabel: t(`positions.category.${entry.categoria}.label`, {
              defaultValue: entry.categoria,
            }),
            valueLabel:
              entry.punto === null
                ? t('negotiation.proposal.valueNotNumeric')
                : t('negotiation.proposal.valueNumeric', { value: entry.punto }),
            estadoLabel:
              entry.estado === 'acordable'
                ? t('negotiation.proposal.estadoAcordable')
                : t('negotiation.proposal.estadoNegociable'),
          })}
          rationale={currentProposal.rationale}
          rationaleLabel={t('negotiation.proposal.rationaleTitle')}
          statusLabel={proposalStatusLabel}
          statusVisual={proposalStatusVisual}
        />
      ) : null}

      {canRespond ? (
        <ProposalResponseActions
          acceptLabel={t('negotiation.response.accept')}
          rejectLabel={t('negotiation.response.reject')}
          onAccept={() => openConfirm('acepta')}
          onReject={() => openConfirm('rechaza')}
        />
      ) : null}

      {waitingForOtherParty ? (
        <WaitingForPartyState
          title={t('negotiation.response.waitingOtherTitle')}
          description={t('negotiation.response.waitingOther')}
        />
      ) : null}

      {eligibility === 'read_only' && !bothAccepted && !roundResolved ? (
        <WaitingForPartyState
          title={t('negotiation.summary.readOnly.title')}
          description={t('negotiation.summary.readOnly.description')}
        />
      ) : null}

      {roundResolved && !bothAccepted && currentProposal?.estado === 'rechazada' ? (
        <ProposalOutcomeNotice
          tone="neutral"
          title={t('negotiation.summary.completedNoAgreement.title')}
          description={t('negotiation.resolution.notAcceptedBody')}
        />
      ) : null}

      {bothAccepted ? (
        <ProposalOutcomeNotice
          tone="success"
          title={t('negotiation.summary.agreementReached.title')}
          description={t('negotiation.resolution.agreementBody')}
          action={
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => {
                blurActiveElement();
                router.push({ pathname: '/case/[id]/agreement', params: { id: caseId } });
              }}
            >
              {t('negotiation.resolution.reviewAgreementAction')}
            </Button>
          }
        />
      ) : null}

      {canStartRound ? (
        startRoundStatus === 'error' ? (
          <ErrorState title={t('negotiation.startRound.error.title')} retryLabel={t('common.retry')} onRetry={startNextRound} />
        ) : (
          <Button variant="primary" size="lg" fullWidth onPress={startNextRound} loading={startRoundStatus === 'pending'} loadingLabel={t('common.loading')}>
            {t('negotiation.startRound.action')}
          </Button>
        )
      ) : null}

      {canGenerate && generateStatus !== 'pending' ? (
        generateStatus === 'error' ? (
          <ErrorState title={t('negotiation.generate.error.title')} retryLabel={t('common.retry')} onRetry={generateProposal} />
        ) : (
          <View style={styles.actionGroup}>
            <Button
              variant="ai"
              size="lg"
              fullWidth
              iconLeft={<Icon name="sparkles" size={16} color={semanticColors.action.aiFg} />}
              onPress={generateProposal}
            >
              {t('negotiation.generate.action')}
            </Button>
            <PrivacyNotice>{t('negotiation.generate.privacyNote')}</PrivacyNotice>
          </View>
        )
      ) : null}
    </>
  );

  const secondaryColumn = (
    <>
      <PrivacyNotice>{t('negotiation.dashboard.privacyNotice')}</PrivacyNotice>

      <MediatorSummaryCard caseId={caseId} />

      <Button
        variant="tertiary"
        size="lg"
        fullWidth
        onPress={() => {
          blurActiveElement();
          router.push({ pathname: '/case/[id]/negotiation/history', params: { id: caseId } });
        }}
      >
        {t('negotiation.history.viewAction')}
      </Button>
    </>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.wide, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('negotiation.dashboard.title') }} />

      <Text variant={isWide ? 'displayLg' : 'headline'} accessibilityRole="header">
        {t('negotiation.dashboard.title')}
      </Text>

      <ResponsiveColumns primary={primaryColumn} secondary={secondaryColumn} />

      <ProposalResponseDialog
        visible={pendingResponse != null}
        status={respondStatus === 'pending' ? 'submitting' : respondStatus === 'error' ? 'error' : 'idle'}
        title={pendingResponse?.decision === 'acepta' ? t('negotiation.response.dialogs.accept.title') : t('negotiation.response.dialogs.reject.title')}
        body={pendingResponse?.decision === 'acepta' ? t('negotiation.response.dialogs.accept.body') : t('negotiation.response.dialogs.reject.body')}
        confirmLabel={
          pendingResponse?.decision === 'acepta' ? t('negotiation.response.dialogs.confirmAccept') : t('negotiation.response.dialogs.confirmReject')
        }
        confirmVariant={pendingResponse?.decision === 'acepta' ? 'primary' : 'secondary'}
        cancelLabel={t('negotiation.response.dialogs.cancel')}
        errorTitle={t('negotiation.response.error.title')}
        retryLabel={t('common.retry')}
        onConfirm={handleConfirmResponse}
        onCancel={() => {
          if (respondStatus === 'pending') return;
          setPendingResponse(null);
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  actionGroup: {
    gap: spacing.sm,
  },
});
