import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { AuthError, createSupabaseAuthService } from '../auth.service';

const session = { access_token: 'jwt-abc', user: { id: 'user-1' } } as unknown as Session;

function buildClient(auth: Partial<SupabaseClient['auth']>): SupabaseClient {
  return { auth } as unknown as SupabaseClient;
}

describe('createSupabaseAuthService', () => {
  describe('getAccessToken', () => {
    it('returns the access token of the current session', async () => {
      const service = createSupabaseAuthService(
        buildClient({ getSession: jest.fn().mockResolvedValue({ data: { session } }) }),
      );

      await expect(service.getAccessToken()).resolves.toBe('jwt-abc');
    });

    it('returns null when signed out, so the http client omits the header', async () => {
      const service = createSupabaseAuthService(
        buildClient({
          getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
        }),
      );

      await expect(service.getAccessToken()).resolves.toBeNull();
    });

    it('reads the session on every call, so a background refresh is picked up', async () => {
      const getSession = jest
        .fn()
        .mockResolvedValueOnce({ data: { session } })
        .mockResolvedValueOnce({
          data: { session: { ...session, access_token: 'jwt-refreshed' } },
        });
      const service = createSupabaseAuthService(buildClient({ getSession }));

      await service.getAccessToken();

      await expect(service.getAccessToken()).resolves.toBe('jwt-refreshed');
    });
  });

  describe('signIn', () => {
    it('returns the session on success', async () => {
      const service = createSupabaseAuthService(
        buildClient({
          signInWithPassword: jest
            .fn()
            .mockResolvedValue({ data: { session }, error: null }),
        }),
      );

      await expect(
        service.signIn({ email: 'a@b.com', password: 'secret' }),
      ).resolves.toBe(session);
    });

    it('raises an AuthError carrying the supabase message', async () => {
      const service = createSupabaseAuthService(
        buildClient({
          signInWithPassword: jest.fn().mockResolvedValue({
            data: { session: null },
            error: { message: 'Invalid login credentials' },
          }),
        }),
      );

      await expect(
        service.signIn({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(AuthError);
    });

    it('raises rather than returning a session-less success', async () => {
      const service = createSupabaseAuthService(
        buildClient({
          signInWithPassword: jest
            .fn()
            .mockResolvedValue({ data: { session: null }, error: null }),
        }),
      );

      await expect(
        service.signIn({ email: 'a@b.com', password: 'secret' }),
      ).rejects.toThrow('no session');
    });
  });

  describe('signUp', () => {
    it('passes nombre and apellido as metadata for the provisioning trigger', async () => {
      const signUp = jest.fn().mockResolvedValue({ data: { session }, error: null });
      const service = createSupabaseAuthService(buildClient({ signUp }));

      await service.signUp({
        email: 'a@b.com',
        password: 'secret',
        nombre: 'Ana',
        apellido: 'Perez',
      });

      expect(signUp).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'secret',
        options: { data: { nombre: 'Ana', apellido: 'Perez' } },
      });
    });

    it('never sends rol, which must stay server-assigned', async () => {
      const signUp = jest.fn().mockResolvedValue({ data: { session }, error: null });
      const service = createSupabaseAuthService(buildClient({ signUp }));

      await service.signUp({
        email: 'a@b.com',
        password: 'secret',
        nombre: 'Ana',
        apellido: 'Perez',
      });

      expect(JSON.stringify(signUp.mock.calls[0][0])).not.toContain('rol');
    });

    it('returns null when the project requires e-mail confirmation first', async () => {
      const service = createSupabaseAuthService(
        buildClient({
          signUp: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        }),
      );

      await expect(
        service.signUp({
          email: 'a@b.com',
          password: 'secret',
          nombre: 'Ana',
          apellido: 'Perez',
        }),
      ).resolves.toBeNull();
    });
  });

  describe('onSessionChange', () => {
    it('unsubscribes through the returned disposer', () => {
      const unsubscribe = jest.fn();
      const service = createSupabaseAuthService(
        buildClient({
          onAuthStateChange: jest
            .fn()
            .mockReturnValue({ data: { subscription: { unsubscribe } } }),
        }),
      );

      service.onSessionChange(jest.fn())();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('normalizes an undefined session to null for the listener', () => {
      let emit: (event: string, session: unknown) => void = () => undefined;
      const service = createSupabaseAuthService(
        buildClient({
          onAuthStateChange: jest.fn((handler: unknown) => {
            emit = handler as typeof emit;
            return { data: { subscription: { unsubscribe: jest.fn() } } };
          }) as unknown as SupabaseClient['auth']['onAuthStateChange'],
        }),
      );
      const listener = jest.fn();

      service.onSessionChange(listener);
      emit('SIGNED_OUT', undefined);

      expect(listener).toHaveBeenCalledWith(null);
    });
  });
});
