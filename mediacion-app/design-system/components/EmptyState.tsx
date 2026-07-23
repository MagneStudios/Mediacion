import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { spacing } from '../tokens/spacing';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

/** Calm, low-stimulation placeholder for a screen or section with no content yet. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container} accessibilityRole="text">
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  icon: {
    marginBottom: spacing.xxs,
  },
  title: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: typography.cardTitle.fontSize,
    lineHeight: typography.cardTitle.lineHeight,
    color: semanticColors.text.primary,
    textAlign: 'center',
  },
  description: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    color: semanticColors.text.secondary,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.xs,
  },
});
