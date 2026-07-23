/**
 * Presentation model for the authenticated party's own profile.
 *
 * BACKEND ALIGNMENT: `rol` mirrors `rol_usuario` (admin | parte | mediador |
 * estudio) and `activo` mirrors `usuarios.activo` exactly — a boolean only,
 * there is no multi-state account-status enum in the schema. `idioma`
 * mirrors `usuarios.idioma` ('es' | 'en') exactly and is NOT the i18n locale
 * code ('es-AR' | 'en'); see utils/map-language.ts for the one place that
 * translates between the two.
 *
 * FRONTEND-ONLY MOCK STATE (no backend equivalent exists yet — a future
 * backend-integration phase must not assume these fields persist as-is):
 * - communicationPreference
 * - accessibilityPreference
 * - deactivationRequestedAt
 *
 * Never included, by design: id, email, documento, telefono, password_hash,
 * verif_biometrica, estudio_id, tokens, or any auth claim.
 */
export type RolUsuario = 'admin' | 'parte' | 'mediador' | 'estudio';
export type PreferredLanguage = 'es' | 'en';
export type CommunicationPreference = 'email_summary' | 'in_app_only';
export type AccessibilityPreference = 'system_default' | 'larger_text_preference';

export type MockProfile = {
  nombre: string;
  apellido: string;
  rol: RolUsuario;
  idioma: PreferredLanguage;
  activo: boolean;
  communicationPreference: CommunicationPreference;
  accessibilityPreference: AccessibilityPreference;
  /** Presentation-only marker. Never toggles `activo` and never implies the backend received or acted on anything. */
  deactivationRequestedAt?: string;
};

export type UpdateProfileInput = Partial<
  Pick<MockProfile, 'nombre' | 'apellido' | 'idioma' | 'communicationPreference' | 'accessibilityPreference'>
>;

/**
 * FRONTEND-ONLY MOCK STATE: no backend table stores per-category
 * notification opt-ins today — `notificaciones` only logs already-sent
 * deliveries (`canal`, `evento`, `estado`). Every field below is a local
 * demonstration preference with no backend equivalent yet.
 */
export type NotificationPreferences = {
  caseUpdates: boolean;
  proposalReady: boolean;
  responseReceived: boolean;
  signatureReady: boolean;
  agreementCompleted: boolean;
  mediatorAvailability: boolean;
  productUpdates: boolean;
};

/**
 * Result of a mock account-deactivation request. Idempotent: a repeated call
 * always returns 'already_requested' with the original timestamp — never a
 * second mutation, never a new record. Never implies the backend received
 * the request or that any data was deleted or the account was deactivated.
 */
export type AccountActionResult =
  | { status: 'requested'; requestedAt: string }
  | { status: 'already_requested'; requestedAt: string };
