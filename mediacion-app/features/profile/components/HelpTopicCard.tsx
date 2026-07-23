import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type HelpTopicCardProps = {
  question: string;
  answer: string;
};

/** Static FAQ entry — non-interactive, no expand/collapse affordance needed for this small a set. */
export function HelpTopicCard({ question, answer }: HelpTopicCardProps) {
  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.question} accessibilityRole="header">
        {question}
      </Text>
      <Text style={styles.answer}>{answer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  question: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 15,
    letterSpacing: -0.1,
    color: semanticColors.text.primary,
  },
  answer: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
});
