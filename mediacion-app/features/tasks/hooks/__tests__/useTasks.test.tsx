import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Task } from '@/types/task';

const mockListTasks = jest.fn();
const mockUpdateTaskEstado = jest.fn();

jest.mock('@/services/tasks.service', () => ({
  tasksService: {
    listTasks: (...args: unknown[]) => mockListTasks(...args),
    updateTaskEstado: (...args: unknown[]) => mockUpdateTaskEstado(...args),
  },
}));

// eslint-disable-next-line import/first
import { useTasks } from '../useTasks';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tar-1',
    caseId: 'caso-1',
    agreementId: 'acu-1',
    tipo: 'tarea',
    description: 'Económico — punto acordado: 45000',
    eventDate: null,
    estado: 'pendiente',
    createdAt: '2026-05-29T12:00:01.000Z',
    ...overrides,
  };
}

describe('useTasks', () => {
  beforeEach(() => {
    mockListTasks.mockReset();
    mockListTasks.mockResolvedValue([task()]);
    mockUpdateTaskEstado.mockReset();
    mockUpdateTaskEstado.mockResolvedValue(task({ estado: 'completada' }));
  });

  it('loads the tasks of the case', async () => {
    const { result } = await renderHook(() => useTasks('caso-1'));

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(mockListTasks).toHaveBeenCalledWith('caso-1');
    expect(result.current.tasks).toHaveLength(1);
  });

  it('does not ask at all for a null case, and reports an empty success', async () => {
    // An agreement nobody signed cannot have tasks; the answer is known in
    // advance, so the request is not worth making.
    const { result } = await renderHook(() => useTasks(null));

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(mockListTasks).not.toHaveBeenCalled();
    expect(result.current.tasks).toEqual([]);
  });

  it('reports an empty list as success, which is the normal state today', async () => {
    mockListTasks.mockResolvedValue([]);
    const { result } = await renderHook(() => useTasks('caso-1'));

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.tasks).toEqual([]);
  });

  it('never reports an empty list as success when the read failed', async () => {
    // "There are no tasks" is a claim, and a failed read cannot make it.
    mockListTasks.mockRejectedValue(new Error('network_unavailable'));
    const { result } = await renderHook(() => useTasks('caso-1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.tasks).toEqual([]);
  });

  it('replaces the row with the server’s, not with an optimistic guess', async () => {
    const { result } = await renderHook(() => useTasks('caso-1'));
    await waitFor(() => expect(result.current.status).toBe('success'));

    await act(async () => {
      await result.current.completeTask('tar-1');
    });

    expect(mockUpdateTaskEstado).toHaveBeenCalledWith('tar-1', 'completada');
    expect(result.current.tasks[0].estado).toBe('completada');
    expect(result.current.updatingTaskId).toBeNull();
  });

  it('leaves the task untouched when the write failed', async () => {
    // A task that failed to update must not read as completed just because
    // the tap landed.
    mockUpdateTaskEstado.mockRejectedValue(new Error('tarea_not_found'));
    const { result } = await renderHook(() => useTasks('caso-1'));
    await waitFor(() => expect(result.current.status).toBe('success'));

    await act(async () => {
      await result.current.completeTask('tar-1');
    });

    expect(result.current.tasks[0].estado).toBe('pendiente');
    expect(result.current.updatingTaskId).toBeNull();
  });

  it('ignores a second write on the same row while one is in flight', async () => {
    let release: ((value: Task) => void) | undefined;
    mockUpdateTaskEstado.mockImplementation(
      () =>
        new Promise<Task>((resolve) => {
          release = resolve;
        }),
    );
    const { result } = await renderHook(() => useTasks('caso-1'));
    await waitFor(() => expect(result.current.status).toBe('success'));

    let first: Promise<void> | undefined;
    await act(async () => {
      first = result.current.completeTask('tar-1');
    });
    await waitFor(() => expect(result.current.updatingTaskId).toBe('tar-1'));

    await act(async () => {
      await result.current.completeTask('tar-1');
      release?.(task({ estado: 'completada' }));
      await first;
    });

    expect(mockUpdateTaskEstado).toHaveBeenCalledTimes(1);
  });
});
