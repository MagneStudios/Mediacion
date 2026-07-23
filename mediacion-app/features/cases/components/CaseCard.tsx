import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, Icon, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { typography } from '../../../design-system/tokens/typography';
import { spacing } from '../../../design-system/tokens/spacing';
import type { CaseSummary } from '../../../types/case';

export type CaseCardProps = {
  caseSummary: CaseSummary;
  onPress: () => void;
};

export function CaseCard({ caseSummary, onPress }: CaseCardProps) {
  const { t } = useTranslation();

  const roundLabel =
    caseSummary.roundNumber != null
      ? t('cases.round', { number: caseSummary.roundNumber })
      : t('cases.noRound');

  return (
    <Card interactive onPress={onPress} accessibilityLabel={caseSummary.title} style={styles.card}>
      <View style={styles.top}>
        <Avatar name={caseSummary.counterpartyName} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {caseSummary.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {caseSummary.counterpartyName} · {roundLabel}
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
