import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { ProfileMenuItem } from '@/features/profile/components/ProfileMenuItem';
import { PrivacySummaryCard } from '@/features/profile/components/PrivacySummaryCard';

export default function ProfilePrivacyScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('profile.privacy.title') }} />

      <PrivacySummaryCard icon="lock" title={t('profile.privacy.isolation.title')} body={t('profile.privacy.isolation.body')} />
      <PrivacySummaryCard icon="shield-check" title={t('profile.privacy.sharedProposals.title')} body={t('profile.privacy.sharedProposals.body')} />
      <PrivacySummaryCard icon="file-signature" title={t('profile.privacy.signatures.title')} body={t('profile.privacy.signatures.body')} />
      <PrivacySummaryCard icon="info" title={t('profile.privacy.future.title')} body={t('profile.privacy.future.body')} />

      <ProfileMenuItem
        icon="alert-circle"
        label={t('profile.privacy.links.deactivation')}
        onPress={() => router.push('/profile/account')}
      />
      <ProfileMenuItem
        icon="help-circle"
        label={t('profile.privacy.links.support')}
        onPress={() => router.push('/profile/help')}
      />
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
