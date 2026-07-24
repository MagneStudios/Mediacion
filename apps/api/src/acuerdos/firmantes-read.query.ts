import type { Database } from "@mediacion/db-types";
import type { Kysely } from "kysely";
import { estadoInvitacionAceptada } from "../casos/casos.types";

export type Firmante = {
  usuario_id: string;
  email: string;
  nombre: string;
  apellido: string;
};

export function readAcceptedFirmantes(
  db: Kysely<Database>,
  casoId: string,
): Promise<Firmante[]> {
  return db
    .selectFrom("caso_partes")
    .innerJoin("usuarios", "usuarios.id", "caso_partes.usuario_id")
    .select([
      "caso_partes.usuario_id",
      "usuarios.email",
      "usuarios.nombre",
      "usuarios.apellido",
    ])
    .where("caso_partes.caso_id", "=", casoId)
    .where("caso_partes.estado_invitacion", "=", estadoInvitacionAceptada)
    .execute();
}
