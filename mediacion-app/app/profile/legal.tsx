import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { LegalNoticeCard } from '@/features/profile/components/LegalNoticeCard';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

const SECTION_KEYS = ['terms', 'privacyNotice', 'aiNotice', 'signatureNotice', 'noAdvice'] as const;

export default function ProfileLegalScreen() {
  const { t } = useTranslation();
  const { horizontalPadding } = useResponsiveLayout();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.reading, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('profile.legal.title') }} />

      {SECTION_KEYS.map((key) => (
        <LegalNoticeCard
          key={key}
          title={t(`profile.legal.${key}.title`)}
          body={t(`profile.legal.${key}.body`)}
          badgeLabel={t('profile.legal.generalInfoBadge')}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
});
