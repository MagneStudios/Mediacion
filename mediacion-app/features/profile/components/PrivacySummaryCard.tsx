import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import { Icon, type IconName } from '../../../design-system/components/Icon';

export type PrivacySummaryCardProps = {
  icon?: IconName;
  title: string;
  body: string;
};

/** Non-interactive informational card for a single privacy/data-usage point. */
export function PrivacySummaryCard({ icon = 'shield-check', title, body }: PrivacySummaryCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={18} color={semanticColors.text.secondary} />
      </View>
      <View style={styles.textColumn}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
    flexShrink: 0,
  },
  textColumn: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 15,
    letterSpacing: -0.1,
    color: semanticColors.text.primary,
  },
  body: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
});
