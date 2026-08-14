import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { LegalNoticeCard } from '@/features/profile/components/LegalNoticeCard';
import { ProfileMenuItem } from '@/features/profile/components/ProfileMenuItem';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';

const SECTION_KEYS = ['terms', 'privacyNotice', 'aiNotice', 'signatureNotice', 'retention', 'noAdvice'] as const;

export default function ProfileLegalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding, isWide } = useResponsiveLayout();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.reading, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('profile.legal.title') }} />

      <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
        {t('profile.legal.title')}
      </Text>

      {/*
        The full legal documents live on their own permanent public pages,
        rendered from data (instructivo §1). The cards below are product
        orientation, not the documents themselves.
      */}
      <View style={styles.documentLinks}>
        <ProfileMenuItem
          icon="file-text"
          label={t('legal.terms.title')}
          compact
          onPress={() => {
            blurActiveElement();
            router.push('/terminos-y-condiciones');
          }}
        />
        <ProfileMenuItem
          icon="shield-check"
          label={t('legal.privacy.title')}
          compact
          onPress={() => {
            blurActiveElement();
            router.push('/politica-de-privacidad');
          }}
        />
      </View>

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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
    marginBottom: spacing.xs,
  },
  titleWide: {
    ...typography.displayLg,
  },
  documentLinks: {
    gap: spacing.sm,
  },
});
