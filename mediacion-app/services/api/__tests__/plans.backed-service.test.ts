import type { Plan } from '@/types/plan';

import { ApiError } from '../api-error';
import type { ApiPlansService } from '../plans.api-service';
import {
  createBackedPlansService,
  errorPlansWriteUnavailable,
} from '../plans.backed-service';

const base: Plan = {
  id: 'plan-base',
  nombre: 'base',
  limiteCarpetas: 3,
  limiteCasos: 2,
  limiteIteracionesIa: 5,
  precio: 0,
  moneda: 'ARS',
};

const simple: Plan = {
  id: 'plan-simple',
  nombre: 'simple',
  limiteCarpetas: 10,
  limiteCasos: 5,
  limiteIteracionesIa: 15,
  precio: 9.99,
  moneda: 'ARS',
};

function fakeApi(overrides: Partial<ApiPlansService> = {}): ApiPlansService {
  return {
    listPlanes: jest.fn().mockResolvedValue([base, simple]),
    ...overrides,
  };
}

const input = {
  nombre: 'premium',
  limiteCarpetas: 20,
  limiteCasos: 10,
  limiteIteracionesIa: 30,
  precio: 15,
};

describe('plans.backed-service', () => {
  it('lists the catalog from the server', async () => {
    const service = createBackedPlansService(fakeApi());

    await expect(service.listPlanes()).resolves.toEqual([base, simple]);
  });

  it('propagates a read failure so the screen can offer a retry', async () => {
    const api = fakeApi({
      listPlanes: jest.fn().mockRejectedValue(new ApiError('network_unavailable', 'down', 0)),
    });

    await expect(createBackedPlansService(api).listPlanes()).rejects.toBeInstanceOf(ApiError);
  });

  it('resolves one plan out of the catalog, since there is no GET /planes/:id', async () => {
    const api = fakeApi();

    await expect(createBackedPlansService(api).getPlan('plan-simple')).resolves.toEqual(simple);
    expect(api.listPlanes).toHaveBeenCalledTimes(1);
  });

  it('answers undefined for an id the catalog does not have, like the mock does', async () => {
    // A stale link to a retired plan is a normal answer, not an error state.
    await expect(createBackedPlansService(fakeApi()).getPlan('plan-gone')).resolves.toBeUndefined();
  });

  it('rejects the three ABM writes instead of reporting a success the server never saw', async () => {
    const api = fakeApi();
    const service = createBackedPlansService(api);

    await expect(service.createPlan(input)).rejects.toThrow(errorPlansWriteUnavailable);
    await expect(service.updatePlan('plan-base', input)).rejects.toThrow(errorPlansWriteUnavailable);
    await expect(service.deletePlan('plan-base')).rejects.toThrow(errorPlansWriteUnavailable);
    // And none of them touched the network: there is no endpoint to touch.
    expect(api.listPlanes).not.toHaveBeenCalled();
  });
});
