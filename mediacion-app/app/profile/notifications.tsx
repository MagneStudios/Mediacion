import { Stack } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Card, Divider, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { DemoEnvironmentNotice } from '@/features/profile/components/DemoEnvironmentNotice';
import { NotificationPreferenceRow } from '@/features/profile/components/NotificationPreferenceRow';
import { useNotificationPreferences } from '@/features/profile/hooks/useNotificationPreferences';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import type { NotificationPreferences } from '@/types/profile';

const CATEGORY_KEYS: (keyof NotificationPreferences)[] = [
  'caseUpdates',
  'proposalReady',
  'responseReceived',
  'signatureReady',
  'agreementCompleted',
  'mediatorAvailability',
  'productUpdates',
];

export default function ProfileNotificationsScreen() {
  const { t } = useTranslation();
  const { status, preferences, reload, updateStatus, togglePreference, retryLastToggle } = useNotificationPreferences();
  const { horizontalPadding, isWide } = useResponsiveLayout();

  if (status === 'error') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('profile.notifications.title') }} />
        <ErrorState title={t('states.error.title')} retryLabel={t('states.error.retry')} onRetry={reload} />
      </ScrollView>
    );
  }

  if (status === 'loading' || !preferences) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('profile.notifications.title') }} />
        <LoadingState label={t('common.loading')} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('profile.notifications.title') }} />

      <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
        {t('profile.notifications.title')}
      </Text>

      <DemoEnvironmentNotice title={t('profile.demoNotice.title')} body={t('profile.demoNotice.notifications')} />

      {updateStatus === 'error' ? (
        <ErrorState title={t('profile.notifications.error.title')} retryLabel={t('profile.notifications.error.retry')} onRetry={retryLastToggle} />
      ) : null}

      <Card style={styles.list}>
        {CATEGORY_KEYS.map((key, index) => (
          <Fragment key={key}>
            <NotificationPreferenceRow
              label={t(`profile.notifications.categories.${key}.label`)}
              description={t(`profile.notifications.categories.${key}.description`)}
              value={preferences[key]}
              onValueChange={() => togglePreference(key)}
              disabled={updateStatus === 'pending'}
            />
            {index < CATEGORY_KEYS.length - 1 ? <Divider tone="soft" /> : null}
          </Fragment>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  loadingContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  titleWide: {
    ...typography.displayLg,
  },
  list: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
});
