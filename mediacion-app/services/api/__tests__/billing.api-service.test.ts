import {
  createApiBillingService,
  toSubscription,
  toSubscriptionUsage,
} from '../billing.api-service';
import type { ApiUso } from '../billing.api-service';
import type { HttpClient, RequestOptions } from '../http-client';

/** Records every request and replays canned responses — no network. */
function fakeHttp(responses: Record<string, unknown>) {
  const calls: { path: string; options?: RequestOptions }[] = [];
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

  it('reads the usage without sending an owner the client could forge', async () => {
    const { http, calls } = fakeHttp({
      '/suscripciones/uso': {
        period_start: '2026-08-17T12:00:00.000Z',
        period_end: '2026-09-16T12:00:00.000Z',
        negociaciones: { usado: 2, limite: 3 },
        clientes: null,
      },
    });

    const usage = await createApiBillingService(http).getUsage();

    expect(calls).toEqual([{ path: '/suscripciones/uso', options: undefined }]);
    expect(usage.negotiations).toEqual({ used: 2, limit: 3 });
  });

  it('maps the uso payload, keeping unlimited as unlimited', () => {
    expect(
      toSubscriptionUsage({
        period_start: '2026-08-17T12:00:00.000Z',
        period_end: '2026-09-16T12:00:00.000Z',
        negociaciones: { usado: 4, limite: null },
        clientes: { usado: 7, limite: 20 },
      }),
    ).toEqual({
      periodStart: '2026-08-17T12:00:00.000Z',
      periodEnd: '2026-09-16T12:00:00.000Z',
      // `limite: null` is unlimited, not a cap of zero.
      negotiations: { used: 4, limit: null },
      clients: { used: 7, limit: 20 },
    });
  });

  it('keeps a null clientes as null, never as a counter sitting at zero', () => {
    // "No sos titular de un estudio" and "usaste 0 de tus 20" are different
    // sentences, and only one of them belongs on screen.
    const usage = toSubscriptionUsage({
      period_start: '2026-08-17T12:00:00.000Z',
      period_end: '2026-09-16T12:00:00.000Z',
      negociaciones: { usado: 0, limite: 3 },
      clientes: null,
    });

    expect(usage.clients).toBeNull();
  });

  it('degrades a count it cannot use instead of rendering "usaste 2.5 de 3"', () => {
    const usage = toSubscriptionUsage({
      period_start: 'no es una fecha',
      period_end: '2026-09-16T12:00:00.000Z',
      negociaciones: { usado: 2.5, limite: -1 },
      clientes: null,
    } as unknown as ApiUso);

    expect(usage.periodStart).toBeNull();
    expect(usage.negotiations.used).toBe(0);
    // An unusable limit degrades to unlimited, the direction that never invents
    // a wall the server did not report.
    expect(usage.negotiations.limit).toBeNull();
  });

  it('creates a subscription without letting the client name the owner', async () => {
    // Sin `estudio_id`: el servidor resuelve titularidad desde el token. Un
    // owner elegido por el cliente sería una forma de cargarle un plan al
    // estudio de otro.
    const { http, calls } = fakeHttp({
      '/suscripciones': { id: 'sus-1', estado: 'pendiente_pago' },
    });

    const created = await createApiBillingService(http).createSubscription('plan-1');

    expect(calls).toEqual([
      { path: '/suscripciones', options: { method: 'POST', body: { plan_id: 'plan-1' } } },
    ]);
    // Arranca sin pagar: sólo el webhook la pone en `activa`.
    expect(created.estado).toBe('pendiente_pago');
  });

  it('asks for the checkout of a subscription, with no body', async () => {
    // La preferencia se arma entera con la fila de la suscripción, así que no
    // hay nada acá que el cliente pueda inflar ni descontar.
    const { http, calls } = fakeHttp({
      '/suscripciones/sus-1/pago': { init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1' },
    });

    const preference = await createApiBillingService(http).startPayment('sus-1');

    expect(calls).toEqual([{ path: '/suscripciones/sus-1/pago', options: { method: 'POST' } }]);
    expect(preference.init_point).toContain('mercadopago');
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
