import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type SharedAgreementTermCardProps = {
  title: string;
  description: string;
};

/** One agreement term — sanitized shared content, never a private value or per-party attribution. */
export function SharedAgreementTermCard({ title, description }: SharedAgreementTermCardProps) {
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
