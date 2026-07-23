import i18n from '../i18n';

/** Locale-aware timestamp for agreement/signature screens — accessible, readable dates rather than a raw ISO string. */
export function formatAgreementDate(iso: string): string {
  const locale = i18n.language === 'en' ? 'en-US' : 'es-AR';
  try {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}
