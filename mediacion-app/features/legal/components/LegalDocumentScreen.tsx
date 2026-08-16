import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { contentWidths, getResponsiveContentStyle } from '@/design-system/tokens/layout';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import i18n from '@/i18n';
import { legalService } from '@/services/legal.service';
import type { LegalDocument, LegalDocumentType } from '@/types/legal';

import { LegalDocumentBody } from './LegalDocumentBody';

export type LegalDocumentScreenProps = {
  tipo: LegalDocumentType;
  /** Screen + document title, already translated by the route. */
  title: string;
};

type FetchStatus = 'loading' | 'error' | 'empty' | 'success';

function formatUpdatedAt(iso: string): string {
  const locale = i18n.language === 'en' ? 'en-US' : 'es-AR';
  try {
    // UTC on purpose: `valid_from` marks the calendar day a version was
    // published. Formatted in local time, a midnight-UTC timestamp would
    // show the previous day anywhere west of Greenwich.
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * One frozen legal document as a permanent public page (instructivo §1: a
 * web page with its own URL — not a PDF, not a download). Everything shown —
 * text, version, and the "última actualización" date — comes from the
 * document data; nothing legal is hardcoded in this component.
 */
export function LegalDocumentScreen({ tipo, title }: LegalDocumentScreenProps) {
  const { t } = useTranslation();
  const { horizontalPadding, isWide } = useResponsiveLayout();

  const [status, setStatus] = useState<FetchStatus>('loading');
  const [document, setDocument] = useState<LegalDocument | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setStatus('loading');
    legalService
      .getCurrentDocument(tipo)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setStatus('empty');
          return;
        }
        setDocument(result);
        setStatus('success');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [tipo]);

  useEffect(() => load(), [load]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        getResponsiveContentStyle({ maxWidth: contentWidths.reading, horizontalPadding }),
      ]}
    >
      <Stack.Screen options={{ title }} />

      {status === 'loading' ? <LoadingState label={t('common.loading')} /> : null}

      {status === 'error' ? (
        <ErrorState title={t('legal.document.error.title')} retryLabel={t('common.retry')} onRetry={load} />
      ) : null}

      {status === 'empty' ? (
        <EmptyState title={t('legal.document.empty.title')} description={t('legal.document.empty.description')} />
      ) : null}

      {status === 'success' && document ? (
        <>
          <Text style={[styles.title, isWide ? styles.titleWide : null]} accessibilityRole="header">
            {title}
          </Text>
          {/* Instructivo §4.6: the last-updated date goes on top, visibly, and it comes from the data. */}
          <Text style={styles.updatedAt}>
            {t('legal.document.updatedAt', { date: formatUpdatedAt(document.validFrom) })}
          </Text>
          <Text style={styles.version}>{t('legal.document.versionLabel', { version: document.version })}</Text>
          <LegalDocumentBody contenido={document.contenido} />
        </>
      ) : null}
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
  },
  title: {
    ...typography.headline,
    color: semanticColors.text.primary,
    marginBottom: spacing.xs,
  },
  titleWide: {
    ...typography.displayLg,
  },
  updatedAt: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  version: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
    marginBottom: spacing.md,
  },
});
