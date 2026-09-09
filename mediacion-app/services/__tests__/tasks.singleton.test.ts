import type { TasksService } from '../tasks.service';

/**
 * The backend/mock ternary at the bottom of `tasks.service.ts` decides, at
 * module evaluation, whether the task list comes from
 * `GET /casos/:casoId/tareas` or from the in-memory mock. It runs once per
 * process, so exercising both branches needs `jest.isolateModules` to
 * re-evaluate the module against a different `backend-instance` each time —
 * same idiom as `billing.singleton.test.ts`.
 */

let mockBackend: { tasks: unknown } | null = null;
jest.mock('../backend-instance', () => ({
  get backend() {
    return mockBackend;
  },
  get isBackendLive() {
    return mockBackend !== null;
  },
}));

const backedSentinel = { __kind: 'backed' } as unknown as TasksService;
const mockCreateBackedTasksService = jest.fn((..._args: unknown[]) => backedSentinel);
jest.mock('../api/tasks.backed-service', () => ({
  createBackedTasksService: (...args: unknown[]) => mockCreateBackedTasksService(...args),
}));

function loadTasksService(): TasksService {
  let loaded: TasksService | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<typeof import('../tasks.service')>('../tasks.service').tasksService;
  });
  if (!loaded) {
    throw new Error('tasks.service did not evaluate');
  }
  return loaded;
}

describe('tasksService singleton selection', () => {
  beforeEach(() => {
    mockCreateBackedTasksService.mockClear();
    mockBackend = null;
  });

  it('exports the backed service when a backend is configured', () => {
    const tasksApi = { __kind: 'api' };
    mockBackend = { tasks: tasksApi };

    const service = loadTasksService();

    expect(service).toBe(backedSentinel);
    expect(mockCreateBackedTasksService).toHaveBeenCalledTimes(1);
    // No mock fallback is passed: both members have a server counterpart, so
    // there is nothing here that could quietly fall back to memory.
    expect(mockCreateBackedTasksService.mock.calls[0]).toEqual([tasksApi]);
  });

  it('exports the pure mock when no backend is configured', async () => {
    mockBackend = null;

    const service = loadTasksService();

    // Identity + behavior, not shape: `objectContaining(expect.any(Function))`
    // would pass for ANY TasksService. Not being the backed sentinel plus the
    // seeded mock store actually answering is what pins the mock branch.
    expect(service).not.toBe(backedSentinel);
    expect(mockCreateBackedTasksService).not.toHaveBeenCalled();
    await expect(service.listTasks('case-3')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ caseId: 'case-3' })]),
    );
  });
});
