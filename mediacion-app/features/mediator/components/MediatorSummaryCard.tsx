import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Icon, StatusPill } from '../../../design-system';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { MediatorState } from '../../../types/mediator';
import { blurActiveElement } from '../../../utils/blur-active-element';
import { useMediator } from '../hooks/useMediator';

export type MediatorSummaryCardProps = {
  caseId: string;
  /**
   * CaseDetailScreen hides this card entirely before round 3 with no
   * mediation on record at all, to avoid cluttering early cases. The
   * negotiation screen (the default, false) always shows an informational
   * "not yet available" state instead — this is the one place phase 8's
   * eligibility explanation is guaranteed visible.
   */
  hideWhenUnavailable?: boolean;
};

function summaryFor(state: MediatorState): { titleKey: string; descriptionKey: string; status: StatusPillStatus; statusKey: string } {
  switch (state.eligibility) {
    case 'unavailable_before_round_3':
      return {
        titleKey: 'mediator.summary.unavailableBeforeRound3.title',
        descriptionKey: 'mediator.summary.unavailableBeforeRound3.description',
        status: 'neutral',
        statusKey: 'mediator.summary.unavailableBeforeRound3.status',
      };
    case 'available':
      return {
        titleKey: 'mediator.summary.available.title',
        descriptionKey: 'mediator.summary.available.description',
        status: 'neutral',
        statusKey: 'mediator.summary.available.status',
      };
    case 'pending':
      return {
        titleKey: 'mediator.summary.pending.title',
        descriptionKey: 'mediator.summary.pending.description',
        status: 'info',
        statusKey: 'mediator.summary.pending.status',
      };
    case 'assigned':
      return {
        titleKey: 'mediator.summary.assigned.title',
        descriptionKey: 'mediator.summary.assigned.description',
        status: 'success',
        statusKey: 'mediator.summary.assigned.status',
      };
    case 'unavailable':
      return {
        titleKey: 'mediator.summary.unavailable.title',
        descriptionKey: 'mediator.summary.unavailable.description',
        status: 'neutral',
        statusKey: 'mediator.summary.unavailable.status',
      };
    case 'read_only':
    default:
      return {
        titleKey: 'mediator.summary.readOnly.title',
        descriptionKey: 'mediator.summary.readOnly.description',
        status: 'neutral',
        statusKey: 'mediator.summary.readOnly.status',
      };
  }
}

/**
 * Compact, self-fetching mediator-accompaniment summary — reused in both
 * the negotiation screen and CaseDetailScreen. Never performs the request
 * mutation itself; every button only navigates to the dedicated
 * /case/[id]/mediator screen, where the explanation, eligibility, and
 * confirmation dialog actually live. Mirrors NegotiationSummaryCard /
 * AgreementSummaryCard's shape exactly.
 */
export function MediatorSummaryCard({ caseId, hideWhenUnavailable = false }: MediatorSummaryCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, state, reload } = useMediator(caseId);

  // No mediation ever existed for this case and there's nothing actionable
  // or historical to show — 'unavailable_before_round_3' (round hasn't
  // reached 3 yet) and 'read_only' with no mediation record (e.g. an
  // already-agreed case that never had a mediator involved) both mean
  // "nothing to show here." CaseDetailScreen hides the card in that case;
  // the negotiation screen (hideWhenUnavailable=false) still shows the
  // "not yet available" informational state.
  const nothingToShow =
    !state?.mediation && (state?.eligibility === 'unavailable_before_round_3' || state?.eligibility === 'read_only');
  if (status === 'success' && state && nothingToShow && hideWhenUnavailable) {
    return null;
  }

  const goToMediator = () => {
    blurActiveElement();
    router.push({ pathname: '/case/[id]/mediator', params: { id: caseId } });
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {t('mediator.sectionTitle')}
      </Text>

      <Card style={styles.card}>
        {status === 'loading' ? (
          <Text style={styles.description}>{t('common.loading')}</Text>
        ) : status === 'error' || !state ? (
          <>
            <Text style={styles.description}>{t('mediator.summary.error.title')}</Text>
            <Button variant="secondary" size="sm" onPress={reload}>
              {t('common.retry')}
            </Button>
          </>
        ) : (
          (() => {
            const summary = summaryFor(state);
            return (
              <>
                <View style={styles.row}>
                  <Icon name="scale" size={18} color={semanticColors.text.secondary} />
                  <Text style={styles.title}>{t(summary.titleKey)}</Text>
                  <StatusPill status={summary.status}>{t(summary.statusKey)}</StatusPill>
                </View>
                <Text style={styles.description}>{t(summary.descriptionKey)}</Text>
              </>
            );
          })()
        )}

        {status === 'success' && state ? (
          <Button variant="secondary" fullWidth onPress={goToMediator}>
            {state.eligibility === 'unavailable_before_round_3'
              ? t('mediator.summary.learnMoreAction')
              : state.eligibility === 'available'
                ? t('mediator.summary.requestAction')
                : t('mediator.summary.viewAction')}
          </Button>
        ) : null}
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
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
});
