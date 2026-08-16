import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { ventanillaUnicaUrl } from '@/mocks/legal';
import { legalService } from '@/services/legal.service';
import type { CompanyInfo } from '@/types/legal';

/**
 * Datos societarios + canal de contacto + Ventanilla Única (Ley 24.240,
 * instructivo §5). Razón social, CUIT and domicilio come from data and are
 * still pending from Administración — while null, the card says so
 * explicitly instead of showing invented placeholders.
 *
 * The Ventanilla link is fixed by the instructivo and lives next to the
 * contact details, as required.
 */
export function CompanyDetails() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    legalService
      .getCompanyInfo()
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch(() => {
        // Non-blocking card: on failure it simply renders the pending state.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = t('legal.company.pendingValue');

  return (
    <Card>
      <Text style={styles.title} accessibilityRole="header">
        {t('legal.company.title')}
      </Text>

      <View style={styles.rows}>
        <Text style={styles.row}>
          {t('legal.company.razonSocial')}: {info?.razonSocial ?? pending}
        </Text>
        <Text style={styles.row}>CUIT: {info?.cuit ?? pending}</Text>
        <Text style={styles.row}>
          {t('legal.company.domicilio')}: {info?.domicilio ?? pending}
        </Text>
        <Text style={styles.row}>
          {t('legal.company.contacto')}: {info?.emailContacto ?? pending}
        </Text>
        <Text style={styles.row}>
          {t('legal.company.plazoRespuesta', { dias: info?.plazoRespuestaDias ?? 5 })}
        </Text>
      </View>

      <Text
        style={styles.ventanillaLink}
        accessibilityRole="link"
        onPress={() => {
          void Linking.openURL(ventanillaUnicaUrl);
        }}
      >
        {t('legal.company.ventanillaLabel')}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
    marginBottom: spacing.sm,
  },
  rows: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  row: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  ventanillaLink: {
    ...typography.bodySm,
    color: semanticColors.text.primary,
    textDecorationLine: 'underline',
  },
});
