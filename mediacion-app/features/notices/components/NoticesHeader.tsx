import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { semanticColors } from '../../../design-system/tokens/colors';
import { Icon } from '../../../design-system/components/Icon';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';

export type NoticesHeaderProps = {
  title: string;
  unreadCount: number;
  isWide: boolean;
};

export function NoticesHeader({ title, unreadCount, isWide }: NoticesHeaderProps) {
  const { t } = useTranslation();

  const summaryMessage =
    unreadCount === 0 ? t('notices.noUnread') : t('notices.unreadSummary', { count: unreadCount });

  return (
    <View style={styles.container}>
      <View style={styles.eyebrowRow}>
        <Icon name="bell" size={17} color={semanticColors.action.primaryBg} />
        <Text style={styles.eyebrow}>{t('notices.header.badge')}</Text>
      </View>
      <Text
        style={[styles.title, isWide ? styles.titleWide : styles.titleCompact]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <Text style={styles.summary}>{summaryMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eyebrow: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: typography.eyebrow.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: semanticColors.action.primaryBg,
  },
  title: {
    fontFamily: typography.displayLg.fontFamily,
    letterSpacing: -0.8,
    color: semanticColors.text.primary,
    flexShrink: 1,
  },
  titleWide: {
    fontSize: 40,
    lineHeight: 45,
  },
  titleCompact: {
    fontSize: 34,
    lineHeight: 40,
  },
  summary: {
    fontFamily: typography.bodyLg.fontFamily,
    fontSize: typography.bodyLg.fontSize,
    lineHeight: typography.bodyLg.lineHeight,
    color: semanticColors.text.secondary,
  },
});
