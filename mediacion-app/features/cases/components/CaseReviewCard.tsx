import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type CaseReviewCardProps = {
  nameLabel: string;
  name: string;
  descriptionLabel: string;
  description?: string;
  methodLabel: string;
  method: string;
};

/** Neutral, shared-information-only review of a case draft before it's created. */
export function CaseReviewCard({
  nameLabel,
  name,
  descriptionLabel,
  description,
  methodLabel,
  method,
}: CaseReviewCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>{nameLabel}</Text>
        <Text style={styles.value}>{name}</Text>
      </View>
      {description ? (
        <View style={[styles.row, styles.rowBorder]}>
          <Text style={styles.label}>{descriptionLabel}</Text>
          <Text style={styles.value}>{description}</Text>
        </View>
      ) : null}
      <View style={[styles.row, styles.rowBorder]}>
        <Text style={styles.label}>{methodLabel}</Text>
        <Text style={styles.value}>{method}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  row: {
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: semanticColors.border.soft,
  },
  label: {
    ...typography.eyebrow,
    color: semanticColors.text.tertiary,
  },
  value: {
    ...typography.body,
    color: semanticColors.text.primary,
  },
});
