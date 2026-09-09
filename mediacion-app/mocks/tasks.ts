import type { Task } from '../types/task';

/**
 * Seeded tasks for `case-3`, the one seeded case whose agreement is already
 * `firmado` (`mocks/agreements.ts`). That mirrors the real rule: tasks exist
 * only once every signature completed, never before.
 *
 * The descriptions follow `buildTareasFromAcuerdo`'s format —
 * `"<Categoría> — punto acordado: <n>"` for a numeric meeting point and
 * `"<Categoría> — cumplir lo acordado"` for a descriptive one — because a mock
 * that renders a shape the backend never produces teaches the screen the wrong
 * lesson. `eventDate` is `null` on all of them for the same reason: the
 * generator does not set one.
 */
export const mockTasks: Task[] = [
  {
    id: 'task-case-3-1',
    caseId: 'case-3',
    agreementId: 'agreement-case-3-1',
    tipo: 'tarea',
    description: 'Económico — punto acordado: 45000',
    eventDate: null,
    estado: 'pendiente',
    createdAt: '2026-05-29T12:00:01.000Z',
  },
  {
    id: 'task-case-3-2',
    caseId: 'case-3',
    agreementId: 'agreement-case-3-1',
    tipo: 'tarea',
    description: 'Cronogramas — cumplir lo acordado',
    eventDate: null,
    estado: 'en_progreso',
    createdAt: '2026-05-29T12:00:02.000Z',
  },
  {
    id: 'task-case-3-3',
    caseId: 'case-3',
    agreementId: 'agreement-case-3-1',
    tipo: 'tarea',
    description: 'Bienes — cumplir lo acordado',
    eventDate: null,
    estado: 'completada',
    createdAt: '2026-05-29T12:00:03.000Z',
  },
];
