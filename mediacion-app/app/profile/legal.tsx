import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { LegalNoticeCard } from '@/features/profile/components/LegalNoticeCard';

const SECTION_KEYS = ['terms', 'privacyNotice', 'aiNotice', 'signatureNotice', 'noAdvice'] as const;

export default function ProfileLegalScreen() {
  const { t } = useTranslation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
    padding: spacing.md,
    gap: spacing.sm,
  },
});
