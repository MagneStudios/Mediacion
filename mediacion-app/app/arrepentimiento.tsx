import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { CompanyDetails } from '@/features/legal/components/CompanyDetails';
import { PublicRequestForm } from '@/features/legal/components/PublicRequestForm';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { legalService } from '@/services/legal.service';
import { blurActiveElement } from '@/utils/blur-active-element';

/**
 * Botón de arrepentimiento (art. 34 Ley 24.240, arts. 1110–1116 CCyC, Res.
 * 424/2020; TyC cláusula O.1): revocation within 10 días corridos, free of
 * charge, reachable from the first screen WITHOUT registering or logging in
 * — this route is in AuthGate's public allowlist for exactly that reason.
 *
 * Backed by `POST /legal/arrepentimiento`, which registers the request,
 * notifies Operaciones and returns the `ARR-nnnn` tracking code.
 */
export default function ArrepentimientoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding, isWide } = useResponsiveLayout();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding }),
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: t('legal.withdrawal.title') }} />

      <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
        {t('legal.withdrawal.title')}
      </Text>
      <Text style={styles.description}>{t('legal.withdrawal.description')}</Text>

      <PublicRequestForm
        nombreLabel={t('legal.withdrawal.nombreLabel')}
        nombrePlaceholder={t('legal.withdrawal.nombrePlaceholder')}
        emailLabel={t('auth.emailLabel')}
        emailPlaceholder={t('auth.emailPlaceholder')}
        messageLabel={t('legal.withdrawal.detalleLabel')}
        messageHint={t('legal.withdrawal.detalleHint')}
        messagePlaceholder={t('legal.withdrawal.detallePlaceholder')}
        submitLabel={t('legal.withdrawal.submitAction')}
        submittingLabel={t('common.loading')}
        errorTitle={t('legal.withdrawal.error.title')}
        retryLabel={t('common.retry')}
        successTitle={t('legal.withdrawal.success.title')}
        buildSuccessBody={({ id, date }) => t('legal.withdrawal.success.body', { id, date })}
        onSubmit={({ nombre, email, mensaje }) =>
          legalService.requestWithdrawal({ nombre, email, detalle: mensaje })
        }
      />

      {/* Revoking is not the only reason someone lands here — the general
          channel is one tap away rather than back through the footer. */}
      <CompanyDetails
        contactActionLabel={t('legal.contact.linkLabel')}
        onContactPress={() => {
          blurActiveElement();
          router.push('/contacto');
        }}
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
    gap: spacing.md,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  titleWide: {
    ...typography.displayLg,
  },
  description: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
