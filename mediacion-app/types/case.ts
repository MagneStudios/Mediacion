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
  /**
   * C-01: el caso no puede abrirse porque alguna de las dos partes en disputa
   * no tiene la suscripción al día. Es la opción A que el cliente eligió el
   * 01/09/2026 —cada parte paga la suya— implementada en DB como un gate:
   * `trg_casos_gate_suscripciones` bloquea la transición a
   * `activo`/`en_negociacion` mientras el verificador dé false
   * (`20260902120000_c01_gate_suscripciones.sql`).
   *
   * El mediador no cuenta: no paga suscripción y se suma recién en ronda 3,
   * así que nunca es el que bloquea.
   */
  | 'pendiente_suscripciones'
  | 'activo'
  | 'en_negociacion'
  | 'acordado'
  | 'cerrado'
  | 'terminado'
  | 'vencido'
  | 'expirado';

/** Resolution method chosen for a case. Matches the `metodo_caso` enum. */
export type MetodoCaso = 'negociacion' | 'conciliacion' | 'mediacion';

/**
 * C-04 (cambios cliente 27/08): the order every surface must present the
 * methods in — ascending degree of third-party involvement in the process.
 * Negotiation is between the parties alone; conciliation adds guidance;
 * mediation puts a neutral third party in the middle.
 *
 * The criterion is the client's and applies app-wide, so it lives here once
 * instead of being re-typed per screen — the method picker and the dashboard
 * filters used to declare the same literal each, and nothing stopped the
 * third surface from being born out of order.
 *
 * Presentation only. The backend's validation array (`casos.service.ts`) is a
 * different concern and carries no ordering meaning.
 */
export const metodosEnOrden: readonly MetodoCaso[] = ['negociacion', 'conciliacion', 'mediacion'];

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
export type CaseStatusLabelKey =
  | 'inReview'
  | 'proposalReady'
  | 'signed'
  | 'awaitingCounterparty'
  /**
   * C-01: falta al menos una suscripción para que el caso se abra. La etiqueta
   * es deliberadamente impersonal —no dice *quién* está en falta— porque las
   * dos partes ven la misma tarjeta y el estado de pago de la contraparte no
   * es un dato que le corresponda a esta parte.
   */
  | 'awaitingSubscriptions'
  | 'expired';

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
