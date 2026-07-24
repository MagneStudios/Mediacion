import { StyleSheet, Text, View } from 'react-native';

import { Avatar, Badge, StatusPill, type StatusPillStatus } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type ProfileHeaderCardProps = {
  displayName: string;
  roleLabel: string;
  statusLabel: string;
  statusVisual: StatusPillStatus;
};

/** Non-interactive summary card — display name, role, and account status. Never shows internal IDs or backend metadata. */
export function ProfileHeaderCard({ displayName, roleLabel, statusLabel, statusVisual }: ProfileHeaderCardProps) {
  return (
    <View style={styles.container}>
      <Avatar name={displayName} size="lg" />
      <View style={styles.body}>
        <Text style={styles.name}>{displayName}</Text>
        <Badge variant="outline">{roleLabel}</Badge>
        <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
    alignItems: 'flex-start',
  },
  name: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 20,
    letterSpacing: -0.3,
    color: semanticColors.text.primary,
  },
});
