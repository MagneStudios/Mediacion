import { StyleSheet, Text, View } from 'react-native';

import { Avatar, StatusPill, type StatusPillStatus } from '../../../design-system';
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

export function ProfileHeaderCard({ displayName, roleLabel, statusLabel, statusVisual }: ProfileHeaderCardProps) {
  return (
    <View style={styles.container}>
      <Avatar name={displayName} size="lg" />
      <View style={styles.body}>
        <Text style={styles.name} accessibilityRole="header">{displayName}</Text>
        <Text style={styles.role}>{roleLabel}</Text>
        <View style={styles.badges}>
          <StatusPill status={statusVisual}>{statusLabel}</StatusPill>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 24,
    letterSpacing: -0.4,
    lineHeight: 30,
    color: semanticColors.text.primary,
  },
  role: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    color: semanticColors.text.secondary,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
});
