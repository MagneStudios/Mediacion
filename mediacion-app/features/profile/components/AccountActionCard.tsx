import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
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
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {noticeText ? <Text style={styles.notice}>{noticeText}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  title: {
    fontFamily: typography.cardTitle.fontFamily,
    fontSize: 16,
    letterSpacing: -0.2,
    color: semanticColors.text.primary,
  },
  description: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.secondary,
  },
  notice: {
    marginTop: spacing.xxs,
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 13,
    lineHeight: 19,
    color: semanticColors.text.primary,
  },
});
