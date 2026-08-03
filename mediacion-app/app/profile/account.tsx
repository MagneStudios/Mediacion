import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { AccountActionCard } from '@/features/profile/components/AccountActionCard';
import { DeactivationDialog } from '@/features/profile/components/DeactivationDialog';
import { DemoEnvironmentNotice } from '@/features/profile/components/DemoEnvironmentNotice';
import { SignOutDialog } from '@/features/profile/components/SignOutDialog';
import { useAccountActions } from '@/features/profile/hooks/useAccountActions';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import i18n from '@/i18n';
import { blurActiveElement } from '@/utils/blur-active-element';

function formatRequestDate(iso: string): string {
  const locale = i18n.language === 'en' ? 'en-US' : 'es-AR';
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ProfileAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useProfile();
  const { horizontalPadding, isWide } = useResponsiveLayout();
  const {
    signOutStatus,
    signOut,
    resetSignOutStatus,
    deactivateStatus,
    deactivationResult,
    requestDeactivation,
    resetDeactivateStatus,
  } = useAccountActions();

  const [signOutDialogVisible, setSignOutDialogVisible] = useState(false);
  const [deactivationDialogVisible, setDeactivationDialogVisible] = useState(false);

  const requestedAt = deactivationResult?.requestedAt ?? profile?.deactivationRequestedAt;
  const alreadyRequested = Boolean(requestedAt);

  const openSignOutDialog = () => {
    resetSignOutStatus();
    setSignOutDialogVisible(true);
  };

  const confirmSignOut = async () => {
    const ok = await signOut();
    if (ok) {
      setSignOutDialogVisible(false);
      blurActiveElement();
      router.dismissAll();
      router.replace('/signed-out');
    }
  };

  const openDeactivationDialog = () => {
    resetDeactivateStatus();
    setDeactivationDialogVisible(true);
  };

  const confirmDeactivation = async () => {
    const result = await requestDeactivation();
    if (result) {
      setDeactivationDialogVisible(false);
    }
  };

  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('profile.account.title') }} />

      <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
        {t('profile.account.title')}
      </Text>

      <DemoEnvironmentNotice title={t('profile.demoNotice.title')} body={t('profile.demoNotice.account')} />

      <AccountActionCard title={t('profile.account.signOut.cardTitle')} description={t('profile.account.signOut.cardDescription')}>
        <Button variant="secondary" size="lg" fullWidth onPress={openSignOutDialog} style={styles.actionButton}>
          {t('profile.account.signOut.action')}
        </Button>
      </AccountActionCard>

      <AccountActionCard
        title={t('profile.account.deactivation.cardTitle')}
        description={t('profile.account.deactivation.cardDescription')}
        noticeText={alreadyRequested && requestedAt ? t('profile.account.deactivation.requestedNotice', { date: formatRequestDate(requestedAt) }) : undefined}
      >
        <Button
          variant={alreadyRequested ? 'tertiary' : 'destructive'}
          size="lg"
          fullWidth
          onPress={openDeactivationDialog}
          style={styles.actionButton}
        >
          {alreadyRequested ? t('profile.account.deactivation.viewStatusAction') : t('profile.account.deactivation.action')}
        </Button>
      </AccountActionCard>

      <Text style={styles.version}>{t('profile.account.versionLabel', { version: appVersion })}</Text>

      <SignOutDialog
        visible={signOutDialogVisible}
        status={signOutStatus}
        title={t('profile.account.signOut.dialogTitle')}
        body={t('profile.account.signOut.dialogBody')}
        confirmLabel={t('profile.account.signOut.confirm')}
        cancelLabel={t('profile.account.signOut.cancel')}
        errorTitle={t('profile.account.signOut.error.title')}
        retryLabel={t('profile.account.signOut.error.retry')}
        onConfirm={confirmSignOut}
        onCancel={() => {
          if (signOutStatus === 'pending') return;
          setSignOutDialogVisible(false);
        }}
      />

      <DeactivationDialog
        visible={deactivationDialogVisible}
        status={deactivateStatus}
        alreadyRequested={alreadyRequested}
        title={t('profile.account.deactivation.dialogTitle')}
        body={t('profile.account.deactivation.dialogBody')}
        alreadyRequestedTitle={t('profile.account.deactivation.alreadyRequestedTitle')}
        alreadyRequestedBody={requestedAt ? t('profile.account.deactivation.alreadyRequestedBody', { date: formatRequestDate(requestedAt) }) : ''}
        confirmLabel={t('profile.account.deactivation.confirm')}
        cancelLabel={t('profile.account.deactivation.cancel')}
        closeLabel={t('profile.account.deactivation.close')}
        errorTitle={t('profile.account.deactivation.error.title')}
        retryLabel={t('profile.account.deactivation.error.retry')}
        onConfirm={confirmDeactivation}
        onCancel={() => {
          if (deactivateStatus === 'pending') return;
          setDeactivationDialogVisible(false);
        }}
        onClose={() => setDeactivationDialogVisible(false)}
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
  actionButton: {
    marginTop: spacing.xs,
  },
  version: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
});
