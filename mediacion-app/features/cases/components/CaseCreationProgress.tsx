import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type CaseCreationProgressProps = {
  step: number;
  total: number;
  label: string;
};

/** Static step indicator for the case-creation wizard — no motion, text label carries the meaning (not just the segments). */
export function CaseCreationProgress({ step, total, label }: CaseCreationProgressProps) {
  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[styles.segment, index < step ? styles.segmentFilled : null]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...typography.eyebrow,
    color: semanticColors.text.tertiary,
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: semanticColors.surface.sunken,
  },
  segmentFilled: {
    backgroundColor: semanticColors.action.primaryBg,
  },
});
