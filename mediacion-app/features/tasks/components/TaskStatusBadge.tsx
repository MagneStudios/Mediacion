import { StatusPill, type StatusPillStatus } from '../../../design-system';

/** Matches `tareas.estado` exactly — see docs/integration-contract.md. */
export type TaskStatus = 'pendiente' | 'en_progreso' | 'completada';

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
