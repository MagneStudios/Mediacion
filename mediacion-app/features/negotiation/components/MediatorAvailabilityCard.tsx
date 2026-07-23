import { StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Icon } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type MediatorAvailabilityCardProps = {
  title: string;
  body: string;
  badgeLabel: string;
};

/**
 * Informational only, from round 3 — no action, tappable or otherwise. A
 * disabled-looking button would imply functionality that isn't there yet;
 * this card never claims a mediator has joined or been assigned.
 */
export function MediatorAvailabilityCard({ title, body, badgeLabel }: MediatorAvailabilityCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Icon name="scale" size={18} color={semanticColors.text.secondary} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      <Badge variant="neutral">{badgeLabel}</Badge>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: semanticColors.text.primary,
  },
  body: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
});
