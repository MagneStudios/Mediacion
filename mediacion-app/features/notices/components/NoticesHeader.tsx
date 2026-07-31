import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { semanticColors } from '../../../design-system/tokens/colors';
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
      <Text style={styles.eyebrow}>Portal de Notificaciones</Text>
      <Text
        style={[styles.title, isWide ? styles.titleWide : styles.titleCompact]}
        accessibilityRole="header"
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text style={styles.summary}>{summaryMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  eyebrow: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: typography.eyebrow.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: semanticColors.text.secondary,
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
    fontFamily: typography.bodySm.fontFamily,
    fontSize: typography.bodySm.fontSize,
    color: semanticColors.text.secondary,
  },
});
