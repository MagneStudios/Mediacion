import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';

const newTabProps = Platform.OS === 'web' ? ({ target: '_blank', rel: 'noopener' } as const) : {};

/**
 * Footer links to the legal pages (instructivo §1.2: "en el pie de página de
 * todas las páginas"). Mounted once in ResponsiveAppShell for the desktop
 * shell, and standalone on the auth screens — the only "site-like" pages the
 * narrow/native layout has, where no app shell wraps the content.
 *
 * The arrepentimiento link is here as reinforcement; its legally required
 * placement (first screen, no login) is on the login screen itself.
 */
export function LegalFooter() {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Link href="/terminos-y-condiciones" style={styles.link} {...newTabProps}>
        {t('legal.terms.title')}
      </Link>
      <Link href="/politica-de-privacidad" style={styles.link} {...newTabProps}>
        {t('legal.privacy.title')}
      </Link>
      <Link href="/arrepentimiento" style={styles.link} {...newTabProps}>
        {t('legal.withdrawal.linkLabel')}
      </Link>
      <Link href="/contacto" style={styles.link} {...newTabProps}>
        {t('legal.contact.linkLabel')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: spacing.lg,
    rowGap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  link: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
    textDecorationLine: 'underline',
  },
});
