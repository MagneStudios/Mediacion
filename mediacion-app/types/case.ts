/**
 * Domain types for the mobile "Casos" feature. Value unions mirror the names
 * already defined in the Supabase schema (`mediacion.dbml` / rol_usuario,
 * estado_caso, metodo_caso, tipo_invitacion, estado_invitacion) so the
 * eventual switch to the real API is a type-compatible drop-in — but this
 * file is a standalone declaration; it does not import from
 * packages/db-types or apps/api, and nothing here assumes an endpoint shape
 * that doesn't exist yet. Round/proposal enums (estado_ronda,
 * estado_propuesta, decision_propuesta) live in types/negotiation.ts.
 */

export type RolUsuario = 'admin' | 'parte' | 'mediador' | 'estudio';

export type EstadoCaso =
  | 'nuevo'
  | 'activo'
  | 'en_negociacion'
  | 'acordado'
  | 'cerrado'
  | 'terminado'
  | 'vencido'
  | 'expirado';

/** Resolution method chosen for a case. Matches the `metodo_caso` enum. */
export type MetodoCaso = 'negociacion' | 'conciliacion' | 'mediacion';

/** Invitation delivery method. Matches the `tipo_invitacion` enum. */
export type TipoInvitacion = 'link' | 'codigo' | 'email';

/** Invitation lifecycle. Matches the `estado_invitacion` enum. */
export type EstadoInvitacion = 'pendiente' | 'aceptada' | 'rechazada' | 'expirada';

/**
 * R-07 (cambios reunión 07/08): who owes the subscription payment tied to
 * this invitation. Matches `invitaciones.pago_a_cargo` exactly. Set once,
 * at invitation-creation time — never changed afterward.
 */
export type PagoACargo = 'invitador' | 'invitado';

/** Visual status vocabulary consumed by <StatusPill />. Never the source of truth for case state — only a presentation mapping. */
export type CaseVisualStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'ai';

/**
 * Which neutral, shared-safe label a case card shows right now. This is a
 * product-level presentation decision (what the party needs to know next),
 * not a 1:1 mirror of `estado` — two cases can share the same `estado` and
 * show a different label depending on what's pending for this party.
 * Keys match `cases.status.*` in the i18n resources.
 */
export type CaseStatusLabelKey = 'inReview' | 'proposalReady' | 'signed' | 'awaitingCounterparty' | 'expired';

export type CaseSummary = {
  id: string;
  title: string;
  /** null until a counterparty has joined the case (estado === 'nuevo'). */
  counterpartyName: string | null;
  estado: EstadoCaso;
  metodo: MetodoCaso;
  roundNumber: number | null;
  visualStatus: CaseVisualStatus;
  statusLabelKey: CaseStatusLabelKey;
  slaHours: number | null;
};

export type CaseDetail = CaseSummary & {
  caseCode: string;
  descripcion?: string;
};

export type CaseInvitation = {
  id: string;
  caseId: string;
  tipo: TipoInvitacion;
  /** Present for link/codigo, null for email. Never logged. */
  token: string | null;
  emailDestino: string | null;
  estado: EstadoInvitacion;
  /**
   * `null` when the invitation was read back from the server rather than
   * created in this session: `GET /casos/:id/invitaciones` does not select
   * `pago_a_cargo` (the column exists — `20260810120000_cambios_reunion_07_08.sql`
   * — but `InvitacionView` omits it). Nullable rather than defaulted, because
   * guessing `'invitador'` for an invitation whose invitador chose "paga la
   * otra parte" would put the wrong party in front of a paywall. Pedido a BE
   * en `docs/pedidos-frontend-a-backend.md` §8; el día que lo agreguen, vuelve
   * a ser no-nullable.
   */
  pagoACargo: PagoACargo | null;
  createdAt: string;
};

export type CreateCaseInput = {
  nombre: string;
  descripcion?: string;
  metodo: MetodoCaso;
};

export type CreateInvitationInput = {
  casoId: string;
  tipo: TipoInvitacion;
  emailDestino?: string;
  pagoACargo: PagoACargo;
};
