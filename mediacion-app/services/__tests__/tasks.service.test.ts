import { __resetMockTasks, createMockTasksService, __mockForceTasksFailure } from '../tasks.service';

describe('tasks.service — mock', () => {
  // The store is module-level (like cases.service.ts's mockCases), not
  // per-instance: resetting between tests is what actually isolates them.
  beforeEach(() => {
    __resetMockTasks();
  });

  it('returns only the tasks of the case asked for', async () => {
    const service = createMockTasksService();

    await expect(service.listTasks('case-404')).resolves.toEqual([]);
    const seeded = await service.listTasks('case-3');
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((task) => task.caseId === 'case-3')).toBe(true);
  });

  it('lists them oldest first', async () => {
    const tasks = await createMockTasksService().listTasks('case-3');

    const timestamps = tasks.map((task) => task.createdAt);
    expect([...timestamps].sort()).toEqual(timestamps);
  });

  it('seeds no fecha_evento, because the generator never sets one', async () => {
    // The mock rendering a shape the backend never produces would teach the
    // screen the wrong lesson — the calendar date is exactly what is missing.
    const tasks = await createMockTasksService().listTasks('case-3');

    expect(tasks.every((task) => task.eventDate === null)).toBe(true);
    expect(tasks.every((task) => task.tipo === 'tarea')).toBe(true);
  });

  it('commits the new estado to the store, not just to the returned copy', async () => {
    const service = createMockTasksService();

    const updated = await service.updateTaskEstado('task-case-3-1', 'completada');
    expect(updated.estado).toBe('completada');

    const reread = await service.listTasks('case-3');
    expect(reread.find((task) => task.id === 'task-case-3-1')?.estado).toBe('completada');
  });

  it('rejects an unknown task instead of inventing one', async () => {
    await expect(
      createMockTasksService().updateTaskEstado('task-nope', 'completada'),
    ).rejects.toThrow('task_not_found');
  });

  it('leaves the store untouched when the forced failure fires', async () => {
    const service = createMockTasksService();
    __mockForceTasksFailure('updateTaskEstado');

    await expect(service.updateTaskEstado('task-case-3-1', 'completada')).rejects.toThrow(
      'mock_update_task_estado_failed',
    );
    const reread = await service.listTasks('case-3');
    expect(reread.find((task) => task.id === 'task-case-3-1')?.estado).toBe('pendiente');
  });
});
