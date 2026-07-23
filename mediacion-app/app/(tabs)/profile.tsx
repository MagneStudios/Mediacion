import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorState, LoadingState, ResponsiveColumns } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { DemoEnvironmentNotice } from '@/features/profile/components/DemoEnvironmentNotice';
import { PreferenceRow } from '@/features/profile/components/PreferenceRow';
import { ProfileHeaderCard } from '@/features/profile/components/ProfileHeaderCard';
import { ProfileMenuItem } from '@/features/profile/components/ProfileMenuItem';
import { useNotificationPreferences } from '@/features/profile/hooks/useNotificationPreferences';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, profile, reload } = useProfile();
  const notifications = useNotificationPreferences();
  const { horizontalPadding } = useResponsiveLayout();

  if (status === 'loading') {
    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.loadingContent}>
        <LoadingState label={t('common.loading')} />
      </ScrollView>
    );
  }

  if (status === 'error' || !profile) {
    return (
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.loadingContent}>
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reload} />
      </ScrollView>
    );
  }

  const notificationsValue =
    notifications.status === 'success' && notifications.preferences
      ? t('profile.summary.notificationsValue', {
          enabled: Object.values(notifications.preferences).filter(Boolean).length,
          total: Object.keys(notifications.preferences).length,
        })
      : '—';

  const languageValue = profile.idioma === 'en' ? t('profile.edit.languageEn') : t('profile.edit.languageEs');

  const appVersion = Constants.expoConfig?.version ?? '—';

  const primaryColumn = (
    <>
      <ProfileHeaderCard
        displayName={`${profile.nombre} ${profile.apellido}`}
        roleLabel={t(`profile.role.${profile.rol}`)}
        statusLabel={profile.activo ? t('profile.status.active') : t('profile.status.inactive')}
        statusVisual={profile.activo ? 'success' : 'neutral'}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{t('profile.summary.sectionTitle')}</Text>
        <PreferenceRow label={t('profile.summary.language')} value={languageValue} />
        <PreferenceRow label={t('profile.summary.notifications')} value={notificationsValue} />
        <PreferenceRow label={t('profile.summary.privacy')} value={t('profile.summary.privacyValue')} />
      </View>
    </>
  );

  const secondaryColumn = (
    <>
      <ProfileMenuItem icon="pencil" label={t('profile.menu.edit.label')} description={t('profile.menu.edit.description')} onPress={() => { blurActiveElement(); router.push('/profile/edit'); }} />
      <ProfileMenuItem icon="bell" label={t('profile.menu.notifications.label')} description={t('profile.menu.notifications.description')} onPress={() => { blurActiveElement(); router.push('/profile/notifications'); }} />
      <ProfileMenuItem icon="shield-check" label={t('profile.menu.privacy.label')} description={t('profile.menu.privacy.description')} onPress={() => { blurActiveElement(); router.push('/profile/privacy'); }} />
      <ProfileMenuItem icon="help-circle" label={t('profile.menu.help.label')} description={t('profile.menu.help.description')} onPress={() => { blurActiveElement(); router.push('/profile/help'); }} />
      <ProfileMenuItem icon="file-text" label={t('profile.menu.legal.label')} description={t('profile.menu.legal.description')} onPress={() => { blurActiveElement(); router.push('/profile/legal'); }} />
      <ProfileMenuItem icon="settings" label={t('profile.menu.account.label')} description={t('profile.menu.account.description')} onPress={() => { blurActiveElement(); router.push('/profile/account'); }} />
    </>
  );

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.wide, horizontalPadding })]}
    >
      <Text style={styles.title} accessibilityRole="header">
        {t('profile.header.title')}
      </Text>

      <DemoEnvironmentNotice title={t('profile.demoNotice.title')} body={t('profile.demoNotice.overview')} />

      <ResponsiveColumns primary={primaryColumn} secondary={secondaryColumn} />

      <Text style={styles.version}>{t('profile.version', { version: appVersion })}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  loadingContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 26,
    letterSpacing: -0.5,
    color: semanticColors.text.primary,
    marginBottom: spacing.xs,
  },
  summaryCard: {
    gap: spacing.xxs,
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  summaryTitle: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 12,
    color: semanticColors.text.tertiary,
    marginBottom: spacing.xxs,
  },
  version: {
    alignSelf: 'center',
    marginTop: spacing.md,
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    color: semanticColors.text.tertiary,
  },
});
