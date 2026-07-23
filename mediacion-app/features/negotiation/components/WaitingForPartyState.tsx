import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type WaitingForPartyStateProps = {
  title: string;
  description: string;
};

/** Calm "waiting for the other party" indicator — text carries the meaning, not just the clock icon. */
export function WaitingForPartyState({ title, description }: WaitingForPartyStateProps) {
  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={`${title}. ${description}`}>
      <Icon name="clock" size={18} color={semanticColors.text.tertiary} />
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
