import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type DocumentPreparationStateProps = {
  title: string;
  description: string;
};

/**
 * Document preparation is not an AI action — no sage tint, no AI badge.
 * A calm, neutral loading state instead of AIProcessingState, whose
 * AI-specific wording and treatment would be misleading here.
 */
export function DocumentPreparationState({ title, description }: DocumentPreparationStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={semanticColors.text.secondary} />
      <View style={styles.textColumn}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 12.5,
    lineHeight: 18,
    color: semanticColors.text.secondary,
  },
});
