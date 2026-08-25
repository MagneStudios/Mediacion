import { createApiTasksService, toTask, type ApiTarea } from '../tasks.api-service';
import type { HttpClient, RequestOptions } from '../http-client';

type Call = { path: string; options?: RequestOptions };

/** Records every request and replays canned responses — no network. */
function fakeHttp(responses: Record<string, unknown>) {
  const calls: Call[] = [];
  const http: HttpClient = {
    async request<T>(path: string, options?: RequestOptions): Promise<T> {
      calls.push({ path, options });
      return responses[path] as T;
    },
    /** No suite here reads text; a call would be a mistake worth hearing. */
    async requestText(): Promise<string> {
      throw new Error('requestText is not stubbed in this suite');
    },
  };
  return { http, calls };
}

function row(overrides: Partial<ApiTarea> = {}): ApiTarea {
  return {
    id: 'tar-1',
    acuerdo_id: 'acu-1',
    caso_id: 'caso-1',
    tipo: 'tarea',
    descripcion: 'Económico — punto acordado: 45000',
    fecha_evento: null,
    estado: 'pendiente',
    created_at: '2026-05-29T12:00:01.000Z',
    updated_at: '2026-05-29T12:00:01.000Z',
    ...overrides,
  };
}

describe('tasks.api-service', () => {
  it('maps the snake_case tareas row to the domain shape', () => {
    expect(toTask(row())).toEqual({
      id: 'tar-1',
      caseId: 'caso-1',
      agreementId: 'acu-1',
      tipo: 'tarea',
      description: 'Económico — punto acordado: 45000',
      eventDate: null,
      estado: 'pendiente',
      createdAt: '2026-05-29T12:00:01.000Z',
    });
  });

  it('does not carry updated_at into the domain', () => {
    // `created_at` is what the server orders by; a second timestamp with no
    // consumer only invites picking the wrong one.
    expect(toTask(row())).not.toHaveProperty('updatedAt');
  });

  it('keeps a scheduled fecha_evento as it came', () => {
    expect(toTask(row({ fecha_evento: '2026-06-01T15:00:00.000Z' })).eventDate).toBe(
      '2026-06-01T15:00:00.000Z',
    );
  });

  it('lists the tasks of the caso oldest first, without trusting the server order', async () => {
    // Ascending is the order the generator produced them in, which follows the
    // accepted meeting point. No ficha promises the server keeps it.
    const { http, calls } = fakeHttp({
      '/casos/caso-1/tareas': [
        row({ id: 'tar-3', created_at: '2026-05-29T12:00:03.000Z' }),
        row({ id: 'tar-1', created_at: '2026-05-29T12:00:01.000Z' }),
        row({ id: 'tar-2', created_at: '2026-05-29T12:00:02.000Z' }),
      ],
    });

    const tasks = await createApiTasksService(http).listTasks('caso-1');

    expect(calls).toEqual([{ path: '/casos/caso-1/tareas', options: undefined }]);
    expect(tasks.map((task) => task.id)).toEqual(['tar-1', 'tar-2', 'tar-3']);
  });

  it('answers an empty list rather than a failure, which is the normal state today', async () => {
    // Tasks only exist once the DocuSign webhook fired; with DOCUSIGN_* unset
    // it never does, so `[]` is what a healthy API returns.
    const { http } = fakeHttp({ '/casos/caso-1/tareas': [] });

    await expect(createApiTasksService(http).listTasks('caso-1')).resolves.toEqual([]);
  });

  it('patches the estado onto the task and maps the row back', async () => {
    const { http, calls } = fakeHttp({
      '/tareas/tar-1': row({ estado: 'completada' }),
    });

    const updated = await createApiTasksService(http).updateTaskEstado('tar-1', 'completada');

    expect(calls).toEqual([
      { path: '/tareas/tar-1', options: { method: 'PATCH', body: { estado: 'completada' } } },
    ]);
    expect(updated.estado).toBe('completada');
  });

  it('sends the estado as given, leaving the server as the validating boundary', async () => {
    const { http, calls } = fakeHttp({ '/tareas/tar-1': row({ estado: 'en_progreso' }) });

    await createApiTasksService(http).updateTaskEstado('tar-1', 'en_progreso');

    expect(calls[0].options?.body).toEqual({ estado: 'en_progreso' });
  });
});
