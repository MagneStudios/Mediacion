import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Divider, Icon, StatusPill, Text } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import type { CaseSummary, CaseStatusLabelKey, CaseVisualStatus } from '../../../types/case';
import { getMethodIcon } from '../../../utils/get-method-icon';

export type CaseCardProps = {
  caseSummary: CaseSummary;
  onPress: () => void;
  isWide?: boolean;
};

const STATUS_ACCENT: Record<CaseVisualStatus, string> = {
  success: semanticColors.status.successFg,
  warning: semanticColors.status.warningFg,
  error: semanticColors.status.errorFg,
  info: semanticColors.status.infoFg,
  neutral: semanticColors.border.default,
  ai: semanticColors.ai.accent,
};

const CONTEXTUAL_TONE: Record<CaseVisualStatus, { bg: string; fg: string }> = {
  success: { bg: semanticColors.status.successBg, fg: semanticColors.status.successFg },
  warning: { bg: semanticColors.status.warningBg, fg: semanticColors.status.warningFg },
  error: { bg: semanticColors.status.errorBg, fg: semanticColors.status.errorFg },
  info: { bg: semanticColors.status.infoBg, fg: semanticColors.status.infoFg },
  neutral: { bg: semanticColors.surface.sunken, fg: semanticColors.text.secondary },
  ai: { bg: semanticColors.ai.tint, fg: semanticColors.ai.accent },
};

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

  const methodIcon = getMethodIcon(caseSummary.metodo);
  const methodLabel = t(`methods.${caseSummary.metodo}`);

  const ctaContent: ReactNode = t(`cases.cta.${ctaKey}`);
  const ctaAccessibilityLabel = `${ctaContent} — ${caseSummary.title}`;
  const chevronColor =
    buttonVariant === 'ai' ? semanticColors.action.aiFg :
    buttonVariant === 'primary' ? semanticColors.action.primaryFg :
    semanticColors.action.secondaryFg;

  return (
    <Card style={[styles.card, { borderLeftWidth: 3, borderLeftColor: STATUS_ACCENT[caseSummary.visualStatus] }]}>
      {/* 1. Header: method badge left · status pill right */}
      <View style={styles.topRow}>
        <View style={styles.methodBadge} accessibilityLabel={t(`methods.${caseSummary.metodo}`)}>
          <Icon name={methodIcon} size={13} color={semanticColors.text.secondary} />
          <Text variant="caption" color="secondary">
            {methodLabel}
          </Text>
        </View>
        <StatusPill status={caseSummary.visualStatus} pulse={caseSummary.visualStatus === 'ai'}>
          {t(`cases.status.${caseSummary.statusLabelKey}`)}
        </StatusPill>
      </View>

      {/* 2. Title — strong visual weight */}
      <Text variant="cardTitle" style={styles.title} numberOfLines={2}>
        {caseSummary.title}
      </Text>

      {/* 3. Metadata — counterparty + round, muted */}
      <Text variant="bodySm" color="secondary" numberOfLines={1}>
        {metaText}
      </Text>

      {/* 4. Contextual block — next action / result */}
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

      {/* 5. Divider + CTA */}
      <Divider tone="soft" />
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
    padding: spacing.lg,
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
    fontSize: 17,
    letterSpacing: -0.3,
    lineHeight: 24,
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
  },
  footerMobile: {},
  footerCtaDesktop: {
    flexShrink: 0,
  },
});
