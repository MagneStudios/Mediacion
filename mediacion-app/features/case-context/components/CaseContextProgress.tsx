import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';

export type CaseContextProgressProps = {
  completed: number;
  total: number;
};

export function CaseContextProgress({ completed, total }: CaseContextProgressProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={t('caseContext.progress.label', { completed, total })}>
      <Text style={styles.label}>{t('caseContext.progress.label', { completed, total })}</Text>
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[styles.segment, index < completed ? styles.segmentFilled : null]}
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
