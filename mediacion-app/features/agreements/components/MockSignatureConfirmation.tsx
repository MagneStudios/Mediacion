import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type MockSignatureConfirmationProps = {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
};

/**
 * The explicit confirmation required before "Registrar firma simulada" is
 * enabled — an accessible checkbox, never a handwritten-signature canvas or
 * any biometric/identity capture.
 */
export function MockSignatureConfirmation({ checked, onToggle, label, disabled }: MockSignatureConfirmationProps) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      style={styles.row}
    >
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? <Icon name="check" size={13} color={semanticColors.text.onPrimary} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: semanticColors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: {
    backgroundColor: semanticColors.text.primary,
    borderColor: semanticColors.text.primary,
  },
  label: {
    flex: 1,
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: semanticColors.text.primary,
  },
});
