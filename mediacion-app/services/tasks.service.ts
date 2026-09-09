import { mockTasks } from '../mocks/tasks';
import type { EstadoTarea, Task } from '../types/task';
import { createBackedTasksService } from './api/tasks.backed-service';
import { backend } from './backend-instance';
import { createFailureController, delay, rejectAfter } from './mock-utils';

/**
 * Post-agreement tasks (RN-14 "accionables").
 *
 * Two of the three task endpoints are consumed here: `GET /casos/:casoId/tareas`
 * and `PATCH /tareas/:id`. The third, `POST /tareas/:id/calendario`, is
 * deliberately absent — it needs a `fecha_evento` that no task has and that
 * nothing in this app can supply without either a date picker (new UI, and a
 * product decision about what "the date" of a task even means) or the backend
 * deriving one. Writing a client for a call we cannot make is how a contract
 * gets frozen before anyone knows what it needs; same reasoning as
 * `lawyer.service.ts`. Preguntado en `docs/pedidos-frontend-a-backend.md` §11.
 *
 * Nothing here creates a task: they are generated server-side by the DocuSign
 * webhook when every signature completes (see `types/task.ts`).
 */
export type TasksService = {
  listTasks(caseId: string): Promise<Task[]>;
  updateTaskEstado(taskId: string, estado: EstadoTarea): Promise<Task>;
};

/** In-memory only — cleared on app restart, never written to disk. */
let tasks: Task[] = [...mockTasks];

const failures = createFailureController<'updateTaskEstado'>();

export function __mockForceTasksFailure(operation: 'updateTaskEstado'): void {
  failures.force(operation);
}

/** Test-only: resets the in-memory store back to the seed. Never imported by a screen. */
export function __resetMockTasks(): void {
  tasks = [...mockTasks];
}

export function createMockTasksService(): TasksService {
  return {
    async listTasks(caseId) {
      // Ascending by creation, the order the generator produced them in and
      // the one the server sorts by.
      const forCase = tasks
        .filter((task) => task.caseId === caseId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return delay(forCase, 400);
    },

    async updateTaskEstado(taskId, estado) {
      if (failures.consume('updateTaskEstado')) {
        return rejectAfter('mock_update_task_estado_failed', 500);
      }
      const existing = tasks.find((task) => task.id === taskId);
      if (!existing) {
        return rejectAfter('task_not_found', 300);
      }
      const updated: Task = { ...existing, estado };
      const committed = await delay(updated, 600);
      tasks = tasks.map((task) => (task.id === taskId ? committed : task));
      return committed;
    },
  };
}

/**
 * Default instance consumed by `useTasks` — the real endpoints when a backend
 * is configured, the mock otherwise. Same selection idiom as
 * `plans.service.ts` and `billing.service.ts`.
 */
export const tasksService: TasksService = backend
  ? createBackedTasksService(backend.tasks)
  : createMockTasksService();
