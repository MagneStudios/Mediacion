import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

type Caso = Selectable<Database["casos"]>;
type Usuario = Selectable<Database["usuarios"]>;
type Acuerdo = Selectable<Database["acuerdos"]>;

export type EstadoCaso = Caso["estado"];
export type RolUsuario = Usuario["rol"];
export type EstadoAcuerdo = Acuerdo["estado"];

export type MetricasDto = {
  casosByEstado: Partial<Record<EstadoCaso, number>>;
  usuariosByRol: Partial<Record<RolUsuario, number>>;
  acuerdosByEstado: Partial<Record<EstadoAcuerdo, number>>;
};
