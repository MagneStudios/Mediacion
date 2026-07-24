import type { Database } from "@mediacion/db-types";
import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { toDomainError } from "../common/db/pg-error";
import { KYSELY } from "../database/database.tokens";
import type {
  EstadoAcuerdo,
  EstadoCaso,
  MetricasDto,
  RolUsuario,
} from "./types";

function toCountRecord<K extends string>(
  rows: Array<{ key: K; total: string | number | bigint }>,
): Partial<Record<K, number>> {
  const record: Partial<Record<K, number>> = {};
  for (const row of rows) {
    record[row.key] = Number(row.total);
  }
  return record;
}

@Injectable()
export class MetricasRepository {
  constructor(@Inject(KYSELY) private readonly kysely: Kysely<Database>) {}

  getMetricas(): Promise<MetricasDto> {
    return Promise.all([
      this.countCasosByEstado(),
      this.countUsuariosByRol(),
      this.countAcuerdosByEstado(),
    ])
      .then(([casosByEstado, usuariosByRol, acuerdosByEstado]) => ({
        casosByEstado,
        usuariosByRol,
        acuerdosByEstado,
      }))
      .catch((error: unknown) => {
        throw toDomainError(error);
      });
  }

  private async countCasosByEstado(): Promise<
    Partial<Record<EstadoCaso, number>>
  > {
    const rows = await this.kysely
      .selectFrom("casos")
      .select("estado")
      .select(({ fn }) => [fn.countAll().as("total")])
      .groupBy("estado")
      .execute();
    return toCountRecord(
      rows.map((row) => ({ key: row.estado, total: row.total })),
    );
  }

  private async countUsuariosByRol(): Promise<
    Partial<Record<RolUsuario, number>>
  > {
    const rows = await this.kysely
      .selectFrom("usuarios")
      .select("rol")
      .select(({ fn }) => [fn.countAll().as("total")])
      .groupBy("rol")
      .execute();
    return toCountRecord(
      rows.map((row) => ({ key: row.rol, total: row.total })),
    );
  }

  private async countAcuerdosByEstado(): Promise<
    Partial<Record<EstadoAcuerdo, number>>
  > {
    const rows = await this.kysely
      .selectFrom("acuerdos")
      .select("estado")
      .select(({ fn }) => [fn.countAll().as("total")])
      .groupBy("estado")
      .execute();
    return toCountRecord(
      rows.map((row) => ({ key: row.estado, total: row.total })),
    );
  }
}
