import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card, StatusPill } from '../../../design-system';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { MeetingPointEntry } from '../../../types/negotiation';
import { MeetingPointRow } from './MeetingPointRow';

export type MeetingPointLabels = {
  categoryLabel: string;
  valueLabel: string;
  estadoLabel: string;
};

export type SharedProposalCardProps = {
  /** Localized heading, e.g. "Punto de encuentro — Ronda 2". Not proposal data: the engine produces no title. */
  title: string;
  meetingPoint: MeetingPointEntry[];
  /** Null while the engine is still writing it. */
  narrative: string | null;
  pendingLabel: string;
  emptyMeetingPointLabel: string;
  /** Maps an entry to localized copy — this component never turns an enum into words. */
  renderEntryLabels: (entry: MeetingPointEntry) => MeetingPointLabels;
  rationale?: string;
  rationaleLabel: string;
  statusLabel: string;
  statusVisual: StatusPillStatus;
};

/**
 * Sanitized shared proposal content — the derived meeting point plus the
 * engine's narrative, never a party's raw range or condition. Non-interactive;
 * response actions live in a sibling component.
 */
export function SharedProposalCard({
  title,
  meetingPoint,
  narrative,
  pendingLabel,
  emptyMeetingPointLabel,
  renderEntryLabels,
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

      {narrative === null ? (
        <View style={styles.pending}>
          <ActivityIndicator size="small" color={semanticColors.text.quaternary} />
          <Text style={styles.pendingText}>{pendingLabel}</Text>
        </View>
      ) : (
        <Text style={styles.narrative}>{narrative}</Text>
      )}

      {meetingPoint.length === 0 ? (
        <Text style={styles.empty}>{emptyMeetingPointLabel}</Text>
      ) : (
        meetingPoint.map((entry) => {
          const labels = renderEntryLabels(entry);
          return (
            <MeetingPointRow
              key={entry.categoria}
              categoryLabel={labels.categoryLabel}
              valueLabel={labels.valueLabel}
              estado={entry.estado}
              estadoLabel={labels.estadoLabel}
            />
          );
        })
      )}

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
  narrative: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 21,
    color: semanticColors.text.secondary,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pendingText: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    color: semanticColors.text.quaternary,
  },
  empty: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    color: semanticColors.text.quaternary,
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
