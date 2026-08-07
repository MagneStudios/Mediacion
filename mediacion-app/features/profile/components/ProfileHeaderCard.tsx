import { StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, StatusPill, type StatusPillStatus } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type ProfileHeaderCardProps = {
  displayName: string;
  roleLabel: string;
  statusLabel: string;
  statusVisual: StatusPillStatus;
};

export function ProfileHeaderCard({ displayName, roleLabel, statusLabel, statusVisual }: ProfileHeaderCardProps) {
  return (
    <Card style={styles.container}>
      <Avatar name={displayName} size="lg" />
      <View style={styles.body}>
        <Text style={styles.name} accessibilityRole="header">{displayName}</Text>
        <Text style={styles.role}>{roleLabel}</Text>
        <View style={styles.badges}>
          <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  name: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  role: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
});
