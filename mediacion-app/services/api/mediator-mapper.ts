import type { EstadoMediacion, MockMediation } from '@/types/mediator';

/** `GET|POST /casos/:casoId/mediacion` — see apps/api/src/mediacion/mediacion.types.ts. */
export type ApiMediacion = {
  id: string;
  caso_id: string;
  mediador_id: string;
  estado: EstadoMediacion;
  ronda: number;
  fecha_solicitud: string;
  fecha_aceptacion: string | null;
};

/** `GET /casos/:casoId/mediadores` — name only, never email or estudio. */
export type ApiMediadorOption = {
  id: string;
  nombre: string;
  apellido: string;
};

/**
 * `mediador_id` is deliberately dropped. The UI type carries no raw user id for
 * the mediador — the identity is only ever exposed through the sanitised
 * SharedMediatorProfile — so carrying it here would put an identifier into
 * state that the privacy boundary says must not be there.
 */
export function toMediation(row: ApiMediacion): MockMediation {
  return {
    id: row.id,
    caseId: row.caso_id,
    estado: row.estado,
    ronda: row.ronda,
    requestedAt: row.fecha_solicitud,
    ...(row.fecha_aceptacion === null ? {} : { acceptedAt: row.fecha_aceptacion }),
  };
}
