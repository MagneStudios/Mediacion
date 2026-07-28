import type { Database } from "@mediacion/db-types";
import type { Selectable } from "kysely";

export type Tarea = Selectable<Database["tareas"]>;
export type TipoTarea = Tarea["tipo"];
export type EstadoTarea = Tarea["estado"];

export const tipoTareaAccionable: TipoTarea = "tarea";
export const tipoTareaEventoCalendario: TipoTarea = "evento_calendario";

export const estadoTareaPendiente: EstadoTarea = "pendiente";
export const estadoTareaEnProgreso: EstadoTarea = "en_progreso";
export const estadoTareaCompletada: EstadoTarea = "completada";

export const estadosTarea: EstadoTarea[] = [
  estadoTareaPendiente,
  estadoTareaEnProgreso,
  estadoTareaCompletada,
];

export const tareaViewColumns = [
  "id",
  "acuerdo_id",
  "caso_id",
  "tipo",
  "descripcion",
  "fecha_evento",
  "estado",
  "created_at",
  "updated_at",
] as const;

export type TareaView = Pick<Tarea, (typeof tareaViewColumns)[number]>;

export type NewTarea = {
  acuerdo_id: string;
  caso_id: string;
  tipo: TipoTarea;
  descripcion: string;
};

export type UpdateTareaEstadoDto = {
  estado: EstadoTarea;
};

export type CalendarEventDto = {
  fecha_evento?: string;
};

export type TareaCalendarEvent = {
  tarea: TareaView;
  ics: string;
};
