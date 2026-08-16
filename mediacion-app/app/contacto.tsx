import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
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

const fallbackPlazoDias = 5;

/**
 * Canal de contacto (instructivo §5, punto #23 del reparto — BE + FE).
 *
 * Public on purpose: the requirement is a channel someone can actually
 * reach, and a consumer with a complaint may have no account, or may have
 * closed it. Backed by `POST /legal/contacto`, which records the entry date
 * — that timestamp is what makes the declared response time auditable.
 *
 * The declared deadline is shown before the form, not buried under it: the
 * instructivo asks for a channel "con un plazo de respuesta declarado", and
 * a promise the user only reads after writing is not a declaration.
 */
export default function ContactoScreen() {
  const { t } = useTranslation();
  const { horizontalPadding, isWide } = useResponsiveLayout();
  const [plazoDias, setPlazoDias] = useState(fallbackPlazoDias);

  useEffect(() => {
    let cancelled = false;
    legalService
      .getCompanyInfo()
      .then((info) => {
        if (!cancelled) setPlazoDias(info.plazoRespuestaDias);
      })
      .catch(() => {
        // Non-blocking: the form still works, and the fallback deadline is
        // the same value the company record carries today.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding }),
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: t('legal.contact.title') }} />

      <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
        {t('legal.contact.title')}
      </Text>
      <Text style={styles.description}>{t('legal.contact.description')}</Text>
      <Text style={styles.plazo}>{t('legal.contact.plazo', { dias: plazoDias })}</Text>

      <PublicRequestForm
        nombreLabel={t('legal.contact.nombreLabel')}
        nombrePlaceholder={t('legal.contact.nombrePlaceholder')}
        emailLabel={t('auth.emailLabel')}
        emailPlaceholder={t('auth.emailPlaceholder')}
        messageLabel={t('legal.contact.mensajeLabel')}
        messageHint={t('legal.contact.mensajeHint')}
        messagePlaceholder={t('legal.contact.mensajePlaceholder')}
        submitLabel={t('legal.contact.submitAction')}
        submittingLabel={t('common.loading')}
        errorTitle={t('legal.contact.error.title')}
        retryLabel={t('common.retry')}
        successTitle={t('legal.contact.success.title')}
        buildSuccessBody={({ id, date }) =>
          t('legal.contact.success.body', { id, date, dias: plazoDias })
        }
        onSubmit={({ nombre, email, mensaje }) => legalService.requestContact({ nombre, email, mensaje })}
      />

      <CompanyDetails />
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
  plazo: {
    ...typography.bodySm,
    color: semanticColors.text.primary,
  },
});
