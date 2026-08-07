import type { ActivityEventKey, ActivityItem } from '@/types/activity';

/**
 * `GET /casos/:casoId/actividad` (apps/api/src/actividad/actividad.controller.ts).
 *
 * The shape is deliberately narrow server-side: `detalle` is withheld because
 * the audit trigger stores `to_jsonb(NEW)` — the whole row — which for an item
 * or a propuesta contains the counterparty's private ranges. There is no `id`
 * and no event vocabulary, only `accion` (`TG_OP || '_' || TG_TABLE_NAME`, e.g.
 * `INSERT_casos`) and `entidad`.
 */
export type ApiActivityEvent = {
  accion: string;
  entidad: string;
  created_at: string;
};

/**
 * Audit actions that map to exactly one user-facing milestone.
 *
 * Deliberately partial. `UPDATE_casos` and `UPDATE_acuerdos` are the two most
 * frequent audit rows and are NOT here: without `detalle` there is no way to
 * tell an estado transition from a plazo edit, so any mapping would be a guess
 * shown to both parties as fact. They are dropped rather than mislabelled — see
 * the note in createBackedActivityService about what that costs.
 */
const eventKeyByAccion: Record<string, ActivityEventKey> = {
  INSERT_casos: 'case_created',
  INSERT_acuerdos: 'agreement_reached',
  INSERT_firmas: 'signature_ready',
  INSERT_mediaciones: 'mediator_requested',
  UPDATE_mediaciones: 'mediator_assigned',
};

export function toEventKey(accion: string): ActivityEventKey | null {
  return eventKeyByAccion[accion] ?? null;
}

/**
 * The API sends no id, so one is derived from the fields that identify the
 * event. It is deterministic — two clients rendering the same feed agree, and a
 * re-fetch does not churn React keys — and scoped by caso so identical actions
 * on different casos never collide.
 */
export function toActivityId(caseId: string, event: ApiActivityEvent): string {
  return `${caseId}-${event.accion}-${event.created_at}`;
}

/** Returns null for an audit row with no unambiguous user-facing meaning. */
export function toActivityItem(
  caseId: string,
  event: ApiActivityEvent,
): ActivityItem | null {
  const eventKey = toEventKey(event.accion);
  if (eventKey === null) {
    return null;
  }
  return {
    id: toActivityId(caseId, event),
    eventKey,
    createdAt: event.created_at,
    caseId,
    destination: { type: 'case', caseId },
  };
}
