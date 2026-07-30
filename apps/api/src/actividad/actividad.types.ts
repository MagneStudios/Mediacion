/**
 * A single event in a party-facing feed.
 *
 * Deliberately does NOT carry `detalle`. The audit trigger stores
 * `to_jsonb(NEW)` — the entire row — so `auditoria.detalle` for an item or a
 * propuesta contains the counterparty's private ranges verbatim. Exposing it to
 * a party would break RN-01 through the back door, which is why this shape is a
 * whitelist rather than a `Selectable<auditoria>` with fields removed: a new
 * column added upstream cannot silently join the payload.
 *
 * `usuario_id` is omitted for the same reason — the feed says what happened, not
 * who did it, since the counterparty's identity is only ever exposed through the
 * sanitised contraparte shape.
 */
export type ActivityEvent = {
  accion: string;
  entidad: string;
  created_at: string;
};
