import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { Card } from '../../../design-system/components/Card';
import { Icon, type IconName } from '../../../design-system/components/Icon';

export type ProfileMenuItemProps = {
  icon: IconName;
  label: string;
  description?: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function ProfileMenuItem({ icon, label, description, onPress, accessibilityLabel }: ProfileMenuItemProps) {
  return (
    <Card interactive onPress={onPress} accessibilityLabel={accessibilityLabel ?? label} style={styles.card}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={22} color={semanticColors.text.secondary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <View style={styles.chevronRow}>
        <Icon name="chevron-right" size={16} color={semanticColors.text.tertiary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.lg,
    minHeight: 180,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  label: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: semanticColors.text.secondary,
  },
  chevronRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
