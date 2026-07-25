import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Mediacion = Selectable<Database["mediaciones"]>;
export type EstadoMediacion = Mediacion["estado"];

export const estadoMediacionSolicitada: EstadoMediacion = "solicitada";
export const estadoMediacionAceptada: EstadoMediacion = "aceptada";
export const estadoMediacionRechazada: EstadoMediacion = "rechazada";
export const estadoMediacionActiva: EstadoMediacion = "activa";
export const estadoMediacionFinalizada: EstadoMediacion = "finalizada";

export const estadosMediacionActivos: EstadoMediacion[] = [
  estadoMediacionSolicitada,
  estadoMediacionAceptada,
  estadoMediacionActiva,
];

export const rolEnCasoMediador = "mediador";

export const rn05MediadorDesdeRonda = 3;

export type CreateMediacionDto = {
  mediadorId: string;
};

export type UpdateMediacionEstadoDto = {
  estado: EstadoMediacion;
};

export const mediacionViewColumns = [
  "id",
  "caso_id",
  "mediador_id",
  "estado",
  "ronda",
  "fecha_solicitud",
  "fecha_aceptacion",
] as const;

export type MediacionView = Pick<
  Mediacion,
  (typeof mediacionViewColumns)[number]
>;
