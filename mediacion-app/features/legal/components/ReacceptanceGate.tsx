import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { legalService } from '@/services/legal.service';
import type { LegalDocument } from '@/types/legal';

import { LegalDocumentBody } from './LegalDocumentBody';

type GateStatus = 'checking' | 'open' | 'blocking';
type AcceptStatus = 'idle' | 'submitting' | 'error';

/**
 * Blocking re-acceptance for substantial TyC changes (instructivo §4.9,
 * reparto FE #16): when the current version is marked substantial and this
 * user has not accepted it, the app is covered by a full overlay showing the
 * plain-language summary of what changed plus the complete new text, and
 * nothing else is reachable until the user accepts.
 *
 * Fails open on the status check: this gate is UI enforcement of a rule
 * whose real guarantee is the DB constraint (reparto #11) — a network error
 * here must not brick the whole app.
 *
 * With today's mock data (v1.0, `isSubstantial: false`, nothing published
 * over it) the gate never blocks; it activates the day a substantial version
 * ships. Tests exercise the blocking path by mutating the mock.
 */
export function ReacceptanceGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { horizontalPadding } = useResponsiveLayout();

  const [status, setStatus] = useState<GateStatus>('checking');
  const [pendingDocument, setPendingDocument] = useState<LegalDocument | null>(null);
  const [acceptStatus, setAcceptStatus] = useState<AcceptStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    legalService
      .getAcceptanceStatus()
      .then(async (result) => {
        if (cancelled) return;
        if (!result.requiereReaceptacion || result.pendientes.length === 0) {
          setStatus('open');
          return;
        }
        const document = await legalService.getCurrentDocument(result.pendientes[0]);
        if (cancelled) return;
        setPendingDocument(document ?? null);
        setStatus(document ? 'blocking' : 'open');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('open');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = useCallback(async () => {
    setAcceptStatus('submitting');
    try {
      // No `marketing` field on purpose: re-accepting a new version must not
      // rewrite the marketing choice the user made at signup.
      await legalService.registerAcceptance({});
      setStatus('open');
      setAcceptStatus('idle');
    } catch {
      setAcceptStatus('error');
    }
  }, []);

  // While checking, the app renders normally — flashing a blank screen on
  // every cold start for a check that almost always passes would punish
  // everyone for a rare event. A user who slips a tap in before a `blocking`
  // result is still stopped: the overlay mounts above everything.
  if (status !== 'blocking' || !pendingDocument) {
    return <>{children}</>;
  }

  return (
    <View style={styles.overlayHost}>
      {children}
      <View style={styles.overlay} accessibilityViewIsModal>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            getResponsiveContentStyle({ maxWidth: contentWidths.reading, horizontalPadding }),
          ]}
        >
          <Text style={styles.title} accessibilityRole="header">
            {t('legal.reacceptance.title')}
          </Text>
          <Text style={styles.description}>{t('legal.reacceptance.description')}</Text>

          {pendingDocument.resumenCambios ? (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle} accessibilityRole="header">
                {t('legal.reacceptance.summaryTitle')}
              </Text>
              <Text style={styles.summaryBody}>{pendingDocument.resumenCambios}</Text>
            </View>
          ) : null}

          <LegalDocumentBody contenido={pendingDocument.contenido} />

          {acceptStatus === 'error' ? (
            <ErrorState
              title={t('legal.reacceptance.error.title')}
              retryLabel={t('common.retry')}
              onRetry={accept}
            />
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={accept}
              loading={acceptStatus === 'submitting'}
              loadingLabel={t('common.loading')}
            >
              {t('legal.reacceptance.acceptAction')}
            </Button>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayHost: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: semanticColors.surface.canvas,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
  },
  description: {
    ...typography.body,
    color: semanticColors.text.secondary,
  },
  summaryBox: {
    backgroundColor: semanticColors.surface.supportAqua,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryTitle: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  summaryBody: {
    ...typography.body,
    color: semanticColors.text.secondary,
  },
});
