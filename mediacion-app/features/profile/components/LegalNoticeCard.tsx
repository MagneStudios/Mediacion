import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '../../../design-system/components/Badge';
import { Card } from '../../../design-system/components/Card';
import { semanticColors } from '../../../design-system/tokens/colors';
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
    <Card style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Badge variant="neutral">{badgeLabel}</Badge>
      </View>
      <Text style={styles.body}>{body}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  body: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
