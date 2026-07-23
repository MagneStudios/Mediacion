import { StyleSheet, Switch, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type NotificationPreferenceRowProps = {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * One notification category — label, description, and a native Switch
 * (RN's built-in control; no new dependency, no design-system primitive
 * needed for a single use). The row itself is never a Pressable, so the
 * Switch is never a button nested inside another button.
 */
export function NotificationPreferenceRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: NotificationPreferenceRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel ?? label}
        trackColor={{ false: semanticColors.border.default, true: semanticColors.text.primary }}
        thumbColor={semanticColors.surface.card}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12.5,
    lineHeight: 17,
    color: semanticColors.text.secondary,
  },
});
