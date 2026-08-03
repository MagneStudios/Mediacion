import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Icon, LoadingState, StatusPill } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { DemoEnvironmentNotice } from '@/features/profile/components/DemoEnvironmentNotice';
import { PreferenceRow } from '@/features/profile/components/PreferenceRow';
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
  const { horizontalPadding, isWide, isCompact } = useResponsiveLayout();

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

  const displayName = `${profile.nombre} ${profile.apellido}`;
  const initials = `${profile.nombre.charAt(0)}${profile.apellido.charAt(0)}`.toUpperCase();

  const notificationsValue =
    notifications.status === 'success' && notifications.preferences
      ? t('profile.summary.notificationsValue', {
          enabled: Object.values(notifications.preferences).filter(Boolean).length,
          total: Object.keys(notifications.preferences).length,
        })
      : '—';

  const languageValue = profile.idioma === 'en' ? t('profile.edit.languageEn') : t('profile.edit.languageEs');

  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.wide, horizontalPadding })]}
    >
      {/* 1. Hero */}
      <View style={styles.hero}>
        <View style={[styles.heroInner, isCompact && styles.heroInnerCompact]}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <View style={isCompact ? styles.heroTextCompact : styles.heroText}>
            <Text style={styles.heroName} accessibilityRole="header">{displayName}</Text>
            <Text style={styles.heroRole}>{t(`profile.role.${profile.rol}`)}</Text>
            <View style={styles.heroBadge}>
              <StatusPill status={profile.activo ? 'success' : 'neutral'}>
                {profile.activo ? t('profile.status.active') : t('profile.status.inactive')}
              </StatusPill>
            </View>
          </View>
          <View style={isCompact ? styles.heroButtonCompact : undefined}>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Icon name="pencil" size={14} color={semanticColors.action.secondaryFg} />}
              onPress={() => { blurActiveElement(); router.push('/profile/edit'); }}
            >
              {t('profile.menu.edit.label')}
            </Button>
          </View>
        </View>
      </View>

      <DemoEnvironmentNotice title={t('profile.demoNotice.title')} body={t('profile.demoNotice.overview')} />

      {/* 2+3. Summary + Options grid */}
      <View style={[styles.bodySection, isWide && styles.bodySectionWide]}>
        {/* Summary */}
        <View style={[styles.summaryCol, isWide && styles.summaryColWide]}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t('profile.summary.sectionTitle')}</Text>
            <PreferenceRow label={t('profile.summary.language')} value={languageValue} />
            <PreferenceRow label={t('profile.summary.notifications')} value={notificationsValue} />
            <PreferenceRow label={t('profile.summary.privacy')} value={t('profile.summary.privacyValue')} />
          </View>
        </View>

        {/* Options grid */}
        <View style={[styles.optionsCol, isWide && styles.optionsColWide]}>
          <View style={isWide ? styles.optionsGridWide : styles.optionsGridCompact}>
            <View style={isWide ? styles.optionItem : undefined}>
              <ProfileMenuItem compact={!isWide} icon="pencil" label={t('profile.menu.edit.label')} description={t('profile.menu.edit.description')} onPress={() => { blurActiveElement(); router.push('/profile/edit'); }} />
            </View>
            <View style={isWide ? styles.optionItem : undefined}>
              <ProfileMenuItem compact={!isWide} icon="bell" label={t('profile.menu.notifications.label')} description={t('profile.menu.notifications.description')} onPress={() => { blurActiveElement(); router.push('/profile/notifications'); }} />
            </View>
            <View style={isWide ? styles.optionItem : undefined}>
              <ProfileMenuItem compact={!isWide} icon="shield-check" label={t('profile.menu.privacy.label')} description={t('profile.menu.privacy.description')} onPress={() => { blurActiveElement(); router.push('/profile/privacy'); }} />
            </View>
            <View style={isWide ? styles.optionItem : undefined}>
              <ProfileMenuItem compact={!isWide} icon="help-circle" label={t('profile.menu.help.label')} description={t('profile.menu.help.description')} onPress={() => { blurActiveElement(); router.push('/profile/help'); }} />
            </View>
            <View style={isWide ? styles.optionItem : undefined}>
              <ProfileMenuItem compact={!isWide} icon="file-text" label={t('profile.menu.legal.label')} description={t('profile.menu.legal.description')} onPress={() => { blurActiveElement(); router.push('/profile/legal'); }} />
            </View>
            <View style={isWide ? styles.optionItem : undefined}>
              <ProfileMenuItem compact={!isWide} icon="settings" label={t('profile.menu.account.label')} description={t('profile.menu.account.description')} onPress={() => { blurActiveElement(); router.push('/profile/account'); }} />
            </View>
          </View>
        </View>
      </View>

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
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },

  /* ---- Hero ---- */
  hero: {
    backgroundColor: semanticColors.surface.sunken,
    borderRadius: radii.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  heroInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: semanticColors.action.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarInitials: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 26,
    color: semanticColors.action.primaryFg,
  },
  heroText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  heroName: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 24,
    letterSpacing: -0.4,
    lineHeight: 30,
    color: semanticColors.text.primary,
  },
  heroRole: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    color: semanticColors.text.secondary,
  },
  heroBadge: {
    flexDirection: 'row',
    marginTop: spacing.xxs,
  },
  heroInnerCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  heroTextCompact: {
    width: '100%',
    flexShrink: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  heroButtonCompact: {
    width: '100%',
    alignSelf: 'stretch',
  },

  /* ---- Body: summary + options ---- */
  bodySection: {
    gap: spacing.lg,
  },
  bodySectionWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
  },
  summaryCol: {
    gap: spacing.md,
  },
  summaryColWide: {
    width: 280,
    flexShrink: 0,
  },
  summaryCard: {
    gap: spacing.xxs,
    backgroundColor: semanticColors.surface.card,
    borderColor: semanticColors.border.default,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  summaryTitle: {
    fontFamily: typography.eyebrow.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: semanticColors.text.tertiary,
    marginBottom: spacing.xxs,
  },

  /* ---- Options grid ---- */
  optionsCol: {
    gap: spacing.md,
  },
  optionsColWide: {
    flex: 1,
    minWidth: 0,
  },
  optionsGrid: {
    gap: spacing.sm,
  },
  optionsGridCompact: {
    gap: spacing.sm,
  },
  optionsGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  optionItem: {
    flexGrow: 1,
    minWidth: 0,
    flexBasis: '45%',
  },

  /* ---- Footer ---- */
  version: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    color: semanticColors.text.tertiary,
  },
});
