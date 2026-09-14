import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { KYSELY } from "../database/database.tokens";

export const configKeyModeracionTerminos = "moderacion_terminos" as const;

export function buildReadTerminosQuery(db: Kysely<Database>) {
  return db
    .selectFrom("configuracion")
    .select("valor")
    .where("clave", "=", configKeyModeracionTerminos);
}

@Injectable()
export class ModeracionRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  /**
   * Una clave ausente o con una forma que no es un arreglo de strings devuelve
   * la lista vacía, que en `findOffensiveTerms` significa "no bloquees nada".
   * Es el lado seguro para un filtro de contenido: una fila mal cargada no
   * puede dejar a las partes sin poder escribir.
   */
  async readTerminos(): Promise<string[]> {
    const row = await buildReadTerminosQuery(this.kysely).executeTakeFirst();
    const valor = row?.valor;
    if (!Array.isArray(valor)) {
      return [];
    }
    return valor.filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    );
  }
}
