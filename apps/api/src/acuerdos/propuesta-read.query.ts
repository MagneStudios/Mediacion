import type { Database } from "@mediacion/db-types";
import type { Kysely } from "kysely";
import type { PropuestaConRespuestas } from "./acuerdos.types";
import { estadoPropuestaAceptada } from "./acuerdos.types";

/**
 * The accepted propuesta of one negociacion. Scoped to the negociacion, not
 * the caso: a caso holds one acuerdo per materia, and the newest accepted
 * propuesta of the whole caso is the one of whichever materia was agreed last
 * — which is how the draft for tenencia came out carrying the alimentos
 * meeting point.
 */
export async function readAcceptedPropuesta(
  db: Kysely<Database>,
  casoId: string,
  negociacionId: string,
): Promise<PropuestaConRespuestas | undefined> {
  const propuesta = await db
    .selectFrom("propuestas")
    .selectAll()
    .where("caso_id", "=", casoId)
    .where("negociacion_id", "=", negociacionId)
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
