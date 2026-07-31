import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { StatusPill } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type NoticesHeaderProps = {
  title: string;
  unreadCount: number;
  isWide: boolean;
};

/** Compact workspace header — open composition, minimal height. Pure visual, no business logic. */
export function NoticesHeader({ title, unreadCount, isWide }: NoticesHeaderProps) {
  const { t } = useTranslation();

  const summaryMessage =
    unreadCount === 0 ? t('notices.noUnread') : t('notices.unreadSummary', { count: unreadCount });

  return (
    <View style={[styles.container, isWide && styles.containerWide]}>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {unreadCount > 0 ? (
        <StatusPill status="info" dot>{summaryMessage}</StatusPill>
      ) : (
        <StatusPill status="success">{summaryMessage}</StatusPill>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  containerWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 22,
    letterSpacing: -0.3,
    color: semanticColors.text.primary,
    flexShrink: 1,
  },
});
