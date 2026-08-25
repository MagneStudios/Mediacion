import type { NotificationPreferences } from '../../../types/profile';
import type { HttpClient, RequestOptions } from '../http-client';
import {
  createApiProfileService,
  defaultLocalOnlyProfileState,
  splitProfileUpdate,
  toMockProfile,
  toPreferredLanguage,
  type ApiMeProfile,
} from '../profile.api-service';

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
        return Promise.resolve(responder({ path, options }) as T);
      },
      /** No suite here reads text; a call would be a mistake worth hearing. */
      async requestText(): Promise<string> {
        throw new Error('requestText is not stubbed in this suite');
      },
    },
  };
}

const apiProfile: ApiMeProfile = {
  id: 'user-1',
  rol: 'parte',
  nombre: 'Ana',
  apellido: 'Perez',
  email: 'a@b.com',
  telefono: null,
  idioma: 'es',
  verif_biometrica: 'pendiente',
  estudio_id: null,
  activo: true,
};

describe('toPreferredLanguage', () => {
  it.each([
    ['es', 'es'],
    ['en', 'en'],
  ] as const)('passes through %s', (input, expected) => {
    expect(toPreferredLanguage(input)).toBe(expected);
  });

  it('falls back to es for an unexpected value, since the column is plain text', () => {
    expect(toPreferredLanguage('pt-BR')).toBe('es');
  });

  it('falls back to es when the column is null', () => {
    expect(toPreferredLanguage(null)).toBe('es');
  });
});

describe('toMockProfile', () => {
  it('exposes only the fields the screen renders', () => {
    const profile = toMockProfile(apiProfile, defaultLocalOnlyProfileState);

    expect(profile).toEqual({
      nombre: 'Ana',
      apellido: 'Perez',
      rol: 'parte',
      idioma: 'es',
      activo: true,
      communicationPreference: 'in_app_only',
      accessibilityPreference: 'system_default',
    });
  });

  it('never leaks email, telefono, id or estudio_id into the profile model', () => {
    const profile = toMockProfile(apiProfile, defaultLocalOnlyProfileState);

    for (const leaked of ['email', 'telefono', 'id', 'estudio_id', 'verif_biometrica']) {
      expect(profile).not.toHaveProperty(leaked);
    }
  });

  it('R-05: maps numero_matricula to numeroMatricula when GET /me sends it', () => {
    const profile = toMockProfile({ ...apiProfile, numero_matricula: 'CPACF 12345' }, defaultLocalOnlyProfileState);
    expect(profile.numeroMatricula).toBe('CPACF 12345');
  });

  it('R-05: leaves numeroMatricula undefined when GET /me does not send it yet (backend TODO)', () => {
    const profile = toMockProfile(apiProfile, defaultLocalOnlyProfileState);
    expect(profile.numeroMatricula).toBeUndefined();
  });

  it('R-05: carries the local matriculaUrl through — there is no real upload endpoint', () => {
    const profile = toMockProfile(apiProfile, { ...defaultLocalOnlyProfileState, matriculaUrl: 'mock://matriculas/adjunto-demo.pdf' });
    expect(profile.matriculaUrl).toBe('mock://matriculas/adjunto-demo.pdf');
  });
});

describe('splitProfileUpdate', () => {
  it('routes nombre, apellido and idioma to the api', () => {
    const { persistable } = splitProfileUpdate({
      nombre: 'Ana',
      apellido: 'Perez',
      idioma: 'en',
    });

    expect(persistable).toEqual({ nombre: 'Ana', apellido: 'Perez', idioma: 'en' });
  });

  it('keeps the preferences no column backs out of the api payload', () => {
    const { persistable, local } = splitProfileUpdate({
      communicationPreference: 'email_summary',
      accessibilityPreference: 'larger_text_preference',
    });

    expect(persistable).toEqual({});
    expect(local).toEqual({
      communicationPreference: 'email_summary',
      accessibilityPreference: 'larger_text_preference',
    });
  });

  it('omits absent keys rather than sending undefined over stored values', () => {
    const { persistable } = splitProfileUpdate({ nombre: 'Ana' });

    expect(Object.keys(persistable)).toEqual(['nombre']);
  });

  it('R-05: routes numeroMatricula to the api as numero_matricula (snake_case)', () => {
    const { persistable } = splitProfileUpdate({ numeroMatricula: 'CPACF 12345' });
    expect(persistable).toEqual({ numero_matricula: 'CPACF 12345' });
  });

  it('R-05: keeps matriculaUrl local — there is no PATCH /me support for it', () => {
    const { persistable, local } = splitProfileUpdate({ matriculaUrl: 'mock://matriculas/adjunto-demo.pdf' });
    expect(persistable).toEqual({});
    expect(local).toEqual({ matriculaUrl: 'mock://matriculas/adjunto-demo.pdf' });
  });

  it('R-05: an explicit matriculaUrl: undefined (removing the attachment) is still routed to local, not dropped', () => {
    const { local } = splitProfileUpdate({ matriculaUrl: undefined, nombre: 'Ana' });
    expect(local).toHaveProperty('matriculaUrl', undefined);
  });

  it('R-05: matriculaUrl absent from the patch entirely stays out of local too', () => {
    const { local } = splitProfileUpdate({ nombre: 'Ana' });
    expect(local).not.toHaveProperty('matriculaUrl');
  });
});

