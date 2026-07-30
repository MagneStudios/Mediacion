import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";
import type { Caso } from "../casos/casos.types";

export type Invitacion = Selectable<Database["invitaciones"]>;
export type TipoInvitacion = Invitacion["tipo"];

export type CreateInvitacionDto = {
  tipo: TipoInvitacion;
  email_destino?: string;
};

export type InvitacionCreated = Pick<
  Invitacion,
  "id" | "tipo" | "token" | "estado"
>;

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
> & { fecha_envio: string | null; created_at: string };
