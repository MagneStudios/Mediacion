/**
 * Presentation model for the authenticated party's own profile.
 *
 * BACKEND ALIGNMENT: `rol` mirrors `rol_usuario` (admin | parte | mediador |
 * estudio) and `activo` mirrors `usuarios.activo` exactly — a boolean only,
 * there is no multi-state account-status enum in the schema. `idioma`
 * mirrors `usuarios.idioma` ('es' | 'en') exactly and is NOT the i18n locale
 * code ('es-AR' | 'en'); see utils/map-language.ts for the one place that
 * translates between the two. `depuracionProgramadaAt` mirrors
 * `usuarios.depuracion_programada_at` (R-06, added post-reunión 07/08): the
 * date the anonymization job will run — the real backend column always
 * derives it from `usuarios.fecha_baja` (a real baja, +6 months by default),
 * but this mock has no `fecha_baja` field to derive it from, so it is
 * computed from `deactivationRequestedAt` instead — a documented
 * simplification, not a backend mirror of `fecha_baja` itself.
 *
 * `numeroMatricula`/`matriculaUrl` mirror `usuarios.numero_matricula` /
 * `usuarios.matricula_url` exactly (R-05, added post-reunión 07/08) — a
 * professional license number and a private-bucket attachment, neither
 * verified. `matriculaUrl` never holds a real file anywhere in this mock
 * (no file-picker dependency is installed): "attaching" one is simulated,
 * exactly like every other document/export action in this app (see
 * `AgreementExportAction`, `tasks.calendar`'s "preparar evento").
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
  /** R-06: set alongside `deactivationRequestedAt` — see the type-level doc comment for how this mock derives it. */
  depuracionProgramadaAt?: string;
  /** R-05: professional license number — optional, no format enforced (the backend doesn't define one either). */
  numeroMatricula?: string;
  /** R-05: set only once `uploadMatriculaAttachment` (profile.service.ts) "completes" — see the type-level doc comment. */
  matriculaUrl?: string;
};

export type UpdateProfileInput = Partial<
  Pick<
    MockProfile,
    | 'nombre'
    | 'apellido'
    | 'idioma'
    | 'communicationPreference'
    | 'accessibilityPreference'
    | 'numeroMatricula'
    | 'matriculaUrl'
  >
>;

/**
 * Persisted in `usuarios.preferencias_notificacion` and served by
 * `GET`/`PATCH /me/preferencias-notificacion`. A patch merges, so sending one
 * toggle leaves the rest untouched.
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
 * `depuracionProgramadaAt` (R-06) is set in the same commit as `requestedAt`
 * — see `MockProfile`'s doc comment for how this mock derives it.
 */
export type AccountActionResult =
  | { status: 'requested'; requestedAt: string; depuracionProgramadaAt: string }
  | { status: 'already_requested'; requestedAt: string; depuracionProgramadaAt: string };
