import { useCallback, useEffect, useRef, useState } from 'react';
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
import { legalDocumentTypes, type LegalDocument } from '@/types/legal';

import { scheduleValidFromRecheck } from '../valid-from-recheck';
import { LegalDocumentBody } from './LegalDocumentBody';

type GateStatus = 'checking' | 'open' | 'blocking';
type AcceptStatus = 'idle' | 'submitting' | 'error';

/**
 * When the scheduled reads return documents but this clock considers none of
 * them future (a client clock running behind the server's), the nearest-future
 * pick has nothing to arm on. Instead of silently never re-checking, retry on
 * this short grace delay until the clocks agree or the read empties out.
 */
const clockSkewGraceDelayMs = 60 * 1000;

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
 *
 * The check runs again when a scheduled version enters into force: after each
 * check, the scheduled reads name the nearest future `validFrom`, and a timer
 * (clamped and re-armed by `scheduleValidFromRecheck`) re-runs
 * `getAcceptanceStatus` when it passes — otherwise a long-lived web tab keeps
 * an open gate while the banner's version is already in force. A failure on
 * that path just means no re-check while the gate is not blocking: fail open,
 * never *start* blocking on an error. But once the gate IS blocking, an error
 * on a re-check keeps it blocking — a transient network failure must not
 * dissolve a mandatory re-acceptance the gate already established.
 */
export function ReacceptanceGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { horizontalPadding } = useResponsiveLayout();

  const [status, setStatus] = useState<GateStatus>('checking');
  const [pendingDocument, setPendingDocument] = useState<LegalDocument | null>(null);
  const [acceptStatus, setAcceptStatus] = useState<AcceptStatus>('idle');
  const [checkKey, setCheckKey] = useState(0);

  // Read by the timer callback below: a re-check that lands mid-`accept()`
  // would race the acceptance it is about to record. Refs, not state, because
  // the timer closure must see the CURRENT value, not the one it closed over.
  const acceptStatusRef = useRef<AcceptStatus>('idle');
  acceptStatusRef.current = acceptStatus;

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
        // Fail open only while no blocking was established: an error on the
        // very check that would have blocked must not brick the app. An error
        // on a RE-check of an already-blocking gate keeps the block — a
        // transient failure must not dissolve a mandatory re-acceptance.
        setStatus((current) => (current === 'blocking' ? current : 'open'));
      });
    return () => {
      cancelled = true;
    };
  }, [checkKey]);

  useEffect(() => {
    let cancelled = false;
    let cancelTimer: (() => void) | null = null;
    // A due timer never re-checks over an `accept()` still in flight: the
    // check would race the acceptance it is about to record. The skipped
    // re-check is not lost — `accept()` resolves into either an unblocked
    // gate or a retry, and the next armed timer reads a settled status.
    const requestRecheck = () => {
      if (acceptStatusRef.current === 'submitting') {
        return;
      }
      setCheckKey((current) => current + 1);
    };
    Promise.all(
      legalDocumentTypes.map((tipo) =>
        legalService.getScheduledDocument(tipo).catch(() => undefined),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        // Only a version still in the future warrants a real timer: one
        // already in force was covered by the check that just ran, and
        // re-arming on it would re-check in a tight loop.
        const nearest = results
          .map((document) => Date.parse(document?.validFrom ?? ''))
          .filter((timestamp) => !Number.isNaN(timestamp) && timestamp > Date.now())
          .sort((first, second) => first - second)[0];
        if (nearest === undefined) {
          // Scheduled documents whose validFrom this clock already considers
          // past (a client clock running behind the server's): re-check on a
          // short grace delay instead of never re-checking — the loop ends
          // when the read empties out or the clocks agree.
          if (results.some((document) => document !== undefined)) {
            cancelTimer = scheduleValidFromRecheck(
              Date.now() + clockSkewGraceDelayMs,
              requestRecheck,
            );
          }
          return;
        }
        cancelTimer = scheduleValidFromRecheck(nearest, requestRecheck);
      })
      // An error reading the scheduled versions only means no re-check is
      // armed — it never blocks anything.
      .catch(() => undefined);
    return () => {
      cancelled = true;
      cancelTimer?.();
    };
  }, [checkKey]);

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
