import {
  createApiPlansService,
  errorPlanPriceUnreadable,
  toPlan,
  type ApiPlan,
} from '../plans.api-service';
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

function row(overrides: Partial<ApiPlan> = {}): ApiPlan {
  return {
    id: 'plan-1',
    nombre: 'simple',
    limite_carpetas: 10,
    limite_casos: 5,
    limite_iteraciones_ia: 15,
    precio: 9.99,
    moneda: 'ARS',
    ...overrides,
  };
}

describe('plans.api-service', () => {
  it('maps the snake_case planes row to the domain shape', () => {
    expect(toPlan(row())).toEqual({
      id: 'plan-1',
      nombre: 'simple',
      limiteCarpetas: 10,
      limiteCasos: 5,
      limiteIteracionesIa: 15,
      precio: 9.99,
      moneda: 'ARS',
    });
  });

  it('reads a numeric price that arrives as a string, which is what pg sends for numeric', () => {
    // `database/kysely.provider.ts` registers no type parser, so `numeric`
    // comes back as a string even though BE's type says number. If this ever
    // changes the number case above still passes — both are accepted.
    expect(toPlan(row({ precio: '25.00' })).precio).toBe(25);
  });

  it('fails the read on a price it cannot parse, rather than rendering the plan as free', () => {
    expect(() => toPlan(row({ precio: 'nueve con noventa' }))).toThrow(
      errorPlanPriceUnreadable,
    );
    // The ones that would have survived a bare isFinite check: Number('') and
    // Number('  ') are 0, and a null column would coerce to 0 too.
    expect(() => toPlan(row({ precio: '' }))).toThrow(errorPlanPriceUnreadable);
    expect(() => toPlan(row({ precio: '   ' }))).toThrow(errorPlanPriceUnreadable);
    expect(() => toPlan(row({ precio: null as unknown as number }))).toThrow(
      errorPlanPriceUnreadable,
    );
    expect(() => toPlan(row({ precio: Number.NaN }))).toThrow(errorPlanPriceUnreadable);
  });

  it('keeps both unlimited encodings as they came, without normalizing one into the other', () => {
    // `null` (limiteCasos, post-R-10) and `-1` (the other two) mean the same
    // thing to a reader and different things to the schema — see types/plan.ts.
    const mapped = toPlan(
      row({ limite_casos: null, limite_carpetas: -1, limite_iteraciones_ia: -1 }),
    );

    expect(mapped.limiteCasos).toBeNull();
    expect(mapped.limiteCarpetas).toBe(-1);
    expect(mapped.limiteIteracionesIa).toBe(-1);
  });

  it('preserves a zero price as zero — the base plan really is free', () => {
    expect(toPlan(row({ precio: 0 })).precio).toBe(0);
    expect(toPlan(row({ precio: '0.00' })).precio).toBe(0);
  });

  it('lists the catalog with a plain GET and no filter of its own', () => {
    const { http, calls } = fakeHttp({ '/planes': [row(), row({ id: 'plan-2', nombre: 'plus' })] });

    return createApiPlansService(http)
      .listPlanes()
      .then((plans) => {
        expect(calls).toEqual([{ path: '/planes', options: undefined }]);
        // Two rows in, two rows out: retiring a plan is the source's job
        // (`docs/pedidos-frontend-monetizacion.md` §5.2), not this client's.
        expect(plans.map((plan) => plan.nombre)).toEqual(['simple', 'plus']);
      });
  });

  it('propagates the whole read failure when one row is unreadable', async () => {
    const { http } = fakeHttp({ '/planes': [row(), row({ id: 'plan-2', precio: 'gratis' })] });

    await expect(createApiPlansService(http).listPlanes()).rejects.toThrow(
      errorPlanPriceUnreadable,
    );
  });

  it('answers an empty catalog with an empty list, not a failure', async () => {
    const { http } = fakeHttp({ '/planes': [] });

    await expect(createApiPlansService(http).listPlanes()).resolves.toEqual([]);
  });
});
