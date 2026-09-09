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

const CONTEXTUAL_TONE: Record<CaseVisualStatus, { bg: string; fg: string; border?: string }> = {
  success: { bg: semanticColors.status.successBg, fg: semanticColors.status.successFg },
  warning: { bg: semanticColors.status.warningBg, fg: semanticColors.status.warningFg, border: semanticColors.status.warningFg },
  error: { bg: semanticColors.status.errorBg, fg: semanticColors.status.errorFg, border: semanticColors.status.errorFg },
  info: { bg: semanticColors.status.infoBg, fg: semanticColors.status.infoFg },
  neutral: { bg: semanticColors.surface.sunken, fg: semanticColors.text.secondary },
  ai: { bg: semanticColors.ai.tint, fg: semanticColors.ai.accent, border: semanticColors.ai.accent },
};

const CTA_KEY: Record<CaseStatusLabelKey, 'continue' | 'respond' | 'view'> = {
  inReview: 'continue',
  proposalReady: 'respond',
  signed: 'view',
  awaitingCounterparty: 'view',
  // C-01: 'view' y no 'continue'. Desde la tarjeta no se puede resolver el
  // bloqueo —la suscripción que falta puede ser la de la contraparte— así que
  // prometer "continuar" lleva a un caso que no abre. Abrir el detalle, que sí
  // explica qué está pasando, es lo único honesto que se puede ofrecer acá.
  awaitingSubscriptions: 'view',
  expired: 'view',
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
    <Card style={[styles.card, { borderTopWidth: 3, borderTopColor: STATUS_ACCENT[caseSummary.visualStatus] }]}>
      {/* 1. Header: method eyebrow left · status pill right */}
      <View style={styles.topRow}>
        <View style={styles.methodBadge} accessibilityLabel={t(`methods.${caseSummary.metodo}`)}>
          <Icon name={methodIcon} size={14} color={semanticColors.text.tertiary} />
          <Text variant="eyebrow" style={styles.methodLabel}>
            {methodLabel}
          </Text>
        </View>
        <View style={styles.statusSlot}>
          <StatusPill status={caseSummary.visualStatus} pulse={caseSummary.visualStatus === 'ai'}>
            {t(`cases.status.${caseSummary.statusLabelKey}`)}
          </StatusPill>
        </View>
      </View>

      {/* 2. Title — strong visual weight, Stitch v6 card-title */}
      <Text variant="cardTitle" style={isFinished ? styles.titleFinished : undefined}>
        {caseSummary.title}
      </Text>

      {/* 3. Metadata — counterparty + round, muted */}
      <Text variant="bodySm" style={[styles.meta, isFinished ? styles.metaFinished : styles.metaActive]}>
        {metaText}
      </Text>

      {/* 4. Contextual block — next action / result */}
      <View
        style={[
          styles.contextualBlock,
          { backgroundColor: contextualTone.bg },
        ]}
      >
        <Icon name={contextualIcon} size={18} color={contextualTone.fg} />
        <View style={styles.contextualBody}>
          <View style={styles.contextualLabelRow}>
            <Text variant="eyebrow" style={[styles.contextualEyebrow, { color: contextualTone.fg }]}>
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
      <View style={styles.footerSection}>
        <Divider tone="soft" />
        <View style={styles.footer}>
          <Button
            variant={buttonVariant}
            fullWidth={!isWide}
            size="sm"
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
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    minHeight: 240,
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    flexShrink: 1,
  },
  methodLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
    color: semanticColors.text.tertiary,
  },
  titleFinished: {
    color: semanticColors.text.secondary,
  },
  meta: {
    marginTop: -spacing.xs,
  },
  metaActive: {
    color: semanticColors.text.secondary,
  },
  metaFinished: {
    color: semanticColors.text.tertiary,
  },
  contextualBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: semanticColors.border.soft,
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
    gap: spacing.xs,
  },
  contextualEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusSlot: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  footerSection: {
    marginTop: 'auto',
    gap: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
