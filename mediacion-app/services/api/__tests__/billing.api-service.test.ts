import { createApiBillingService, toSubscription } from '../billing.api-service';
import type { HttpClient, RequestOptions } from '../http-client';

/** Records every request and replays canned responses — no network. */
function fakeHttp(responses: Record<string, unknown>) {
  const calls: { path: string; options?: RequestOptions }[] = [];
  const http: HttpClient = {
    async request<T>(path: string, options?: RequestOptions): Promise<T> {
      calls.push({ path, options });
      return responses[path] as T;
    },
  };
  return { http, calls };
}

describe('billing.api-service', () => {
  it('maps the snake_case suscripciones row to the domain shape', () => {
    expect(
      toSubscription({
        id: 'sus-1',
        plan_id: 'plan-1',
        estado: 'activa',
        fecha_inicio: '2026-08-01T00:00:00.000Z',
        fecha_fin: null,
      }),
    ).toEqual({
      id: 'sus-1',
      planId: 'plan-1',
      estado: 'activa',
      fechaInicio: '2026-08-01T00:00:00.000Z',
      fechaFin: null,
    });
  });

  it('reads the vigente subscription without sending an owner the client could forge', async () => {
    const { http, calls } = fakeHttp({
      '/suscripciones/vigente': {
        id: 'sus-1',
        plan_id: 'plan-1',
        estado: 'activa',
        fecha_inicio: '2026-08-01T00:00:00.000Z',
        fecha_fin: null,
      },
    });

    const subscription = await createApiBillingService(http).getCurrentSubscription();

    expect(calls).toEqual([{ path: '/suscripciones/vigente', options: undefined }]);
    expect(subscription.id).toBe('sus-1');
  });

  it('posts the baja to the id it was given, with no body', async () => {
    const { http, calls } = fakeHttp({
      '/suscripciones/sus-1/baja': {
        id: 'sus-1',
        estado: 'cancelada',
        fecha_fin: '2026-08-17T12:00:00.000Z',
      },
    });

    const cancelled = await createApiBillingService(http).cancelSubscription('sus-1');

    expect(calls).toEqual([{ path: '/suscripciones/sus-1/baja', options: { method: 'POST' } }]);
    expect(cancelled.estado).toBe('cancelada');
  });
});
