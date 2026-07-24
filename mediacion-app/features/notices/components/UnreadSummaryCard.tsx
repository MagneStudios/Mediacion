import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type UnreadSummaryCardProps = {
  message: string;
};

/** Non-interactive summary line — "Tenés N avisos sin leer" / "Estás al día". */
export function UnreadSummaryCard({ message }: UnreadSummaryCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text} accessibilityRole="text">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  text: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: semanticColors.text.primary,
  },
});
