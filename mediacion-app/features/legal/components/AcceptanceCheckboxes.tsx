import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Checkbox } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';

export type AcceptanceCheckboxesProps = {
  /** TyC + Privacidad — the mandatory one. Gates the caller's submit. */
  termsAccepted: boolean;
  onChangeTerms: (accepted: boolean) => void;
  /** Comunicaciones comerciales — optional; never blocks the caller. */
  marketingAccepted: boolean;
  onChangeMarketing: (accepted: boolean) => void;
  disabled?: boolean;
};

/**
 * Opens the legal page without losing what the user was typing: a new tab on
 * web (instructivo §2 — `target="_blank" rel="noopener"`), a pushed route on
 * native, where the form stays mounted underneath and back returns to it.
 */
function LegalLink({ href, children }: { href: '/terminos-y-condiciones' | '/politica-de-privacidad'; children?: ReactNode }) {
  return (
    <Link
      href={href}
      style={styles.link}
      {...(Platform.OS === 'web' ? { target: '_blank', rel: 'noopener' } : {})}
    >
      {children}
    </Link>
  );
}

/**
 * The two acceptance checkboxes of the instructivo TyC §2, in every
 * contracting point (signup, checkout):
 *
 * - Both start unchecked — callers own the state, and `Checkbox` itself has
 *   no way to render pre-ticked without the caller explicitly setting state.
 * - The checkbox is UI courtesy only. The proof of acceptance is the record
 *   the server writes, and the guarantee is the future DB constraint
 *   (docs/reparto-tyc-devs.md §00) — nothing here pretends otherwise.
 */
export function AcceptanceCheckboxes({
  termsAccepted,
  onChangeTerms,
  marketingAccepted,
  onChangeMarketing,
  disabled = false,
}: AcceptanceCheckboxesProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Checkbox
        checked={termsAccepted}
        onChange={onChangeTerms}
        disabled={disabled}
        accessibilityLabel={t('legal.acceptance.requiredA11yLabel')}
        label={
          <Text style={styles.labelText}>
            <Trans
              i18nKey="legal.acceptance.required"
              components={{
                terms: <LegalLink href="/terminos-y-condiciones" />,
                privacy: <LegalLink href="/politica-de-privacidad" />,
              }}
            />
          </Text>
        }
      />
      <Checkbox
        checked={marketingAccepted}
        onChange={onChangeMarketing}
        disabled={disabled}
        accessibilityLabel={t('legal.acceptance.marketingA11yLabel')}
        label={<Text style={styles.labelText}>{t('legal.acceptance.marketing')}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  labelText: {
    ...typography.bodySm,
    color: semanticColors.text.secondary,
  },
  link: {
    color: semanticColors.text.primary,
    textDecorationLine: 'underline',
  },
});
