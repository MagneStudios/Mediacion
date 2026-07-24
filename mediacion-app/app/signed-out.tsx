import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Icon, ScreenContainer } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { useAccountActions } from '@/features/profile/hooks/useAccountActions';
import { blurActiveElement } from '@/utils/blur-active-element';

/**
 * Demo-only "signed out" landing. Reached only via account.tsx's
 * dismissAll() + replace('/signed-out'), which leaves this as the sole
 * entry in the navigation stack — there is nothing beneath it to swipe or
 * press "back" into.
 */
export default function SignedOutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { restoreStatus, restoreSession } = useAccountActions();

  const handleReturn = async () => {
    const ok = await restoreSession();
    if (ok) {
      blurActiveElement();
      router.replace('/(tabs)');
    }
  };

  return (
    <ScreenContainer widthToken="form" centerVertically style={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.iconCircle}>
        <Icon name="log-out" size={26} color={semanticColors.text.secondary} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {t('profile.signedOut.title')}
      </Text>
      <Text style={styles.body}>{t('profile.signedOut.body')}</Text>

      {restoreStatus === 'error' ? (
        <ErrorState title={t('profile.signedOut.error.title')} retryLabel={t('profile.signedOut.error.retry')} onRetry={handleReturn} />
      ) : (
        <Button variant="primary" fullWidth onPress={handleReturn} disabled={restoreStatus === 'pending'}>
          {t('profile.signedOut.returnAction')}
        </Button>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface.sunken,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.headline.fontFamily,
    fontSize: 22,
    letterSpacing: -0.3,
    color: semanticColors.text.primary,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.bodySm.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    color: semanticColors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
