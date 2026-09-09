import type { EstadoTarea, Task } from '@/types/task';

import type { ApiTasksService } from './tasks.api-service';
import type { TasksService } from '../tasks.service';

/**
 * Presents the real task endpoints under the contract `useTasks` consumes.
 *
 * There is nothing to split here and nothing left on the mock: both members of
 * `TasksService` have a server counterpart, so this is a straight pass-through.
 * It exists anyway rather than handing `backend.tasks` to the screens directly,
 * because the mock and the real service must stay swappable at one line in
 * `tasks.service.ts` — the same seam every other service in this folder keeps.
 *
 * An empty list is the expected answer today: tasks are generated only by the
 * DocuSign webhook, which is inert until the eight `DOCUSIGN_*` variables are
 * configured (`types/task.ts`). The screen renders its empty state for it, and
 * that empty state is telling the truth.
 */
export function createBackedTasksService(api: ApiTasksService): TasksService {
  return {
    listTasks(caseId: string): Promise<Task[]> {
      return api.listTasks(caseId);
    },

    updateTaskEstado(taskId: string, estado: EstadoTarea): Promise<Task> {
      return api.updateTaskEstado(taskId, estado);
    },
  };
}
