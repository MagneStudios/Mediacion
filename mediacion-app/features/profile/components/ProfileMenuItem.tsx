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

/**
 * A single settings-navigation row — the whole row is one Pressable (via
 * Card's `interactive`), never a Card wrapping a separate nested button.
 */
export function ProfileMenuItem({ icon, label, description, onPress, accessibilityLabel }: ProfileMenuItemProps) {
  return (
    <Card interactive onPress={onPress} accessibilityLabel={accessibilityLabel ?? label} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Icon name={icon} size={18} color={semanticColors.text.secondary} />
        </View>
        <View style={styles.body}>
          <Text style={styles.label}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        <Icon name="chevron-right" size={18} color={semanticColors.text.tertiary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12.5,
    color: semanticColors.text.secondary,
  },
});
