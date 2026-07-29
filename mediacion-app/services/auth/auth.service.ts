import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type SignUpInput = {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type AuthService = {
  getAccessToken(): Promise<string | null>;
  getSession(): Promise<Session | null>;
  signIn(input: SignInInput): Promise<Session>;
  signUp(input: SignUpInput): Promise<Session | null>;
  signOut(): Promise<void>;
  onSessionChange(listener: (session: Session | null) => void): () => void;
};

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function createSupabaseAuthService(client: SupabaseClient): AuthService {
  return {
    async getSession(): Promise<Session | null> {
      const { data } = await client.auth.getSession();
      return data.session ?? null;
    },

    async getAccessToken(): Promise<string | null> {
      // getSession refreshes an expired token before returning it, so callers
      // never have to reason about expiry themselves.
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    },

    async signIn({ email, password }): Promise<Session> {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        throw new AuthError(error.message);
      }
      if (!data.session) {
        throw new AuthError('Sign-in returned no session');
      }
      return data.session;
    },

    /**
     * `nombre`/`apellido` travel in user metadata because the `handle_new_user`
     * trigger copies them into `public.usuarios` on signup. Without them the
     * provisioned row would carry empty names. `rol` is deliberately not sent:
     * it defaults to `parte` in the trigger and must not be client-selectable.
     */
    async signUp({ email, password, nombre, apellido }): Promise<Session | null> {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { nombre, apellido } },
      });
      if (error) {
        throw new AuthError(error.message);
      }
      // Null when the project requires e-mail confirmation before a session.
      return data.session ?? null;
    },

    async signOut(): Promise<void> {
      const { error } = await client.auth.signOut();
      if (error) {
        throw new AuthError(error.message);
      }
    },

    onSessionChange(listener): () => void {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        listener(session ?? null);
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
