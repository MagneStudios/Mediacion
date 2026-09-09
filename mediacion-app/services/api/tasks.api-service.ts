import type { EstadoTarea, Task, TipoTarea } from '@/types/task';

import type { HttpClient } from './http-client';

/**
 * `TareaView` — the `tareaViewColumns` allowlist of
 * `apps/api/src/tareas/tareas.types.ts`, straight off the row.
 *
 * `updated_at` is not mapped: nothing renders it, and `created_at` is what the
 * server orders by. A second timestamp in the domain with no consumer only
 * invites someone to pick the wrong one.
 */
export type ApiTarea = {
  id: string;
  acuerdo_id: string;
  caso_id: string;
  tipo: TipoTarea;
  descripcion: string;
  fecha_evento: string | null;
  estado: EstadoTarea;
  created_at: string;
  updated_at: string;
};

export function toTask(row: ApiTarea): Task {
  return {
    id: row.id,
    caseId: row.caso_id,
    agreementId: row.acuerdo_id,
    tipo: row.tipo,
    description: row.descripcion,
    eventDate: row.fecha_evento,
    estado: row.estado,
    createdAt: row.created_at,
  };
}

/**
 * Two of the three task routes. `POST /tareas/:id/calendario` is not here on
 * purpose — see the header of `services/tasks.service.ts`.
 */
export type ApiTasksService = {
  listTasks(caseId: string): Promise<Task[]>;
  updateTaskEstado(taskId: string, estado: EstadoTarea): Promise<Task>;
};

export function createApiTasksService(http: HttpClient): ApiTasksService {
  return {
    /**
     * Ascending by creation — the order the generator produced them in, which
     * follows the meeting point the parties accepted. Sorted here rather than
     * trusted from the server: the repository does `order by created_at asc`
     * today, but no ficha promises it and `created_at` travels in the payload.
     */
    async listTasks(caseId: string): Promise<Task[]> {
      const rows = await http.request<ApiTarea[]>(`/casos/${caseId}/tareas`);
      return rows
        .map(toTask)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    /**
     * The server validates `estado` against the enum and answers
     * `400 invalid_input` for anything else, so the value is sent as given
     * rather than re-checked here — the server stays the validating boundary.
     */
    updateTaskEstado(taskId: string, estado: EstadoTarea): Promise<Task> {
      return http
        .request<ApiTarea>(`/tareas/${taskId}`, {
          method: 'PATCH',
          body: { estado },
        })
        .then(toTask);
    },
  };
}
