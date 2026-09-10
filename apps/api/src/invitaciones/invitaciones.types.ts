import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";
import type { Caso } from "../casos/casos.types";

export type Invitacion = Selectable<Database["invitaciones"]>;
export type TipoInvitacion = Invitacion["tipo"];

/**
 * Quién paga la suscripción de la parte invitada (R-07). No es un enum de
 * Postgres sino un `TEXT` con `CHECK (pago_a_cargo IN ('invitador',
 * 'invitado'))` (migración `20260810120000`), así que el tipo no se puede
 * derivar del esquema como el resto: `Invitacion["pago_a_cargo"]` es
 * `string | null`. Esta lista es la copia de ese CHECK y el único lugar donde
 * vive; si la migración crece, crece acá.
 */
export const valoresPagoACargo = ["invitador", "invitado"] as const;
export type PagoACargo = (typeof valoresPagoACargo)[number];

export type CreateInvitacionDto = {
  tipo: TipoInvitacion;
  email_destino?: string;
  /**
   * Opcional: la columna es nullable y el CHECK deja pasar NULL (`NULL IN
   * (...)` no es FALSE). Una invitación sin definir quién paga sigue siendo
   * válida — el gate C-01 se resuelve después, cuando cada parte contrata.
   */
  pago_a_cargo?: PagoACargo | null;
};

export type InvitacionCreated = Pick<
  Invitacion,
  "id" | "tipo" | "token" | "estado"
> & { pago_a_cargo: PagoACargo | null };

export type JoinCasoDto = {
  token: string;
};

export type JoinedCaso = Pick<Caso, "id" | "estado">;

/**
 * An invitation as a member of the caso sees it.
 *
 * `token` is included so the creator can re-show a code they already sent —
 * losing it today means the invitation is unusable and a second one has to be
 * issued. It is only ever returned to members of the caso.
 */
export type InvitacionView = Pick<
  Invitacion,
  "id" | "caso_id" | "tipo" | "token" | "email_destino" | "estado"
> & {
  fecha_envio: string | null;
  created_at: string;
  pago_a_cargo: PagoACargo | null;
};
