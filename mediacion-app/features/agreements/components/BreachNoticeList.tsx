import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { BreachNotice } from '../../../types/agreement';

export type BreachNoticeListProps = {
  notices: BreachNotice[];
  title: string;
  emptyLabel: string;
  /** Pre-formatted by the caller — this component never touches Intl. */
  formatDate: (fecha: string) => string;
};

/**
 * The registered breach notices of an agreement.
 *
 * Exists because the confirmation dialog promises the note "queda visible
 * para ambas partes" and, until this shipped, nothing showed it anywhere.
 *
 * Presentational only: renders what it is given, never calls a service, and
 * **never attributes a notice to a person**. `BreachNotice.reporterId` is a
 * raw uuid and this app has no user directory — a uuid next to an accusation
 * reads worse than no attribution at all, and guessing at a name would be
 * worse still. Neutral, free-text description and date, nothing else: no
 * fault, no severity, no legal determination.
 */
export function BreachNoticeList({ notices, title, emptyLabel, formatDate }: BreachNoticeListProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {notices.length === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        notices.map((notice) => (
          <Card key={notice.id} style={styles.card}>
            <Text style={styles.date}>{formatDate(notice.fecha)}</Text>
            <Text style={styles.description} selectable>
              {notice.description}
            </Text>
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  title: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  empty: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  date: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
  description: {
    ...typography.body,
    color: semanticColors.text.primary,
  },
});
