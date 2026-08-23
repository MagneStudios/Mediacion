import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Icon, LoadingState } from '@/design-system';
import { colors, semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { fontFamily, typography } from '@/design-system/tokens/typography';
import { usePaymentConfirmation } from '@/features/billing/hooks/usePaymentConfirmation';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { blurActiveElement } from '@/utils/blur-active-element';

/**
 * Where MercadoPago sends the user back after the subscription checkout — the
 * `back_url` of the preapproval (Pactum spec §6.3). The path is part of that
 * contract: it is configured on MercadoPago's side, so it cannot drift with
 * our navigation without BE changing the preapproval too.
 *
 * **This screen decides nothing.** The subscription is activated by the
 * webhook, not by the redirect (spec §6.3.5): the user can close the browser
 * the second after paying and it still has to activate. So the callback has
 * exactly one job — wait, visibly, while asking our own API whether the
 * webhook landed.
 *
 * It deliberately does not read the query string MercadoPago appends. Those
 * parameters are attacker-controlled, and a screen that believed
 * `?status=approved` would hand out a plan to anyone who typed the URL.
 *
 * There is no failure state here (spec §9.6). The money is already gone; if
 * the confirmation is slow, the honest thing to say is that it is slow, not
 * that something broke.
 */
export default function BillingCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  const { status, subscription } = usePaymentConfirmation();

  // Home, not Mi plan, and that is a workaround rather than a preference.
  // Client-side navigation from this route to `/profile/plan` lands on the
  // right URL but renders `/profile/edit` — reproduced with `replace`, `push`,
  // `navigate` and `<Link>` alike, with and without a group layout, on a clean
  // dev server. The `profile` group has no `index`, so its nested navigator
  // seems to fall back to another screen when it is mounted fresh from here;
  // the same push from `case/[id]/payment-required` works. Sending someone who
  // just paid to a profile form they did not ask for is worse than sending
  // them to the app, so this goes home until the routing defect is fixed —
  // written up in `docs/plan-frontend-monetizacion.md` §7.2.
  const goHome = () => {
    blurActiveElement();
    router.replace('/');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding }),
      ]}
    >
      <Stack.Screen
        options={{
          title: t('billing.callback.title'),
          headerStyle: { backgroundColor: colors.canvas },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fontFamily.semibold },
          headerShadowVisible: false,
        }}
      />

      {status === 'confirming' ? (
        <Card style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">
            {t('billing.callback.confirming.title')}
          </Text>
          <Text style={styles.body}>{t('billing.callback.confirming.body')}</Text>
          <LoadingState label={t('billing.callback.confirming.label')} />
        </Card>
      ) : null}

      {status === 'confirmed' ? (
        <Card style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name="shield-check" size={22} color={semanticColors.text.secondary} />
          </View>
          <Text style={styles.heading} accessibilityRole="header">
            {t('billing.callback.confirmed.title')}
          </Text>
          <Text style={styles.body}>{t('billing.callback.confirmed.body')}</Text>
          <Button variant="primary" size="lg" fullWidth onPress={goHome}>
            {t('billing.callback.goHomeAction')}
          </Button>
        </Card>
      ) : null}

      {status === 'stillPending' ? (
        <Card style={styles.card}>
          <Text style={styles.heading} accessibilityRole="header">
            {t('billing.callback.stillPending.title')}
          </Text>
          {/*
            Not an error and not a promise: the activation does finish on its
            own, and if it does not, the contact channel is a real one that
            somebody answers (punto #23 del instructivo). Saying "te avisamos"
            would commit to a notification nobody built.
          */}
          <Text style={styles.body}>{t('billing.callback.stillPending.body')}</Text>
          <Button variant="primary" size="lg" fullWidth onPress={goHome}>
            {t('billing.callback.goHomeAction')}
          </Button>
          <Button
            variant="tertiary"
            size="lg"
            fullWidth
            onPress={() => {
              blurActiveElement();
              router.push('/contacto');
            }}
          >
            {t('billing.callback.contactAction')}
          </Button>
        </Card>
      ) : null}

      {subscription ? <Text style={styles.reference}>{t('billing.callback.reference', { id: subscription.id })}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semanticColors.surface.canvas,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  iconWrap: {
    alignItems: 'flex-start',
  },
  heading: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  body: {
    ...typography.body,
    color: semanticColors.text.secondary,
  },
  reference: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
