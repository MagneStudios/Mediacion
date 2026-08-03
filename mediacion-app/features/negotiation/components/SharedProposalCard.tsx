import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card, Divider, StatusPill } from '../../../design-system';
import { Text } from '../../../design-system/components/Text';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
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
  /** Optional framing sentence shown above the meeting point (e.g. "Esta propuesta busca acercar..."). Purely presentational — never proposal data. */
  intro?: string;
  meetingPoint: MeetingPointEntry[];
  /** Localized section label shown above the meeting-point rows, when there is at least one. */
  meetingPointSectionTitle?: string;
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
 * response actions live in a sibling component. Deliberately has no
 * consensus score, percentage, or progress bar — see
 * docs/frontend-redesign/stitch-export/ for why: the Stitch v3 reference
 * shows a "2/5 puntos acordados" style metric that this codebase treats as
 * an invented consensus indicator, not real derived state worth surfacing.
 */
export function SharedProposalCard({
  title,
  intro,
  meetingPoint,
  meetingPointSectionTitle,
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
        <Text variant="cardTitle" style={styles.title} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
      </View>

      {intro ? (
        <Text variant="bodySm" color="secondary">
          {intro}
        </Text>
      ) : null}

      {narrative === null ? (
        <View style={styles.pending}>
          <ActivityIndicator size="small" color={semanticColors.text.quaternary} />
          <Text variant="bodySm" color="quaternary">
            {pendingLabel}
          </Text>
        </View>
      ) : (
        <Text variant="bodySm" color="secondary">
          {narrative}
        </Text>
      )}

      {meetingPoint.length > 0 && meetingPointSectionTitle ? (
        <Text variant="eyebrow" color="quaternary" style={styles.meetingPointSectionTitle}>
          {meetingPointSectionTitle}
        </Text>
      ) : null}

      {meetingPoint.length === 0 ? (
        <Text variant="bodySm" color="quaternary">
          {emptyMeetingPointLabel}
        </Text>
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
        <>
          <Divider tone="soft" />
          <View style={styles.rationale}>
            <Text variant="eyebrow" color="quaternary">
              {rationaleLabel}
            </Text>
            <Text variant="bodySm" color="secondary">
              {rationale}
            </Text>
          </View>
        </>
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
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    // Never share a line with the status pill when there isn't room for
    // both — flexWrap above lets the pill drop to its own line instead of
    // squeezing the title down to where its 2 allowed lines truncate mid
    // sentence (found during manual validation at 320-390px, e.g. "Punto
    // de encuentro …" cutting off the round number entirely).
    minWidth: 180,
  },
  meetingPointSectionTitle: {
    marginTop: spacing.xxs,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rationale: {
    gap: 2,
  },
});