describe('createApiProfileService', () => {
  it('reads the profile from /me', async () => {
    const { http, calls } = buildHttp(() => apiProfile);

    const profile = await createApiProfileService(http).getProfile();

    expect(calls[0].path).toBe('/me');
    expect(profile.nombre).toBe('Ana');
  });

  it('patches only the persistable fields', async () => {
    const { http, calls } = buildHttp(() => ({ ...apiProfile, nombre: 'Ana Maria' }));

    await createApiProfileService(http).updateProfile({
      nombre: 'Ana Maria',
      communicationPreference: 'email_summary',
    });

    expect(calls[0].options?.method).toBe('PATCH');
    expect(calls[0].options?.body).toEqual({ nombre: 'Ana Maria' });
  });

  it('R-05: PATCHes numero_matricula, never touching matriculaUrl (no such column)', async () => {
    const { http, calls } = buildHttp(() => apiProfile);

    await createApiProfileService(http).updateProfile({
      numeroMatricula: 'CPACF 12345',
      matriculaUrl: 'mock://matriculas/adjunto-demo.pdf',
    });

    expect(calls[0].options?.method).toBe('PATCH');
    expect(calls[0].options?.body).toEqual({ numero_matricula: 'CPACF 12345' });
  });

  it('does not PATCH at all for a local-only edit, which the api would reject', async () => {
    const { http, calls } = buildHttp(() => apiProfile);

    await createApiProfileService(http).updateProfile({
      accessibilityPreference: 'larger_text_preference',
    });

    expect(calls.every((call) => call.options?.method !== 'PATCH')).toBe(true);
  });

  it('keeps a local-only preference visible on the next read', async () => {
    const { http } = buildHttp(() => apiProfile);
    const service = createApiProfileService(http);

    await service.updateProfile({ communicationPreference: 'email_summary' });
    const profile = await service.getProfile();

    expect(profile.communicationPreference).toBe('email_summary');
  });

  it('reflects the server answer rather than echoing the request', async () => {
    const { http } = buildHttp(() => ({ ...apiProfile, nombre: 'Normalizado' }));

    const profile = await createApiProfileService(http).updateProfile({
      nombre: '  Ana  ',
    });

    expect(profile.nombre).toBe('Normalizado');
  });
});

describe('notification preferences endpoints', () => {
  const allPrefs: NotificationPreferences = {
    caseUpdates: true,
    proposalReady: true,
    responseReceived: true,
    signatureReady: true,
    agreementCompleted: true,
    mediatorAvailability: true,
    productUpdates: true,
  };

  it('reads them from GET /me/preferencias-notificacion', async () => {
    const { http, calls } = buildHttp(() => allPrefs);

    const prefs = await createApiProfileService(http).getNotificationPreferences();

    expect(calls[0].path).toBe('/me/preferencias-notificacion');
    expect(calls[0].options?.method).toBeUndefined();
    expect(prefs).toEqual(allPrefs);
  });

  it('PATCHes the partial and returns the server answer', async () => {
    const { http, calls } = buildHttp(() => ({ ...allPrefs, productUpdates: false }));

    const prefs = await createApiProfileService(http).updateNotificationPreferences({
      productUpdates: false,
    });

    expect(calls[0].path).toBe('/me/preferencias-notificacion');
    expect(calls[0].options?.method).toBe('PATCH');
    expect(calls[0].options?.body).toEqual({ productUpdates: false });
    expect(prefs.productUpdates).toBe(false);
  });
});
