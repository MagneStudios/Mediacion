import { StyleSheet, Text } from 'react-native';

import { Card } from '../../../design-system/components/Card';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type HelpTopicCardProps = {
  question: string;
  answer: string;
};

/** Static FAQ entry — non-interactive, no expand/collapse affordance needed for this small a set. */
export function HelpTopicCard({ question, answer }: HelpTopicCardProps) {
  return (
    <Card style={styles.container}>
      <Text style={styles.question} accessibilityRole="header">
        {question}
      </Text>
      <Text style={styles.answer}>{answer}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  question: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  answer: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
