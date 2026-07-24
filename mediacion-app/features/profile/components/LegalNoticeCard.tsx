import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '../../../design-system/components/Badge';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type LegalNoticeCardProps = {
  title: string;
  body: string;
  badgeLabel: string;
};

/** One informational legal section — always carries the "Información general" badge, never a compliance claim. */
export function LegalNoticeCard({ title, body, badgeLabel }: LegalNoticeCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Badge variant="neutral">{badgeLabel}</Badge>
      </View>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 16,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  body: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13.5,
    lineHeight: 20,
    color: semanticColors.text.secondary,
  },
});
