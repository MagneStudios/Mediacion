import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { AgreementExportAction, type AgreementExportActionStatus } from '@/features/agreements/components/AgreementExportAction';
import { TaxBreakdownSummary } from '@/features/billing/components/TaxBreakdownSummary';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { billingService } from '@/services/billing.service';
import type { MockInvoice } from '@/types/billing';
import { blurActiveElement } from '@/utils/blur-active-element';

type FetchStatus = 'loading' | 'error' | 'success';

export default function PlanReceiptScreen() {
  const { subscriptionId } = useLocalSearchParams<{ subscriptionId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();

  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('loading');
  const [invoice, setInvoice] = useState<MockInvoice | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<AgreementExportActionStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    setFetchStatus('loading');
    billingService
      .getInvoiceForSubscription(subscriptionId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setFetchStatus('error');
          return;
        }
        setInvoice(result);
        setFetchStatus('success');
      })
      .catch(() => {
        if (cancelled) return;
        setFetchStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [subscriptionId]);

  if (fetchStatus === 'loading') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('billing.receipt.title') }} />
        <LoadingState label={t('common.loading')} />
      </ScrollView>
    );
  }

  if (fetchStatus === 'error' || !invoice) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loadingContent}>
        <Stack.Screen options={{ title: t('billing.receipt.title') }} />
        <ErrorState
          title={t('billing.receipt.notFound.title')}
          retryLabel={t('common.back')}
          onRetry={() => {
            blurActiveElement();
            router.back();
          }}
        />
      </ScrollView>
    );
  }

  const handleDownload = async () => {
    if (downloadStatus === 'pending') return;
    setDownloadStatus('pending');
    try {
      await billingService.prepareInvoiceDownload(invoice.id);
      setDownloadStatus('success');
    } catch {
      setDownloadStatus('error');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, getResponsiveContentStyle({ maxWidth: contentWidths.form, horizontalPadding })]}
    >
      <Stack.Screen options={{ title: t('billing.receipt.title') }} />

      <Text style={styles.title} accessibilityRole="header">
        {t('billing.receipt.title')}
      </Text>
      <Text style={styles.description}>{t('billing.receipt.description')}</Text>

      <TaxBreakdownSummary
        breakdown={{ neto: invoice.neto, iva: invoice.iva, otrosImpuestos: invoice.impuestos, total: invoice.total }}
        netoLabel={t('billing.checkout.breakdown.neto')}
        ivaLabel={t('billing.checkout.breakdown.iva')}
        otrosImpuestosLabel={t('billing.checkout.breakdown.otrosImpuestos')}
        totalLabel={t('billing.checkout.breakdown.total')}
      />

      {/* R-09: numero/cae stay null until real ARCA credentials exist (decisiones-db doc, "pendientes no-bloqueantes") — never fabricated here. */}
      {invoice.numero ? <Text style={styles.meta}>{t('billing.receipt.numero', { numero: invoice.numero })}</Text> : null}

      <AgreementExportAction
        status={downloadStatus}
        onExport={handleDownload}
        actionLabel={t('billing.receipt.downloadAction')}
        exportingTitle={t('billing.receipt.downloading.title')}
        exportingBody={t('billing.receipt.downloading.body')}
        successTitle={t('billing.receipt.downloadSuccess.title')}
        successBody={t('billing.receipt.downloadSuccess.body')}
        errorTitle={t('billing.receipt.downloadError.title')}
        retryLabel={t('common.retry')}
      />

      <Button
        variant="secondary"
        size="lg"
        fullWidth
        onPress={() => {
          blurActiveElement();
          router.push('/profile/plan');
        }}
      >
        {t('billing.receipt.backToPlanAction')}
      </Button>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  description: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
    marginTop: -spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
});
