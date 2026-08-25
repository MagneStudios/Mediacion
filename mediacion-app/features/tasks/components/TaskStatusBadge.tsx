import { StatusPill, type StatusPillStatus } from '../../../design-system';
import type { EstadoTarea } from '../../../types/task';

/**
 * The domain's `estado_tarea`, re-exported under the name the task components
 * already use. It was a second hand-written copy of the same three values
 * until `types/task.ts` existed; an alias keeps the component's vocabulary and
 * removes the copy that could drift.
 */
export type TaskStatus = EstadoTarea;

export type TaskStatusBadgeProps = {
  status: TaskStatus;
  label: string;
};

const STATUS_VISUAL: Record<TaskStatus, StatusPillStatus> = {
  pendiente: 'neutral',
  en_progreso: 'info',
  completada: 'success',
};

/** Maps a post-agreement task's status onto the shared StatusPill palette — never a second color vocabulary. */
export function TaskStatusBadge({ status, label }: TaskStatusBadgeProps) {
  return <StatusPill status={STATUS_VISUAL[status]}>{label}</StatusPill>;
}
