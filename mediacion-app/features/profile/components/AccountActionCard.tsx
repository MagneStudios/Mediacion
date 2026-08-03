import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from '../../../design-system/components/Card';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type AccountActionCardProps = {
  title: string;
  description: string;
  noticeText?: string;
  children?: ReactNode;
};

/**
 * Non-interactive informational card describing one account action
 * (sign-out or deactivation). The actual Button is rendered by the caller as
 * a sibling right below it — never nested inside this Card — matching the
 * pattern used on the agreement dashboard screen.
 */
export function AccountActionCard({ title, description, noticeText, children }: AccountActionCardProps) {
  return (
    <Card style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {noticeText ? <Text style={styles.notice}>{noticeText}</Text> : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    padding: spacing.lg,
  },
  title: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  description: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  notice: {
    marginTop: spacing.xxs,
    ...typography.bodySm,
    color: semanticColors.text.primary,
  },
});
