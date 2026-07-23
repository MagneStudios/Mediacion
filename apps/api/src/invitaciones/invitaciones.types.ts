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
