import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card, EntityTypeIndicator, Icon, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { typography } from '../../../design-system/tokens/typography';
import { spacing } from '../../../design-system/tokens/spacing';
import type { CaseSummary, CaseVisualStatus } from '../../../types/case';
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

export function CaseCard({ caseSummary, onPress }: CaseCardProps) {
  const { t } = useTranslation();

  const roundLabel =
    caseSummary.roundNumber != null
      ? t('cases.round', { number: caseSummary.roundNumber })
      : t('cases.noRound');

  const metaText = caseSummary.counterpartyName
    ? `${caseSummary.counterpartyName} · ${roundLabel}`
    : t(`methods.${caseSummary.metodo}`);

  return (
    <Card
      interactive
      onPress={onPress}
      accessibilityLabel={caseSummary.title}
      style={[styles.card, { borderWidth: 1, borderLeftWidth: 3, borderLeftColor: STATUS_ACCENT[caseSummary.visualStatus] }]}
    >
      <View style={styles.top}>
        <EntityTypeIndicator icon={getMethodIcon(caseSummary.metodo)} tone={caseSummary.visualStatus} accessibilityLabel={t(`methods.${caseSummary.metodo}`)} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {caseSummary.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {metaText}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={semanticColors.text.quaternary} />
      </View>
      <View style={styles.footer}>
        <StatusPill status={caseSummary.visualStatus} pulse={caseSummary.visualStatus === 'ai'}>
          {t(`cases.status.${caseSummary.statusLabelKey}`)}
        </StatusPill>
        {caseSummary.slaHours != null ? (
          <StatusPill status="warning">{t('cases.status.sla', { hours: caseSummary.slaHours })}</StatusPill>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
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
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
    marginBottom: 2,
  },
  meta: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    color: semanticColors.text.tertiary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
});
