import { createApiAgreementsService, toBreachNotice } from '../agreements.api-service';
import { ApiError } from '../api-error';
import type { HttpClient, RequestOptions } from '../http-client';

type Call = { path: string; options?: RequestOptions };

/** Records every request and replays canned responses — no network. */
function fakeHttp(responses: Record<string, unknown>, text = '') {
  const calls: Call[] = [];
  const textCalls: Call[] = [];
  const http: HttpClient = {
    async request<T>(path: string, options?: RequestOptions): Promise<T> {
      calls.push({ path, options });
      return responses[path] as T;
    },
    async requestText(path: string, options?: RequestOptions): Promise<string> {
      textCalls.push({ path, options });
      return text;
    },
  };
  return { http, calls, textCalls };
}

const row = {
  id: 'inc-1',
  acuerdo_id: 'acu-1',
  reportante_id: 'user-9',
  descripcion: 'No cumplió con la entrega.',
  fecha: '2026-08-20T12:00:00.000Z',
  created_at: '2026-08-20T12:00:01.000Z',
};

describe('agreements.api-service — incumplimientos', () => {
  it('maps the snake_case incumplimientos row to the domain shape', () => {
    expect(toBreachNotice(row)).toEqual({
      id: 'inc-1',
      agreementId: 'acu-1',
      reporterId: 'user-9',
      description: 'No cumplió con la entrega.',
      fecha: '2026-08-20T12:00:00.000Z',
    });
  });

  it('does not carry created_at into the domain', () => {
    // `fecha` is what the server orders by and the only date worth showing;
    // a second near-identical timestamp only invites picking the wrong one.
    expect(toBreachNotice(row)).not.toHaveProperty('createdAt');
  });

  it('posts the description untrimmed, leaving the server as the validating boundary', async () => {
    const { http, calls } = fakeHttp({ '/acuerdos/acu-1/incumplimiento': row });

    await createApiAgreementsService(http).registerBreach('acu-1', '  algo pasó  ');

    expect(calls).toEqual([
      {
        path: '/acuerdos/acu-1/incumplimiento',
        options: { method: 'POST', body: { descripcion: '  algo pasó  ' } },
      },
    ]);
  });

  it('lists the notices newest first', async () => {
    const { http, calls } = fakeHttp({
      '/acuerdos/acu-1/incumplimientos': [
        { ...row, id: 'inc-old', fecha: '2026-07-01T00:00:00.000Z' },
        { ...row, id: 'inc-new', fecha: '2026-08-20T12:00:00.000Z' },
      ],
    });

    const notices = await createApiAgreementsService(http).listBreachNotices('acu-1');

    expect(calls[0].path).toBe('/acuerdos/acu-1/incumplimientos');
    expect(notices.map((notice) => notice.id)).toEqual(['inc-new', 'inc-old']);
  });

  it('answers an empty list rather than a failure when there are none', async () => {
    const { http } = fakeHttp({ '/acuerdos/acu-1/incumplimientos': [] });

    await expect(
      createApiAgreementsService(http).listBreachNotices('acu-1'),
    ).resolves.toEqual([]);
  });
});

const inboxRow = {
  acuerdo_id: 'acu-1',
  caso_id: 'caso-1',
  caso_nombre: 'Caso Pérez',
  caso_codigo: 'PER-001',
  subject_type: 'tenencia' as const,
  version: 2,
  acuerdo_estado: 'enviado_a_firma' as const,
  own_status: 'sent',
  own_fecha_firma: null,
  pending_signers: 1,
};

describe('agreements.api-service — signature inbox', () => {
  it('carries subject_type and version into the row, which is what tells two rows of one caso apart', async () => {
    const { http } = fakeHttp({ '/firmas': [inboxRow] });

    const [item] = await createApiAgreementsService(http).listSignatureInbox();

    expect(item.agreementId).toBe('acu-1');
    expect(item.subjectType).toBe('tenencia');
    expect(item.version).toBe(2);
  });

  it('keeps a null subject_type as null — the legacy model, never "otro"', async () => {
    // The API leaves it null for a negociación that predates materias. Filling
    // it in here would print a false label on a legal document's row.
    const { http } = fakeHttp({ '/firmas': [{ ...inboxRow, subject_type: null, version: 1 }] });

    const [item] = await createApiAgreementsService(http).listSignatureInbox();

    expect(item.subjectType).toBeNull();
    expect(item.version).toBe(1);
  });
});

describe('agreements.api-service — getById', () => {
  const bundle = { acuerdo: { id: 'acu-1', caso_id: 'caso-1', estado: 'firmado' }, firmas: [] };

  it('reads the bundle by acuerdo, not by caso', async () => {
    const { http, calls } = fakeHttp({ '/acuerdos/acu-1': bundle });

    await expect(createApiAgreementsService(http).getById('acu-1')).resolves.toEqual(bundle);
    expect(calls).toEqual([{ path: '/acuerdos/acu-1', options: undefined }]);
  });

  it('answers null on acuerdo_not_found, which is also what the API says for one the caller may not read', async () => {
    const http: HttpClient = {
      async request() {
        throw new ApiError('acuerdo_not_found', 'not found', 404);
      },
      async requestText() {
        return '';
      },
    };

    await expect(createApiAgreementsService(http).getById('acu-9')).resolves.toBeNull();
  });

  it('propagates anything that is not a "not there"', async () => {
    const http: HttpClient = {
      async request() {
        throw new ApiError('network_unavailable', 'offline', 0);
      },
      async requestText() {
        return '';
      },
    };

    await expect(createApiAgreementsService(http).getById('acu-1')).rejects.toMatchObject({ code: 'network_unavailable' });
  });
});

describe('agreements.api-service — export', () => {
  it('reads the export as text, not as json', async () => {
    // The only route in the API that answers text/plain. Going through
    // `request` would drop the body and hand back undefined.
    const document = 'ACUERDO DE MEDIACIÓN\n\nIdentificador: acu-1\n';
    const { http, calls, textCalls } = fakeHttp({}, document);

    const exported = await createApiAgreementsService(http).exportAgreement('acu-1');

    expect(exported).toBe(document);
    expect(textCalls).toEqual([{ path: '/acuerdos/acu-1/exportar', options: undefined }]);
    expect(calls).toEqual([]);
  });
});
