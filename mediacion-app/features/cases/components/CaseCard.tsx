import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Card, EntityTypeIndicator, Icon, StatusPill, Text } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import type { CaseSummary, CaseStatusLabelKey, CaseVisualStatus } from '../../../types/case';
import { getMethodIcon } from '../../../utils/get-method-icon';

export type CaseCardProps = {
  caseSummary: CaseSummary;
  onPress: () => void;
};

/** Same fg palette StatusPill uses per status — kept here so the card's left accent bar always agrees with its own StatusPill instead of a second color vocabulary. */
const STATUS_ACCENT: Record<CaseVisualStatus, string> = {
  success: semanticColors.status.successFg,
  warning: semanticColors.status.warningFg,
  error: semanticColors.status.errorFg,
  info: semanticColors.status.infoFg,
  neutral: semanticColors.border.default,
  ai: semanticColors.ai.accent,
};

/** Same bg/fg pairing StatusPill already uses per status — the "next action" callout reuses it instead of inventing a second tint. */
const NEXT_ACTION_TONE: Record<CaseVisualStatus, { bg: string; fg: string }> = {
  success: { bg: semanticColors.status.successBg, fg: semanticColors.status.successFg },
  warning: { bg: semanticColors.status.warningBg, fg: semanticColors.status.warningFg },
  error: { bg: semanticColors.status.errorBg, fg: semanticColors.status.errorFg },
  info: { bg: semanticColors.status.infoBg, fg: semanticColors.status.infoFg },
  neutral: { bg: semanticColors.surface.sunken, fg: semanticColors.text.secondary },
  ai: { bg: semanticColors.ai.tint, fg: semanticColors.ai.accent },
};

/**
 * The CTA label is the only thing that varies by `statusLabelKey` — the
 * action behind it is always the same real `onPress` (navigate to the case
 * detail route). No new route, no new decision: this only makes the
 * already-existing whole-card tap explicit as a labeled, contextual button.
 */
const CTA_KEY: Record<CaseStatusLabelKey, 'continue' | 'respond' | 'view'> = {
  inReview: 'continue',
  proposalReady: 'respond',
  signed: 'view',
  awaitingCounterparty: 'view',
};

export function CaseCard({ caseSummary, onPress }: CaseCardProps) {
  const { t } = useTranslation();

  const roundLabel =
    caseSummary.roundNumber != null
      ? t('cases.round', { number: caseSummary.roundNumber })
      : t('cases.noRound');

  const metaText = caseSummary.counterpartyName
    ? `${caseSummary.counterpartyName} · ${roundLabel}`
    : t(`methods.${caseSummary.metodo}`);

  const nextActionTone = NEXT_ACTION_TONE[caseSummary.visualStatus];
  const ctaKey = CTA_KEY[caseSummary.statusLabelKey];

  return (
    // Non-interactive by design (Card has no `interactive`/`onPress`) — the
    // explicit CTA button below is a sibling, never nested inside another
    // Pressable. See design-system rule in agents/front/AGENTS.md: RN Web
    // renders a Pressable's accessibilityRole="button" as a real <button>,
    // and a <button> inside a <button> is invalid HTML.
    <Card style={[styles.card, { borderWidth: 1, borderLeftWidth: 3, borderLeftColor: STATUS_ACCENT[caseSummary.visualStatus] }]}>
      <View style={styles.top}>
        <EntityTypeIndicator icon={getMethodIcon(caseSummary.metodo)} tone={caseSummary.visualStatus} accessibilityLabel={t(`methods.${caseSummary.metodo}`)} />
        <View style={styles.body}>
          <Text variant="body" style={styles.title} numberOfLines={2}>
            {caseSummary.title}
          </Text>
          <Text variant="bodySm" color="tertiary" numberOfLines={1}>
            {metaText}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <StatusPill status={caseSummary.visualStatus} pulse={caseSummary.visualStatus === 'ai'}>
          {t(`cases.status.${caseSummary.statusLabelKey}`)}
        </StatusPill>
        {caseSummary.slaHours != null ? (
          <StatusPill status="warning">{t('cases.status.sla', { hours: caseSummary.slaHours })}</StatusPill>
        ) : null}
      </View>
      <View style={[styles.nextAction, { backgroundColor: nextActionTone.bg }]}>
        <Icon name="info" size={16} color={nextActionTone.fg} />
        <View style={styles.nextActionBody}>
          <Text variant="eyebrow" style={{ color: nextActionTone.fg }}>
            {t('cases.nextActionLabel')}
          </Text>
          <Text variant="bodySm" color="secondary">
            {t(`cases.nextAction.${caseSummary.statusLabelKey}`)}
          </Text>
        </View>
      </View>
      <Button
        variant={caseSummary.visualStatus === 'ai' ? 'ai' : 'secondary'}
        fullWidth
        onPress={onPress}
        accessibilityLabel={`${t(`cases.cta.${ctaKey}`)} — ${caseSummary.title}`}
        iconRight={<Icon name="chevron-right" size={16} color={caseSummary.visualStatus === 'ai' ? semanticColors.action.aiFg : semanticColors.action.secondaryFg} />}
      >
        {t(`cases.cta.${ctaKey}`)}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  nextAction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  nextActionBody: {
    flex: 1,
    gap: 2,
  },
});
