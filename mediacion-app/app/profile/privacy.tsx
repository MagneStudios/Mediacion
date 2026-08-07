import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { ProfileMenuItem } from '@/features/profile/components/ProfileMenuItem';
import { PrivacySummaryCard } from '@/features/profile/components/PrivacySummaryCard';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';

export default function ProfilePrivacyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding, isWide } = useResponsiveLayout();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.reading, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('profile.privacy.title') }} />

      <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
        {t('profile.privacy.title')}
      </Text>

      <PrivacySummaryCard icon="lock" title={t('profile.privacy.isolation.title')} body={t('profile.privacy.isolation.body')} />
      <PrivacySummaryCard icon="shield-check" title={t('profile.privacy.sharedProposals.title')} body={t('profile.privacy.sharedProposals.body')} />
      <PrivacySummaryCard icon="file-signature" title={t('profile.privacy.signatures.title')} body={t('profile.privacy.signatures.body')} />
      <PrivacySummaryCard icon="info" title={t('profile.privacy.future.title')} body={t('profile.privacy.future.body')} />

      <View style={styles.actions}>
        <ProfileMenuItem
          icon="alert-circle"
          label={t('profile.privacy.links.deactivation')}
          compact
          onPress={() => {
            blurActiveElement();
            router.push('/profile/account');
          }}
        />
        <ProfileMenuItem
          icon="help-circle"
          label={t('profile.privacy.links.support')}
          compact
          onPress={() => {
            blurActiveElement();
            router.push('/profile/help');
          }}
        />
      </View>
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
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
