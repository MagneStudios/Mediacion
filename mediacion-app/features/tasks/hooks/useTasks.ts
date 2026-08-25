import { useCallback, useEffect, useRef, useState } from 'react';

import { tasksService } from '../../../services/tasks.service';
import type { EstadoTarea, Task } from '../../../types/task';

export type TasksFetchStatus = 'loading' | 'error' | 'success';

export type UseTasksResult = {
  status: TasksFetchStatus;
  tasks: Task[];
  reload: () => void;
  /** Id of the task whose estado is being written right now, or null. */
  updatingTaskId: string | null;
  completeTask: (taskId: string) => Promise<void>;
};

/**
 * Post-agreement tasks for one case, plus the one mutation on them.
 *
 * An empty list in `success` is the normal state, not a degraded one: tasks
 * are generated server-side by the DocuSign webhook and nothing else creates
 * them (`types/task.ts`). The section renders its empty state and says so.
 *
 * `caseId` is nullable so a caller can hold the read back until it is worth
 * making — an agreement that nobody has signed yet cannot have tasks, and
 * asking for them on every visit to the dashboard would be a request whose
 * answer is known in advance.
 */
export function useTasks(caseId: string | null): UseTasksResult {
  const [status, setStatus] = useState<TasksFetchStatus>('loading');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const mountedRef = useRef(true);
  // Which case the state on screen belongs to. Without it, navigating between
  // cases would show the previous one's tasks until the new read lands.
  const activeCaseIdRef = useRef<string | null>(caseId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    activeCaseIdRef.current = caseId;
    if (caseId === null) {
      setTasks([]);
      setStatus('success');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    tasksService
      .listTasks(caseId)
      .then((result) => {
        if (cancelled || activeCaseIdRef.current !== caseId) return;
        setTasks(result);
        setStatus('success');
      })
      .catch(() => {
        if (cancelled || activeCaseIdRef.current !== caseId) return;
        // Empty plus 'error', never empty plus 'success': "there are no tasks"
        // is a claim, and a failed read cannot make it.
        setTasks([]);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, attempt]);

  /**
   * Marks one task completed. Guarded per task rather than globally: two
   * different rows may legitimately be written at once, but the same row twice
   * is a double submit.
   *
   * The server's row replaces the local one — no optimistic flip. A task that
   * failed to update must not read as completed just because the tap landed.
   */
  const completeTask = useCallback(
    async (taskId: string) => {
      if (updatingTaskId === taskId) return;
      setUpdatingTaskId(taskId);
      const completed: EstadoTarea = 'completada';
      try {
        const updated = await tasksService.updateTaskEstado(taskId, completed);
        if (!mountedRef.current || activeCaseIdRef.current !== caseId) return;
        setTasks((current) =>
          current.map((task) => (task.id === updated.id ? updated : task)),
        );
      } catch {
        // Deliberately silent on the list: the row simply stays as it was, so
        // nothing on screen claims a completion that did not happen. A failed
        // write is visible by the task not changing, and the user can retry.
      } finally {
        if (mountedRef.current) setUpdatingTaskId(null);
      }
    },
    [caseId, updatingTaskId],
  );

  return { status, tasks, reload, updatingTaskId, completeTask };
}
