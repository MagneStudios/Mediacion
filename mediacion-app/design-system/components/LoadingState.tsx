import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { spacing } from '../tokens/spacing';

export type LoadingStateProps = {
  label?: string;
};

/** Calm loading indicator for a screen or section awaiting data. */
export function LoadingState({ label }: LoadingStateProps) {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="small" color={semanticColors.text.secondary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxl,
  },
  label: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: typography.bodySm.fontSize,
    color: semanticColors.text.secondary,
  },
});
