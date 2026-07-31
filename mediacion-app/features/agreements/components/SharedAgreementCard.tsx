import { StyleSheet, Text, View } from 'react-native';

import { Card, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';
import type { SharedAgreementTerm } from '../../../types/agreement';
import { SharedAgreementTermCard } from './SharedAgreementTermCard';

export type SharedAgreementCardProps = {
  title: string;
  summary: string;
  terms: SharedAgreementTerm[];
  rationale?: string;
  rationaleLabel: string;
  statusLabel: string;
  statusVisual: StatusPillStatus;
};

/** Sanitized shared agreement content — never a raw position value or per-party attribution. Non-interactive; signature actions live in sibling components. */
export function SharedAgreementCard({
  title,
  summary,
  terms,
  rationale,
  rationaleLabel,
  statusLabel,
  statusVisual,
}: SharedAgreementCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
      </View>

      <View style={styles.body}>
        <Text style={styles.summary}>{summary}</Text>

        {terms.map((term, index) => (
          <View key={term.id}>
            {index > 0 ? <View style={styles.termDivider} /> : null}
            <SharedAgreementTermCard title={term.title} description={term.description} />
          </View>
        ))}

        {rationale ? (
          <View style={styles.rationale}>
            <Text style={styles.rationaleLabel}>{rationaleLabel}</Text>
            <Text style={styles.rationaleText}>{rationale}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 0,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: semanticColors.surface.sunken,
    borderBottomWidth: 1,
    borderBottomColor: semanticColors.border.soft,
  },
  headerTitle: {
    flexShrink: 1,
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  summary: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
  termDivider: {
    height: 1,
    backgroundColor: semanticColors.border.soft,
    marginVertical: spacing.xxs,
  },
  rationale: {
    marginTop: spacing.xxs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: semanticColors.border.soft,
    gap: spacing.xxs,
  },
  rationaleLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: semanticColors.text.tertiary,
  },
  rationaleText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
    fontStyle: 'italic',
  },
});
