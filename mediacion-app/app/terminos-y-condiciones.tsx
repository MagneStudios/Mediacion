import { useTranslation } from 'react-i18next';

import { LegalDocumentScreen } from '@/features/legal/components/LegalDocumentScreen';

/**
 * Permanent public URL for the Términos y Condiciones (instructivo §1.1).
 * Reachable without a session — see `publicRoutes` in AuthGate.
 */
export default function TerminosYCondicionesScreen() {
  const { t } = useTranslation();
  return <LegalDocumentScreen tipo="terms" title={t('legal.terms.title')} />;
}
