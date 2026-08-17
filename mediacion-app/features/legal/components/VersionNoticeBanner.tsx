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
 * filters `validFrom <= now`. So the banner disappears on its own the day the
 * version starts applying, and the gate takes over from there.
 *
 * The full new text travels with the notice, so "leer el texto nuevo" expands
 * in place instead of navigating: the public page renders the version *in
 * force*, which is still the old one while this banner is up.
 *
 * Fails closed on read errors — no banner rather than an error state. This is
 * an announcement, not a screen; a broken announcement must not be the first
 * thing a user sees, and the email is the other half of the same obligation.
 *
 * Dismissal lives in component state, so it lasts the session and the notice
 * comes back on the next cold start. Persisting it would silence a legally
 * required announcement for good on the strength of one tap.
 */
export function VersionNoticeBanner() {
  const { t } = useTranslation();
  // The banner renders above the navigator, so no screen header is paying for
  // its insets: without this the title of a legally required notice sits
  // behind the notch or the translucent status bar.
  const insets = useSafeAreaInsets();

  const [scheduled, setScheduled] = useState<LegalDocument | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      documentTypes.map((tipo) =>
        legalService.getScheduledDocument(tipo).catch(() => undefined),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        // The nearest one first: with two changes pending, the one that starts
        // applying sooner is the one worth announcing now.
        const [nearest] = results
          .filter(
            (document): document is LegalDocument =>
              // A dateless document is not announceable: "we are changing the
              // terms, at some point" is worse than staying quiet, and a NaN
              // would also poison the comparator and let it win the sort.
              document !== undefined &&
              !Number.isNaN(Date.parse(document.validFrom ?? '')),
          )
          .sort(
            (first, second) =>
              Date.parse(first.validFrom ?? '') - Date.parse(second.validFrom ?? ''),
          );
        setScheduled(nearest ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setScheduled(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!scheduled || dismissed) {
    return null;
  }

  const effectiveDate = formatLegalDate(scheduled.validFrom, i18n.language);

  return (
    <View
      style={[styles.banner, { marginTop: insets.top + spacing.md }]}
      accessibilityRole="alert"
    >
      <Text style={styles.title} accessibilityRole="header">
        {t(`legal.versionNotice.title.${scheduled.tipo}`)}
      </Text>
      <Text style={styles.effective}>
        {t('legal.versionNotice.effectiveFrom', { date: effectiveDate })}
      </Text>
      {scheduled.resumenCambios ? (
        <Text style={styles.summary}>
          {t('legal.versionNotice.summary', { summary: scheduled.resumenCambios })}
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
        <Button variant="tertiary" size="sm" onPress={() => setDismissed(true)}>
          {t('legal.versionNotice.dismissAction')}
        </Button>
      </View>

      {expanded ? (
        <ScrollView style={styles.textScroll}>
          <LegalDocumentBody contenido={scheduled.contenido} />
        </ScrollView>
      ) : null}
    </View>
  );
}

const expandedTextMaxHeight = 320;

const styles = StyleSheet.create({
  banner: {
    backgroundColor: semanticColors.surface.supportAqua,
    borderRadius: radii.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
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
