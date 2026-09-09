import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { KYSELY } from "../database/database.tokens";
import type { NegociacionView } from "./negociacion.types";

/**
 * Every negociacion of a caso, each with the acuerdo currently in force.
 *
 * The acuerdo is joined left and on `vigente`, so a negociacion with no
 * agreement — or one whose only agreements were superseded — still comes back,
 * with the acuerdo columns null. Flattened here and nested by the repository:
 * the join is what keeps this one query instead of one per negociacion.
 */
export function buildListNegociacionesByCasoQuery(
  db: Kysely<Database>,
  casoId: string,
) {
  return db
    .selectFrom("negociaciones")
    .leftJoin("acuerdos", (join) =>
      join
        .onRef("acuerdos.negociacion_id", "=", "negociaciones.id")
        .on("acuerdos.vigente", "=", true),
    )
    .select([
      "negociaciones.id as id",
      "negociaciones.caso_id as caso_id",
      "negociaciones.materia as subject_type",
      "negociaciones.method as metodo",
      "negociaciones.estado as estado",
      "negociaciones.round as ronda_actual",
      "negociaciones.created_at as created_at",
      "acuerdos.id as acuerdo_id",
      "acuerdos.estado as acuerdo_estado",
      "acuerdos.version as acuerdo_version",
    ])
    .where("negociaciones.caso_id", "=", casoId)
    .orderBy("negociaciones.created_at", "asc");
}

type NegociacionRow = Omit<NegociacionView, "acuerdo_vigente"> & {
  acuerdo_id: string | null;
  acuerdo_estado:
    | NonNullable<NegociacionView["acuerdo_vigente"]>["estado"]
    | null;
  acuerdo_version: number | null;
};

function toView(row: NegociacionRow): NegociacionView {
  const { acuerdo_id, acuerdo_estado, acuerdo_version, ...negociacion } = row;
  return {
    ...negociacion,
    acuerdo_vigente:
      acuerdo_id === null || acuerdo_estado === null || acuerdo_version === null
        ? null
        : { id: acuerdo_id, estado: acuerdo_estado, version: acuerdo_version },
  };
}

@Injectable()
export class NegociacionesRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  async listByCaso(casoId: string): Promise<NegociacionView[]> {
    const rows = (await buildListNegociacionesByCasoQuery(
      this.kysely,
      casoId,
    ).execute()) as unknown as NegociacionRow[];
    return rows.map(toView);
  }
}
