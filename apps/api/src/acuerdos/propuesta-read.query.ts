import type { Database } from "@mediacion/db-types";
import type { Kysely } from "kysely";
import type { PropuestaConRespuestas } from "./acuerdos.types";
import { estadoPropuestaAceptada } from "./acuerdos.types";

export async function readAcceptedPropuesta(
  db: Kysely<Database>,
  casoId: string,
): Promise<PropuestaConRespuestas | undefined> {
  const propuesta = await db
    .selectFrom("propuestas")
    .selectAll()
    .where("caso_id", "=", casoId)
    .where("estado", "=", estadoPropuestaAceptada)
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .executeTakeFirst();
  if (!propuesta) {
    return undefined;
  }
  const respuestas = await db
    .selectFrom("respuestas_propuesta")
    .selectAll()
    .where("propuesta_id", "=", propuesta.id)
    .execute();
  return { propuesta, respuestas };
}
