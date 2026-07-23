import { StyleSheet, Text, View } from 'react-native';

import { Card, StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import type { StatusPillStatus } from '../../../design-system/components/StatusPill';

export type CurrentRoundCardProps = {
  roundLabel: string;
  statusLabel: string;
  statusVisual: StatusPillStatus;
};

/** Round number + status — display only, no press action. */
export function CurrentRoundCard({ roundLabel, statusLabel, statusVisual }: CurrentRoundCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.roundLabel} accessibilityRole="header">
          {roundLabel}
        </Text>
        <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  roundLabel: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 18,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
});
