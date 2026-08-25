import { createApiAgreementsService, toBreachNotice } from '../agreements.api-service';
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
