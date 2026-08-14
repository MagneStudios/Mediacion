import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, Card, ErrorState, Input } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { CompanyDetails } from '@/features/legal/components/CompanyDetails';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import i18n from '@/i18n';
import { legalService } from '@/services/legal.service';
import type { WithdrawalRequestResult } from '@/types/legal';

type SubmitStatus = 'idle' | 'submitting' | 'error' | 'success';

function formatReceivedAt(iso: string): string {
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

/**
 * Botón de arrepentimiento (art. 34 Ley 24.240, arts. 1110–1116 CCyC, Res.
 * 424/2020; TyC cláusula O.1): revocation within 10 días corridos, free of
 * charge, reachable from the first screen WITHOUT registering or logging in
 * — this route is in AuthGate's public allowlist for exactly that reason.
 *
 * The registering endpoint is Backend's (docs/reparto-tyc-devs.md #18, not
 * built yet) — until then the mock records it in memory and this screen is
 * demo-only, like every other mocked flow in the app.
 */
export default function ArrepentimientoScreen() {
  const { t } = useTranslation();
  const { horizontalPadding, isWide } = useResponsiveLayout();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [detalle, setDetalle] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [receipt, setReceipt] = useState<WithdrawalRequestResult | null>(null);

  const canSubmit =
    nombre.trim().length > 0 && email.trim().length > 0 && detalle.trim().length > 0 && status !== 'submitting';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus('submitting');
    try {
      const result = await legalService.requestWithdrawal({
        nombre: nombre.trim(),
        email: email.trim(),
        detalle: detalle.trim(),
      });
      setReceipt(result);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

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

      {status === 'success' && receipt ? (
        <Card>
          <Text style={styles.successTitle} accessibilityRole="header">
            {t('legal.withdrawal.success.title')}
          </Text>
          <Text style={styles.successBody}>
            {t('legal.withdrawal.success.body', {
              id: receipt.id,
              date: formatReceivedAt(receipt.receivedAt),
            })}
          </Text>
        </Card>
      ) : (
        <>
          <Input
            label={t('legal.withdrawal.nombreLabel')}
            placeholder={t('legal.withdrawal.nombrePlaceholder')}
            value={nombre}
            onChangeText={setNombre}
            autoComplete="name"
            editable={status !== 'submitting'}
          />
          <Input
            label={t('auth.emailLabel')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={status !== 'submitting'}
          />
          <Input
            label={t('legal.withdrawal.detalleLabel')}
            hint={t('legal.withdrawal.detalleHint')}
            placeholder={t('legal.withdrawal.detallePlaceholder')}
            value={detalle}
            onChangeText={setDetalle}
            multiline
            editable={status !== 'submitting'}
          />

          {status === 'error' ? (
            <ErrorState
              title={t('legal.withdrawal.error.title')}
              retryLabel={t('common.retry')}
              onRetry={handleSubmit}
            />
          ) : null}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={status === 'submitting'}
            loadingLabel={t('common.loading')}
          >
            {t('legal.withdrawal.submitAction')}
          </Button>
        </>
      )}

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
  successTitle: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
    marginBottom: spacing.sm,
  },
  successBody: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
});
