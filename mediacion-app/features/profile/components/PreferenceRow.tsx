import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type PreferenceRowProps = {
  label: string;
  value: string;
};

/** Static label/value line — read-only summary, never itself interactive. */
export function PreferenceRow({ label, value }: PreferenceRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  value: {
    flexShrink: 1,
    minWidth: 0,
    ...typography.body,
    color: semanticColors.text.primary,
    textAlign: 'right',
  },
});
