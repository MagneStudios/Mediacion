import { StyleSheet, Text, View } from 'react-native';

import { Card, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';
import type { SharedProposalTerm } from '../../../types/negotiation';
import { SharedProposalTermCard } from './SharedProposalTermCard';

export type SharedProposalCardProps = {
  title: string;
  summary: string;
  terms: SharedProposalTerm[];
  rationale?: string;
  rationaleLabel: string;
  statusLabel: string;
  statusVisual: StatusPillStatus;
};

/** Sanitized shared proposal content — never a party's raw range or condition. Non-interactive; response actions live in a sibling component. */
export function SharedProposalCard({
  title,
  summary,
  terms,
  rationale,
  rationaleLabel,
  statusLabel,
  statusVisual,
}: SharedProposalCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
      </View>

      <Text style={styles.summary}>{summary}</Text>

      {terms.map((term) => (
        <SharedProposalTermCard key={term.id} title={term.title} description={term.description} />
      ))}

      {rationale ? (
        <View style={styles.rationale}>
          <Text style={styles.rationaleLabel}>{rationaleLabel}</Text>
          <Text style={styles.rationaleText}>{rationale}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 18,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  summary: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
  rationale: {
    marginTop: spacing.xxs,
    gap: 2,
  },
  rationaleLabel: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 11,
    color: semanticColors.text.quaternary,
  },
  rationaleText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
});
