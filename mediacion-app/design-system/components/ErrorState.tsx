import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../tokens/colors';
import { typography } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { Icon } from './Icon';
import { Button } from './Button';

export type ErrorStateProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
};

/** Calm error state — status is carried by text + icon, never color alone. */
export function ErrorState({ title, description, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.icon}>
        <Icon name="alert-circle" size={28} color={semanticColors.status.errorFg} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {onRetry && retryLabel ? (
        <View style={styles.action}>
          <Button variant="secondary" size="sm" onPress={onRetry}>
            {retryLabel}
          </Button>
        </View>
      ) : null}
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
