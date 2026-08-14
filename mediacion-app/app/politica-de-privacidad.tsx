import { useTranslation } from 'react-i18next';

import { LegalDocumentScreen } from '@/features/legal/components/LegalDocumentScreen';

/**
 * Permanent public URL for the Política de Privacidad (instructivo §1.1).
 * Reachable without a session — see `publicRoutes` in AuthGate.
 */
export default function PoliticaDePrivacidadScreen() {
  const { t } = useTranslation();
  return <LegalDocumentScreen tipo="privacy" title={t('legal.privacy.title')} />;
}
