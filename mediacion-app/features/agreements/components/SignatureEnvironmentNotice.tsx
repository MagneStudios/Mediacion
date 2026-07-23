import { PrivacyNotice } from '../../cases/components/PrivacyNotice';

export type SignatureEnvironmentNoticeProps = {
  title: string;
  body: string;
};

/**
 * The mock-environment disclaimer required on every signature-related
 * screen — "Firma simulada" / "Entorno de prueba" wording, never a claim of
 * legal validity. Thin wrapper over the existing PrivacyNotice visual
 * treatment so this reads consistently with the rest of the app rather than
 * introducing a new banner style.
 */
export function SignatureEnvironmentNotice({ title, body }: SignatureEnvironmentNoticeProps) {
  return (
    <PrivacyNotice icon="info" title={title}>
      {body}
    </PrivacyNotice>
  );
}
