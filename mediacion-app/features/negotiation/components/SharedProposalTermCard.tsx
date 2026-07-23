import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type SharedProposalTermCardProps = {
  title: string;
  description: string;
};

/** One shared proposal term — sanitized shared content, never a private value. */
export function SharedProposalTermCard({ title, description }: SharedProposalTermCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: semanticColors.border.soft,
  },
  title: {
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
});
