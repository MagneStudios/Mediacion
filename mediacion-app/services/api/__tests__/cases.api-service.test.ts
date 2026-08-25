import { ApiError } from '../api-error';
import { createApiCasesService } from '../cases.api-service';
import type { HttpClient, RequestOptions } from '../http-client';

const now = new Date('2026-07-24T12:00:00.000Z');

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
        const call = { path, options };
        calls.push(call);
        try {
          return Promise.resolve(responder(call) as T);
        } catch (error) {
          return Promise.reject(error);
        }
      },
    },
  };
}

const apiRow = {
  id: 'a1b2c3d4-0000-0000-0000-000000000000',
  nombre: 'Divorcio',
  estado: 'activo' as const,
  metodo: 'mediacion' as const,
  created_at: '2026-07-01T00:00:00.000Z',
  plazo: null,
  sla_tipo: null,
  ronda_actual: 1,
  semaforo: null,
  contraparte: null,
};

describe('createApiCasesService', () => {
  describe('listCases', () => {
    it('maps every row onto the dashboard shape', async () => {
      const { http } = buildHttp(() => [apiRow]);
      const service = createApiCasesService(http, () => now);

      const cases = await service.listCases();

      expect(cases).toHaveLength(1);
      expect(cases[0].title).toBe('Divorcio');
      expect(cases[0].counterpartyName).toBeNull();
    });

    it('asks the plain list endpoint, which returns an array and never paginates', async () => {
      const { http, calls } = buildHttp(() => []);
      const service = createApiCasesService(http, () => now);

      await service.listCases();

      expect(calls[0].path).toBe('/casos');
      expect(calls[0].options).toBeUndefined();
    });
  });

  describe('getCaseDetail', () => {
    it('returns the mapped detail', async () => {
      const { http } = buildHttp(() => ({ ...apiRow, descripcion: 'texto' }));
      const service = createApiCasesService(http, () => now);

      const detail = await service.getCaseDetail('caso-1');

      expect(detail?.caseCode).toBe('CASO-2026-A1B2');
      expect(detail?.descripcion).toBe('texto');
    });

    it('resolves to undefined on caso_not_found, so a screen can render empty', async () => {
      const { http } = buildHttp(() => {
        throw new ApiError('caso_not_found', 'Case not found', 404);
      });
      const service = createApiCasesService(http, () => now);

      await expect(service.getCaseDetail('missing')).resolves.toBeUndefined();
    });

    it('rethrows an unrelated failure instead of hiding it as "not found"', async () => {
      const { http } = buildHttp(() => {
        throw new ApiError('internal_error', 'boom', 500);
      });
      const service = createApiCasesService(http, () => now);

      await expect(service.getCaseDetail('caso-1')).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('createCase', () => {
    it('posts the case and reads it back, since POST returns only id and estado', async () => {
      const { http, calls } = buildHttp((call) =>
        call.path === '/casos' && call.options?.method === 'POST'
          ? { id: apiRow.id, estado: 'nuevo' }
          : apiRow,
      );
      const service = createApiCasesService(http, () => now);

      const created = await service.createCase({
        nombre: 'Divorcio',
        metodo: 'mediacion',
      });

      expect(calls[0].options?.body).toEqual({
        nombre: 'Divorcio',
        descripcion: null,
        metodo: 'mediacion',
      });
      expect(calls[1].path).toBe(`/casos/${apiRow.id}`);
      expect(created.title).toBe('Divorcio');
    });
  });

  describe('createInvitation', () => {
    it('sends email_destino only for an email invitation', async () => {
      const { http, calls } = buildHttp(() => ({
        id: 'inv-1',
        tipo: 'email',
        token: null,
        estado: 'pendiente',
      }));
      const service = createApiCasesService(http, () => now);

      await service.createInvitation({
        casoId: 'caso-1',
        tipo: 'email',
        emailDestino: 'b@c.com',
        pagoACargo: 'invitador',
      });

      expect(calls[0].options?.body).toEqual({
        tipo: 'email',
        email_destino: 'b@c.com',
        pago_a_cargo: 'invitador',
      });
    });

    it('omits email_destino for a link invitation', async () => {
      const { http, calls } = buildHttp(() => ({
        id: 'inv-1',
        tipo: 'link',
        token: 'tok',
        estado: 'pendiente',
      }));
      const service = createApiCasesService(http, () => now);

      await service.createInvitation({ casoId: 'caso-1', tipo: 'link', pagoACargo: 'invitado' });

      expect(calls[0].options?.body).toEqual({ tipo: 'link', pago_a_cargo: 'invitado' });
    });

    it('completes the fields the POST does not return', async () => {
      const { http } = buildHttp(() => ({
        id: 'inv-1',
        tipo: 'link',
        token: 'tok',
        estado: 'pendiente',
      }));
      const service = createApiCasesService(http, () => now);

      const invitation = await service.createInvitation({
        casoId: 'caso-1',
        tipo: 'link',
        pagoACargo: 'invitador',
      });

      expect(invitation.caseId).toBe('caso-1');
      expect(invitation.emailDestino).toBeNull();
      expect(invitation.pagoACargo).toBe('invitador');
      expect(invitation.createdAt).toBe(now.toISOString());
    });
  });

  describe('listInvitations', () => {
    const invitationRow = {
      id: 'inv-1',
      caso_id: 'caso-1',
      tipo: 'codigo' as const,
      token: 'ABC123',
      email_destino: null,
      estado: 'pendiente' as const,
      fecha_envio: '2026-07-30T00:00:00.000Z',
      created_at: '2026-07-30T00:00:00.000Z',
    };

    it('reads the caso’s invitations and maps them to the domain shape', async () => {
      const { http, calls } = buildHttp(() => [invitationRow]);
      const service = createApiCasesService(http, () => now);

      const invitations = await service.listInvitations('caso-1');

      expect(calls[0].path).toBe('/casos/caso-1/invitaciones');
      expect(calls[0].options).toBeUndefined();
      expect(invitations).toEqual([
        {
          id: 'inv-1',
          caseId: 'caso-1',
          tipo: 'codigo',
          token: 'ABC123',
          emailDestino: null,
          estado: 'pendiente',
          // Not selected by `InvitacionView` — never guessed here.
          pagoACargo: null,
          createdAt: '2026-07-30T00:00:00.000Z',
        },
      ]);
    });

    it('orders newest first itself, without trusting the server’s order', async () => {
      // The repository does sort by created_at desc, but no ficha promises it,
      // and this order decides which code a user is shown.
      const { http } = buildHttp(() => [
        { ...invitationRow, id: 'inv-old', created_at: '2026-07-01T00:00:00.000Z' },
        { ...invitationRow, id: 'inv-new', created_at: '2026-08-01T00:00:00.000Z' },
        { ...invitationRow, id: 'inv-mid', created_at: '2026-07-15T00:00:00.000Z' },
      ]);
      const service = createApiCasesService(http, () => now);

      const invitations = await service.listInvitations('caso-1');

      expect(invitations.map((invitation) => invitation.id)).toEqual([
        'inv-new',
        'inv-mid',
        'inv-old',
      ]);
    });

    it('answers an empty list rather than a failure when there are none', async () => {
      const { http } = buildHttp(() => []);
      const service = createApiCasesService(http, () => now);

      await expect(service.listInvitations('caso-1')).resolves.toEqual([]);
    });
  });

  describe('joinCase', () => {
    it('posts the token to the join endpoint', async () => {
      const { http, calls } = buildHttp(() => ({ id: 'caso-1', estado: 'activo', requiresPayment: false }));
      const service = createApiCasesService(http, () => now);

      await service.joinCase('tok-123');

      expect(calls[0].path).toBe('/casos/unirse');
      expect(calls[0].options?.body).toEqual({ token: 'tok-123' });
    });
  });

  describe('getCaseTitle', () => {
    it('returns null for a case the caller cannot see', async () => {
      const { http } = buildHttp(() => {
        throw new ApiError('caso_not_found', 'Case not found', 404);
      });
      const service = createApiCasesService(http, () => now);

      await expect(service.getCaseTitle('missing')).resolves.toBeNull();
    });
  });
});
