import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../design-system/components/Card';
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
    <Card style={styles.container}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={18} color={semanticColors.text.secondary} />
      </View>
      <View style={styles.textColumn}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
    flexShrink: 0,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  body: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
