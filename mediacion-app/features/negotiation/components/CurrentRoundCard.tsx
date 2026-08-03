import { StyleSheet, View } from 'react-native';

import { Card, StatusPill } from '../../../design-system';
import { Text } from '../../../design-system/components/Text';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
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
        <Text variant="cardTitle" accessibilityRole="header">
          {roundLabel}
        </Text>
        <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
});
