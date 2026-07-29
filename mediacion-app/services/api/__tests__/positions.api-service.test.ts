import { ApiError } from '../api-error';
import type { HttpClient, RequestOptions } from '../http-client';
import { toApiCreateItem, toPositionItem, type ApiItem } from '../position-mapper';
import { createApiPositionsService } from '../positions.api-service';

type Call = { path: string; options?: RequestOptions };

function buildHttp(responder: (call: Call) => unknown): {
  calls: Call[];
  http: HttpClient;
} {
  const calls: Call[] = [];
  return {
    calls,
    http: {
      request<T>(path: string, options?: RequestOptions): Promise<T> {
        calls.push({ path, options });
        try {
          return Promise.resolve(responder({ path, options }) as T);
        } catch (error) {
          return Promise.reject(error);
        }
      },
    },
  };
}

const apiItem: ApiItem = {
  id: 'item-1',
  caso_id: 'caso-1',
  parte_id: 'user-a',
  categoria: 'bienes',
  nombre: 'Auto',
  descripcion: null,
  valor_min: '50000',
  valor_max: null,
  puede_ceder: true,
  condiciones_cesion: null,
  privado: true,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-02T00:00:00.000Z',
};

describe('toPositionItem', () => {
  it('maps snake_case columns onto the app shape', () => {
    const item = toPositionItem(apiItem);

    expect(item).toMatchObject({
      id: 'item-1',
      caseId: 'caso-1',
      ownerId: 'user-a',
      category: 'bienes',
      name: 'Auto',
      canConcede: true,
    });
  });

  it('turns a null valor into an empty string, never leaking null into the ui', () => {
    const item = toPositionItem(apiItem);

    expect(item.valueMax).toBe('');
    expect(item.valueMin).toBe('50000');
  });

  it('omits optional text fields instead of carrying null', () => {
    const item = toPositionItem(apiItem);

    expect(item.description).toBeUndefined();
    expect(item.concessionConditions).toBeUndefined();
  });

  it('always reports private, because these routes are owner-scoped by RN-01', () => {
    expect(toPositionItem({ ...apiItem, privado: false }).private).toBe(true);
  });
});

describe('toApiCreateItem', () => {
  it('sends empty values as null so the column stays empty rather than blank', () => {
    const payload = toApiCreateItem({
      caseId: 'caso-1',
      category: 'bienes',
      name: 'Auto',
      valueMin: '',
      valueMax: '100',
      canConcede: false,
    });

    expect(payload.valor_min).toBeNull();
    expect(payload.valor_max).toBe('100');
  });

  it('never sends caseId or id, which travel in the path', () => {
    const payload = toApiCreateItem({
      id: 'item-1',
      caseId: 'caso-1',
      category: 'bienes',
      name: 'Auto',
      valueMin: '1',
      valueMax: '2',
      canConcede: false,
    });

    expect(payload).not.toHaveProperty('caseId');
    expect(payload).not.toHaveProperty('caso_id');
    expect(payload).not.toHaveProperty('id');
  });

  it('never sends an owner id, which the caller must not be able to choose', () => {
    const payload = toApiCreateItem({
      caseId: 'caso-1',
      category: 'bienes',
      name: 'Auto',
      valueMin: '1',
      valueMax: '2',
      canConcede: false,
    });

    expect(JSON.stringify(payload)).not.toContain('parte_id');
  });
});

describe('createApiPositionsService', () => {
  it('lists the caller own items from the case-scoped route', async () => {
    const { http, calls } = buildHttp(() => [apiItem]);

    const items = await createApiPositionsService(http).getOwnPositions('caso-1');

    expect(calls[0].path).toBe('/casos/caso-1/items');
    expect(items).toHaveLength(1);
  });

  it('returns null for an item that belongs to the other parte', async () => {
    const { http } = buildHttp(() => {
      throw new ApiError('item_not_found', 'Item not found', 404);
    });

    await expect(
      createApiPositionsService(http).getOwnPosition('caso-1', 'item-of-b'),
    ).resolves.toBeNull();
  });

  it('rethrows an unrelated failure rather than reporting it as missing', async () => {
    const { http } = buildHttp(() => {
      throw new ApiError('internal_error', 'boom', 500);
    });

    await expect(
      createApiPositionsService(http).getOwnPosition('caso-1', 'item-1'),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('posts a new item to the case-scoped route', async () => {
    const { http, calls } = buildHttp(() => apiItem);

    await createApiPositionsService(http).createOwnPosition({
      caseId: 'caso-1',
      category: 'bienes',
      name: 'Auto',
      valueMin: '50000',
      valueMax: '',
      canConcede: true,
    });

    expect(calls[0].path).toBe('/casos/caso-1/items');
    expect(calls[0].options?.method).toBe('POST');
  });

  it('patches an existing item by id, not through the case route', async () => {
    const { http, calls } = buildHttp(() => apiItem);

    await createApiPositionsService(http).updateOwnPosition({
      id: 'item-1',
      caseId: 'caso-1',
      category: 'bienes',
      name: 'Auto',
      valueMin: '1',
      valueMax: '2',
      canConcede: false,
    });

    expect(calls[0].path).toBe('/items/item-1');
    expect(calls[0].options?.method).toBe('PATCH');
  });

  it('deletes by id and resolves with no value, matching the 204', async () => {
    const { http, calls } = buildHttp(() => undefined);

    await expect(
      createApiPositionsService(http).deleteOwnPosition('caso-1', 'item-1'),
    ).resolves.toBeUndefined();

    expect(calls[0].path).toBe('/items/item-1');
    expect(calls[0].options?.method).toBe('DELETE');
  });

  it('propagates a 404 on delete, so the ui can report a stale list', async () => {
    const { http } = buildHttp(() => {
      throw new ApiError('item_not_found', 'Item not found', 404);
    });

    await expect(
      createApiPositionsService(http).deleteOwnPosition('caso-1', 'gone'),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
