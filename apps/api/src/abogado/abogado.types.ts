import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type SolicitudAbogado = Selectable<Database["lawyer_requests"]>;
export type EstadoSolicitudAbogado = SolicitudAbogado["status"];

export const estadoSolicitudPendientePago: EstadoSolicitudAbogado =
  "pendiente_pago";
export const estadoSolicitudPagada: EstadoSolicitudAbogado = "pagada";
export const estadoSolicitudFallida: EstadoSolicitudAbogado = "fallida";

export const monedaSolicitudArs = "ARS";

/**
 * `lawreq_` is what tells a lawyer payment apart from a subscription payment
 * when Mercado Pago hands the external reference back on the webhook: the
 * subscription flow puts a bare suscripcion uuid there, so the prefix is the
 * whole discriminator and both sides must read it from here.
 */
export const solicitudAbogadoReferencePrefix = "lawreq_";

export function buildSolicitudExternalReference(solicitudId: string): string {
  return `${solicitudAbogadoReferencePrefix}${solicitudId}`;
}

export function isSolicitudAbogadoReference(reference: string): boolean {
  return reference.startsWith(solicitudAbogadoReferencePrefix);
}

export const solicitudAbogadoViewColumns = [
  "id",
  "caso_id",
  "status",
  "moneda",
  "monto_minor",
  "external_reference",
  "paid_at",
  "created_at",
] as const;

/**
 * What the caller may read back about their own solicitud. Deliberately without
 * `mp_preference_id`/`mp_payment_id`: gateway identifiers are not the client's
 * business, and `case_summary` is the handoff payload for the estudio.
 */
export type SolicitudAbogadoView = Pick<
  SolicitudAbogado,
  (typeof solicitudAbogadoViewColumns)[number]
>;

/** What POST returns: the checkout to send the user to, plus the row behind it. */
export type SolicitudAbogadoCheckout = {
  solicitud: SolicitudAbogadoView;
  init_point: string;
};
