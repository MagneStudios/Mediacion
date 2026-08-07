import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';
import type { NegotiationState } from '../../../types/negotiation';
import { blurActiveElement } from '../../../utils/blur-active-element';
import { useNegotiation } from '../hooks/useNegotiation';

export type NegotiationSummaryCardProps = {
  caseId: string;
};

function summaryFor(state: NegotiationState): { titleKey: string; descriptionKey: string; status: StatusPillStatus; statusKey: string } {
  if (state.eligibility === 'positions_incomplete') {
    return { titleKey: 'negotiation.summary.positionsIncomplete.title', descriptionKey: 'negotiation.summary.positionsIncomplete.description', status: 'neutral', statusKey: 'negotiation.summary.positionsIncomplete.status' };
  }
  if (state.eligibility === 'waiting_other_party') {
    return { titleKey: 'negotiation.summary.waitingOtherParty.title', descriptionKey: 'negotiation.summary.waitingOtherParty.description', status: 'neutral', statusKey: 'negotiation.summary.waitingOtherParty.status' };
  }
  if (state.eligibility === 'read_only') {
    if (state.bothAccepted) {
      return { titleKey: 'negotiation.summary.agreementReached.title', descriptionKey: 'negotiation.summary.agreementReached.description', status: 'success', statusKey: 'negotiation.summary.agreementReached.status' };
    }
    return { titleKey: 'negotiation.summary.readOnly.title', descriptionKey: 'negotiation.summary.readOnly.description', status: 'neutral', statusKey: 'negotiation.summary.readOnly.status' };
  }
  if (state.eligibility === 'in_progress') {
    if (state.waitingForOtherParty) {
      return { titleKey: 'negotiation.summary.inProgressWaiting.title', descriptionKey: 'negotiation.summary.inProgressWaiting.description', status: 'info', statusKey: 'negotiation.summary.inProgressWaiting.status' };
    }
    return { titleKey: 'negotiation.summary.inProgressPending.title', descriptionKey: 'negotiation.summary.inProgressPending.description', status: 'ai', statusKey: 'negotiation.summary.inProgressPending.status' };
  }
  if (state.roundResolved && !state.bothAccepted) {
    return { titleKey: 'negotiation.summary.completedNoAgreement.title', descriptionKey: 'negotiation.summary.completedNoAgreement.description', status: 'warning', statusKey: 'negotiation.summary.completedNoAgreement.status' };
  }
  // 'ready' and 'waiting_counterparty' (the latter shouldn't normally reach
  // here — CaseDetailScreen already branches away for a 'nuevo' case before
  // rendering this component — but it's handled defensively all the same).
  if (state.eligibility === 'waiting_counterparty') {
    return { titleKey: 'negotiation.summary.waitingCounterparty.title', descriptionKey: 'negotiation.summary.waitingCounterparty.description', status: 'neutral', statusKey: 'negotiation.summary.waitingCounterparty.status' };
  }
  return { titleKey: 'negotiation.summary.ready.title', descriptionKey: 'negotiation.summary.ready.description', status: 'neutral', statusKey: 'negotiation.summary.ready.status' };
}

/** Compact, self-fetching negotiation summary embedded in CaseDetailScreen — replaces the old embedded AI demo entirely. */
export function NegotiationSummaryCard({ caseId }: NegotiationSummaryCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, state, reload } = useNegotiation(caseId);

  const summary = status === 'success' && state ? summaryFor(state) : null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {t('negotiation.sectionTitle')}
      </Text>
      <Card style={styles.card}>
        {status === 'loading' ? (
          <Text style={styles.description}>{t('common.loading')}</Text>
        ) : status === 'error' || !state ? (
          <>
            <Text style={styles.description}>{t('negotiation.summary.error.title')}</Text>
            <Button variant="secondary" size="sm" onPress={reload}>
              {t('common.retry')}
            </Button>
          </>
        ) : summary ? (
          <>
            <View style={styles.row}>
              <Text style={styles.title}>{t(summary.titleKey)}</Text>
              <StatusPill status={summary.status}>{t(summary.statusKey)}</StatusPill>
            </View>
            <Text style={styles.description}>{t(summary.descriptionKey)}</Text>
          </>
        ) : null}

        <Button
          variant="secondary"
          fullWidth
          onPress={() => {
            blurActiveElement();
            router.push({ pathname: '/case/[id]/negotiation', params: { id: caseId } });
          }}
        >
          {t('negotiation.summary.viewAction')}
        </Button>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.quaternary,
  },
  card: {
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 18,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
});
