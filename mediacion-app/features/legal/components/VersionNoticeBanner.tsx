import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';
import i18n from '@/i18n';
import { legalService } from '@/services/legal.service';
import type { LegalDocument, LegalDocumentType } from '@/types/legal';
import { formatLegalDate } from '@/utils/format-legal-date';

import { LegalDocumentBody } from './LegalDocumentBody';

const documentTypes: LegalDocumentType[] = ['terms', 'privacy'];

/**
 * In-product notice of a scheduled version change (instructivo §4.8, reparto
 * FE #16). The instructivo asks for the change to be announced "con
 * anticipación razonable —como mínimo 10 días— por email a todos los usuarios
 * activos y con un aviso dentro del producto": BE's `legal-avisos.scheduler`
 * sends the email, this is the in-product half.
 *
 * It is the *non*-blocking counterpart of `ReacceptanceGate`: this announces a
 * version that has not taken effect yet, the gate blocks once it has. They
 * never both apply to the same version, because they read disjoint sets —
 * `getScheduledDocument` filters `validFrom > now`, `getCurrentDocument`
 * filters `validFrom <= now`. So a notice disappears on its own the day its
 * version starts applying, and the gate takes over from there.
 *
 * **Every scheduled document gets its own notice.** Announcing only the
 * nearest one silently dropped the other whenever both were scheduled for the
 * same day — which is the normal shape of a legal revision, since Términos and
 * Privacidad are usually rewritten together. With equal `validFrom` the sort is
 * stable, so `terms` would always win and the privacy change would never be
 * announced in advance at all: it would surface only once already in force,
 * which is exactly what the 10-day notice exists to prevent.
 *
 * The full new text travels with each notice, so "leer el texto nuevo" expands
 * in place instead of navigating: the public page renders the version *in
 * force*, which is still the old one while these are up.
 *
 * Fails closed on read errors — no banner rather than an error state. This is
 * an announcement, not a screen; a broken announcement must not be the first
 * thing a user sees, and the email is the other half of the same obligation.
 *
 * Dismissal is per document and lives in component state, so it lasts the
 * session and the notice comes back on the next cold start. Persisting it would
 * silence a legally required announcement for good on the strength of one tap,
 * and sharing one flag across documents would let a tap on one announcement
 * bury a different one.
 */
export function VersionNoticeBanner() {
  // The stack renders above the navigator, so no screen header is paying for
  // its insets: without this the title of a legally required notice sits
  // behind the notch or the translucent status bar.
  const insets = useSafeAreaInsets();

  const [scheduled, setScheduled] = useState<LegalDocument[]>([]);
  const [dismissed, setDismissed] = useState<LegalDocumentType[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      documentTypes.map((tipo) =>
        legalService.getScheduledDocument(tipo).catch(() => undefined),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        setScheduled(
          results
            .filter(
              (document): document is LegalDocument =>
                // A dateless document is not announceable: "we are changing the
                // terms, at some point" is worse than staying quiet, and a NaN
                // would also poison the comparator below.
                document !== undefined &&
                !Number.isNaN(Date.parse(document.validFrom ?? '')),
            )
            // Nearest first: the change that starts applying sooner is the one
            // that needs to be read first.
            .sort(
              (first, second) =>
                Date.parse(first.validFrom ?? '') - Date.parse(second.validFrom ?? ''),
            ),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setScheduled([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = scheduled.filter((document) => !dismissed.includes(document.tipo));
  if (visible.length === 0) {
    // Nothing at all, not an empty spacer: the stack carries the top inset, so
    // an empty container would push every screen down for no announcement.
    return null;
  }

  return (
    <View style={[styles.stack, { marginTop: insets.top + spacing.md }]}>
      {visible.map((document) => (
        <VersionNotice
          key={document.tipo}
          document={document}
          onDismiss={() =>
            setDismissed((current) =>
              current.includes(document.tipo) ? current : [...current, document.tipo],
            )
          }
        />
      ))}
    </View>
  );
}

function VersionNotice({
  document,
  onDismiss,
}: {
  document: LegalDocument;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.title} accessibilityRole="header">
        {t(`legal.versionNotice.title.${document.tipo}`)}
      </Text>
      <Text style={styles.effective}>
        {t('legal.versionNotice.effectiveFrom', {
          date: formatLegalDate(document.validFrom, i18n.language),
        })}
      </Text>
      {document.resumenCambios ? (
        <Text style={styles.summary}>
          {t('legal.versionNotice.summary', { summary: document.resumenCambios })}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => setExpanded((current) => !current)}
        >
          {expanded
            ? t('legal.versionNotice.hideAction')
            : t('legal.versionNotice.readAction')}
        </Button>
        <Button variant="tertiary" size="sm" onPress={onDismiss}>
          {t('legal.versionNotice.dismissAction')}
        </Button>
      </View>

      {expanded ? (
        <ScrollView style={styles.textScroll}>
          <LegalDocumentBody contenido={document.contenido} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const expandedTextMaxHeight = 320;

const styles = StyleSheet.create({
  stack: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  banner: {
    backgroundColor: semanticColors.surface.supportAqua,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
  },
  effective: {
    ...typography.body,
    color: semanticColors.text.primary,
  },
  summary: {
    ...typography.body,
    color: semanticColors.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  textScroll: {
    maxHeight: expandedTextMaxHeight,
  },
});
