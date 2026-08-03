import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
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
  compact?: boolean;
};

export function ProfileMenuItem({ icon, label, description, onPress, accessibilityLabel, compact = false }: ProfileMenuItemProps) {
  if (compact) {
    return (
      <Card interactive onPress={onPress} accessibilityLabel={accessibilityLabel ?? label} style={styles.cardCompact}>
        <View style={styles.rowCompact}>
          <View style={styles.iconCircleCompact}>
            <Icon name={icon} size={18} color={semanticColors.text.secondary} />
          </View>
          <View style={styles.bodyCompact}>
            <Text style={styles.labelCompact}>{label}</Text>
            {description ? <Text style={styles.descriptionCompact}>{description}</Text> : null}
          </View>
          <Icon name="chevron-right" size={16} color={semanticColors.text.tertiary} />
        </View>
      </Card>
    );
  }

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
    borderRadius: radii.lg,
    padding: spacing.lg,
    minHeight: 180,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  label: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  description: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  chevronRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  /* ---- Compact (mobile) ---- */
  cardCompact: {
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  rowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircleCompact: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
    flexShrink: 0,
  },
  bodyCompact: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  labelCompact: {
    ...typography.button,
    color: semanticColors.text.primary,
  },
  descriptionCompact: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
