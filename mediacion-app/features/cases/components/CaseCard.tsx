import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Icon, StatusPill, Text } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import type { CaseSummary, CaseStatusLabelKey, CaseVisualStatus, MetodoCaso } from '../../../types/case';
import { getMethodIcon } from '../../../utils/get-method-icon';

export type CaseCardProps = {
  caseSummary: CaseSummary;
  onPress: () => void;
  isWide?: boolean;
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

/** Same bg/fg pairing StatusPill already uses per status — the contextual callout reuses it instead of inventing a second tint. */
const CONTEXTUAL_TONE: Record<CaseVisualStatus, { bg: string; fg: string }> = {
  success: { bg: semanticColors.status.successBg, fg: semanticColors.status.successFg },
  warning: { bg: semanticColors.status.warningBg, fg: semanticColors.status.warningFg },
  error: { bg: semanticColors.status.errorBg, fg: semanticColors.status.errorFg },
  info: { bg: semanticColors.status.infoBg, fg: semanticColors.status.infoFg },
  neutral: { bg: semanticColors.surface.sunken, fg: semanticColors.text.secondary },
  ai: { bg: semanticColors.ai.tint, fg: semanticColors.ai.accent },
};

/** Method → icon colour, matching the identity Stitch assigns to each resolution method. Purely visual — no business logic. */
const METHOD_COLOR: Record<MetodoCaso, string> = {
  negociacion: semanticColors.text.secondary,
  conciliacion: semanticColors.status.warningFg,
  mediacion: semanticColors.ai.accent,
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

function buttonVariantFor(ctaKey: 'continue' | 'respond' | 'view', visualStatus: CaseVisualStatus): 'primary' | 'ai' | 'secondary' {
  if (ctaKey === 'view') return 'secondary';
  if (visualStatus === 'ai') return 'ai';
  return 'primary';
}

export function CaseCard({ caseSummary, onPress, isWide = false }: CaseCardProps) {
  const { t } = useTranslation();

  const roundLabel =
    caseSummary.roundNumber != null
      ? t('cases.round', { number: caseSummary.roundNumber })
      : t('cases.noRound');

  const metaText = caseSummary.counterpartyName
    ? `${caseSummary.counterpartyName} · ${roundLabel}`
    : t(`methods.${caseSummary.metodo}`);

  const contextualTone = CONTEXTUAL_TONE[caseSummary.visualStatus];
  const ctaKey = CTA_KEY[caseSummary.statusLabelKey];
  const isFinished = caseSummary.statusLabelKey === 'signed';
  const contextualLabel = isFinished ? t('cases.resultLabel') : t('cases.nextActionLabel');
  const contextualIcon: 'check' | 'info' = isFinished ? 'check' : 'info';

  const buttonVariant = buttonVariantFor(ctaKey, caseSummary.visualStatus);

  const methodColor = METHOD_COLOR[caseSummary.metodo];
  const methodIcon = getMethodIcon(caseSummary.metodo);
  const methodLabel = t(`methods.${caseSummary.metodo}`);

  const ctaContent: ReactNode = t(`cases.cta.${ctaKey}`);
  const ctaAccessibilityLabel = `${ctaContent} — ${caseSummary.title}`;
  const chevronColor =
    buttonVariant === 'ai' ? semanticColors.action.aiFg :
    buttonVariant === 'primary' ? semanticColors.action.primaryFg :
    semanticColors.action.secondaryFg;

  return (
    // Non-interactive by design (Card has no `interactive`/`onPress`) — the
    // explicit CTA button below is a sibling, never nested inside another
    // Pressable. See design-system rule in agents/front/AGENTS.md: RN Web
    // renders a Pressable's accessibilityRole="button" as a real <button>,
    // and a <button> inside a <button> is invalid HTML.
    <Card style={[styles.card, { borderLeftWidth: 3, borderLeftColor: STATUS_ACCENT[caseSummary.visualStatus] }]}>
      {/* 1. Top row: method badge left · status pill right */}
      <View style={styles.topRow}>
        <View style={styles.methodBadge} accessibilityLabel={t(`methods.${caseSummary.metodo}`)}>
          <Icon name={methodIcon} size={14} color={methodColor} />
          <Text variant="eyebrow" style={{ color: methodColor, fontSize: 12 }}>
            {methodLabel}
          </Text>
        </View>
        <StatusPill status={caseSummary.visualStatus} pulse={caseSummary.visualStatus === 'ai'}>
          {t(`cases.status.${caseSummary.statusLabelKey}`)}
        </StatusPill>
      </View>

      {/* 2. Title — more prominent */}
      <Text variant="cardTitle" style={styles.title} numberOfLines={2}>
        {caseSummary.title}
      </Text>

      {/* 3. Metadata — counterparty + round, muted */}
      <Text variant="bodySm" color="secondary" numberOfLines={1}>
        {metaText}
      </Text>

      {/* 4. Contextual block — next action / result, with SLA integrated */}
      <View style={[styles.contextualBlock, { backgroundColor: contextualTone.bg }]}>
        <Icon name={contextualIcon} size={16} color={contextualTone.fg} />
        <View style={styles.contextualBody}>
          <View style={styles.contextualLabelRow}>
            <Text variant="eyebrow" style={{ color: contextualTone.fg, fontSize: 12 }}>
              {contextualLabel}
            </Text>
            {caseSummary.slaHours != null ? (
              <Text variant="caption" style={{ color: semanticColors.status.warningFg }}>
                {t('cases.status.sla', { hours: caseSummary.slaHours })}
              </Text>
            ) : null}
          </View>
          <Text variant="bodySm" color="secondary">
            {t(`cases.nextAction.${caseSummary.statusLabelKey}`)}
          </Text>
        </View>
      </View>

      {/* 5. Footer — CTA right-aligned on desktop, full-width on mobile */}
      <View style={isWide ? styles.footerDesktop : styles.footerMobile}>
        <View style={isWide ? styles.footerCtaDesktop : undefined}>
          <Button
            variant={buttonVariant}
            fullWidth={!isWide}
            size={isWide ? 'sm' : 'md'}
            onPress={onPress}
            accessibilityLabel={ctaAccessibilityLabel}
            iconRight={<Icon name="chevron-right" size={16} color={chevronColor} />}
          >
            {ctaContent}
          </Button>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  title: {
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  contextualBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  contextualBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  contextualLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerDesktop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: semanticColors.border.soft,
  },
  footerMobile: {
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: semanticColors.border.soft,
  },
  footerCtaDesktop: {
    flexShrink: 0,
  },
});
