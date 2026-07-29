import type { MockProfile, RolUsuario, UpdateProfileInput } from '@/types/profile';

import type { HttpClient } from './http-client';

/** What `GET /me` actually returns. Wider than the screen needs, on purpose. */
export type ApiMeProfile = {
  id: string;
  rol: RolUsuario;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  idioma: string | null;
  verif_biometrica: string;
  estudio_id: string | null;
  activo: boolean;
};

/**
 * Fields the profile screen renders that no column backs today. They are held
 * in memory so the UI keeps working, and they are deliberately NOT sent to
 * `PATCH /me` — the API would reject them, and pretending they persist would
 * be a lie to the user.
 */
export type LocalOnlyProfileState = Pick<
  MockProfile,
  'communicationPreference' | 'accessibilityPreference' | 'deactivationRequestedAt'
>;

export const defaultLocalOnlyProfileState: LocalOnlyProfileState = {
  communicationPreference: 'in_app_only',
  accessibilityPreference: 'system_default',
};

const fallbackLanguage: MockProfile['idioma'] = 'es';

/** `usuarios.idioma` is plain text, so an unexpected value must not reach the UI. */
export function toPreferredLanguage(idioma: string | null): MockProfile['idioma'] {
  return idioma === 'en' ? 'en' : fallbackLanguage;
}

export function toMockProfile(
  row: ApiMeProfile,
  local: LocalOnlyProfileState,
): MockProfile {
  return {
    nombre: row.nombre,
    apellido: row.apellido,
    rol: row.rol,
    idioma: toPreferredLanguage(row.idioma),
    activo: row.activo,
    ...local,
  };
}

export type PersistableProfilePatch = Partial<
  Pick<MockProfile, 'nombre' | 'apellido' | 'idioma'>
>;

/** Splits a screen-level edit into what the API stores and what stays local. */
export function splitProfileUpdate(input: UpdateProfileInput): {
  persistable: PersistableProfilePatch;
  local: Partial<LocalOnlyProfileState>;
} {
  const persistable: PersistableProfilePatch = {};
  if (input.nombre !== undefined) {
    persistable.nombre = input.nombre;
  }
  if (input.apellido !== undefined) {
    persistable.apellido = input.apellido;
  }
  if (input.idioma !== undefined) {
    persistable.idioma = input.idioma;
  }

  const local: Partial<LocalOnlyProfileState> = {};
  if (input.communicationPreference !== undefined) {
    local.communicationPreference = input.communicationPreference;
  }
  if (input.accessibilityPreference !== undefined) {
    local.accessibilityPreference = input.accessibilityPreference;
  }

  return { persistable, local };
}

export type ProfileApiService = {
  getProfile(): Promise<MockProfile>;
  updateProfile(input: UpdateProfileInput): Promise<MockProfile>;
};

export function createApiProfileService(http: HttpClient): ProfileApiService {
  let local: LocalOnlyProfileState = { ...defaultLocalOnlyProfileState };

  return {
    async getProfile(): Promise<MockProfile> {
      const row = await http.request<ApiMeProfile>('/me');
      return toMockProfile(row, local);
    },

    async updateProfile(input: UpdateProfileInput): Promise<MockProfile> {
      const { persistable, local: localPatch } = splitProfileUpdate(input);
      local = { ...local, ...localPatch };

      // A local-only edit must not fire a request the API would reject as
      // no_updatable_fields.
      if (Object.keys(persistable).length === 0) {
        const row = await http.request<ApiMeProfile>('/me');
        return toMockProfile(row, local);
      }

      const row = await http.request<ApiMeProfile>('/me', {
        method: 'PATCH',
        body: persistable,
      });
      return toMockProfile(row, local);
    },
  };
}
