import type { Database } from "@mediacion/db-types";
import type { Insertable, Kysely } from "kysely";
import type { EstadoCaso } from "./casos.types";

/**
 * Crea un caso ya posado en el estado que una fixture necesita.
 *
 * Desde la migración 44 (`20260909130000_casos_estado_insert_guard.sql`)
 * `validate_caso_estado_transition` corre también en INSERT y sólo acepta
 * `nuevo` o `pendiente_suscripciones` como estado inicial. Ocho suites de
 * integración insertaban `casos` directamente en `en_negociacion`, `acordado`
 * o `cerrado` y quedaron todas rojas por eso — 42 tests, el mismo error. Este
 * helper existe para que el próximo cambio de la máquina de estados se arregle
 * en un lugar y no en ocho.
 *
 * **Llamalo antes de insertar `caso_partes`.** Los dos saltos hacia `activo` y
 * `en_negociacion` los mira `trg_casos_gate_suscripciones`, que sólo deja
 * pasar un caso sin partes o uno donde todas tienen suscripción activa. Con la
 * parte ya enganchada y sin suscripción, el gate levanta
 * `caso_bloqueado_suscripciones`.
 */
const caminos: Record<EstadoCaso, readonly EstadoCaso[]> = {
  nuevo: [],
  pendiente_suscripciones: [],
  activo: ["activo"],
  en_negociacion: ["activo", "en_negociacion"],
  acordado: ["activo", "en_negociacion", "acordado"],
  cerrado: ["activo", "en_negociacion", "acordado", "cerrado"],
  terminado: ["terminado"],
  vencido: ["activo", "vencido"],
  expirado: ["expirado"],
};

const estadosInsertables: EstadoCaso[] = ["nuevo", "pendiente_suscripciones"];

export async function insertCasoEnEstado(
  db: Kysely<Database>,
  valores: Omit<Insertable<Database["casos"]>, "estado">,
  estado: EstadoCaso,
): Promise<string> {
  const inicial = estadosInsertables.includes(estado) ? estado : "nuevo";
  const caso = await db
    .insertInto("casos")
    .values({ ...valores, estado: inicial })
    .returning("id")
    .executeTakeFirstOrThrow();

  for (const paso of caminos[estado]) {
    await db
      .updateTable("casos")
      .set({ estado: paso })
      .where("id", "=", caso.id)
      .execute();
  }

  return caso.id;
}
