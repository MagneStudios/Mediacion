import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AIProcessingState, Button, ErrorState, Icon, LoadingState, ResponsiveColumns } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { useCaseDetail } from '@/features/cases/hooks/useCaseDetail';
import { PrivacyNotice } from '@/features/cases/components/PrivacyNotice';
import { MediatorSummaryCard } from '@/features/mediator/components/MediatorSummaryCard';
import { CurrentRoundCard } from '@/features/negotiation/components/CurrentRoundCard';
import { ProposalResponseActions } from '@/features/negotiation/components/ProposalResponseActions';
import { ProposalResponseDialog } from '@/features/negotiation/components/ProposalResponseDialog';
import { SharedProposalCard } from '@/features/negotiation/components/SharedProposalCard';
import { WaitingForPartyState } from '@/features/negotiation/components/WaitingForPartyState';
import { useNegotiation } from '@/features/negotiation/hooks/useNegotiation';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import type { DecisionPropuesta } from '@/types/negotiation';
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
  const { horizontalPadding } = useResponsiveLayout();
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

  const [pendingDecision, setPendingDecision] = useState<DecisionPropuesta | null>(null);

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

  const canRespond = eligibility === 'in_progress' && currentProposal?.estado === 'pendiente' && !ownResponse;
  const canStartRound = eligibility === 'ready' && (!currentRound || currentRound.estado === 'completada');
  const canGenerate = eligibility === 'ready' && currentRound?.estado === 'activa' && !currentRound.proposalId;

  const openConfirm = (decision: DecisionPropuesta) => {
    resetRespondStatus();
    setPendingDecision(decision);
  };

  const handleConfirmResponse = async () => {
    if (!pendingDecision || !currentProposal) return;
    await submitResponse(currentProposal.id, pendingDecision);
    setPendingDecision(null);
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
        <Text style={styles.bodyText}>{t('negotiation.summary.waitingCounterparty.description')}</Text>
      ) : null}
      {eligibility === 'positions_incomplete' ? (
        <Text style={styles.bodyText}>{t('negotiation.summary.positionsIncomplete.description')}</Text>
      ) : null}
      {eligibility === 'waiting_other_party' ? (
        <Text style={styles.bodyText}>{t('negotiation.summary.waitingOtherParty.description')}</Text>
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
          title={currentProposal.title}
          summary={currentProposal.summary}
          terms={currentProposal.terms}
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

      {roundResolved && !bothAccepted && currentProposal?.estado === 'rechazada' ? (
        <Text style={styles.bodyText}>{t('negotiation.resolution.notAcceptedBody')}</Text>
      ) : null}

      {bothAccepted ? (
        <View style={styles.section}>
          <Text style={styles.bodyText}>{t('negotiation.resolution.agreementBody')}</Text>
          <Button
            variant="primary"
            fullWidth
            onPress={() => {
              blurActiveElement();
              router.push({ pathname: '/case/[id]/agreement', params: { id: caseId } });
            }}
          >
            {t('negotiation.resolution.reviewAgreementAction')}
          </Button>
        </View>
      ) : null}

      {canStartRound ? (
        startRoundStatus === 'error' ? (
          <ErrorState title={t('negotiation.startRound.error.title')} retryLabel={t('common.retry')} onRetry={startNextRound} />
        ) : (
          <Button variant="primary" fullWidth onPress={startNextRound} disabled={startRoundStatus === 'pending'}>
            {startRoundStatus === 'pending' ? t('common.loading') : t('negotiation.startRound.action')}
          </Button>
        )
      ) : null}

      {canGenerate && generateStatus !== 'pending' ? (
        generateStatus === 'error' ? (
          <ErrorState title={t('negotiation.generate.error.title')} retryLabel={t('common.retry')} onRetry={generateProposal} />
        ) : (
          <>
            <Button
              variant="ai"
              fullWidth
              iconLeft={<Icon name="sparkles" size={16} color={semanticColors.action.aiFg} />}
              onPress={generateProposal}
            >
              {t('negotiation.generate.action')}
            </Button>
            <PrivacyNotice>{t('negotiation.generate.privacyNote')}</PrivacyNotice>
          </>
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

      <Text style={styles.title} accessibilityRole="header">
        {t('negotiation.dashboard.title')}
      </Text>

      <ResponsiveColumns primary={primaryColumn} secondary={secondaryColumn} />

      <ProposalResponseDialog
        visible={pendingDecision != null}
        status={respondStatus === 'pending' ? 'submitting' : respondStatus === 'error' ? 'error' : 'idle'}
        title={pendingDecision === 'acepta' ? t('negotiation.response.dialogs.accept.title') : t('negotiation.response.dialogs.reject.title')}
        body={pendingDecision === 'acepta' ? t('negotiation.response.dialogs.accept.body') : t('negotiation.response.dialogs.reject.body')}
        confirmLabel={
          pendingDecision === 'acepta' ? t('negotiation.response.dialogs.confirmAccept') : t('negotiation.response.dialogs.confirmReject')
        }
        confirmVariant={pendingDecision === 'acepta' ? 'primary' : 'secondary'}
        cancelLabel={t('negotiation.response.dialogs.cancel')}
        errorTitle={t('negotiation.response.error.title')}
        retryLabel={t('common.retry')}
        onConfirm={handleConfirmResponse}
        onCancel={() => {
          if (respondStatus === 'pending') return;
          setPendingDecision(null);
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
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 24,
    letterSpacing: -0.4,
    color: semanticColors.text.primary,
  },
  section: {
    gap: spacing.xs,
  },
  bodyText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
});
