import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AuthService, SignInInput, SignUpInput } from '@/services/auth/auth.service';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

export type AuthSessionValue = {
  status: AuthStatus;
  session: Session | null;
  signIn(input: SignInInput): Promise<void>;
  signUp(input: SignUpInput): Promise<void>;
  signOut(): Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export type AuthSessionProviderProps = {
  authService: AuthService;
  children: ReactNode;
};

/**
 * Holds the single source of truth for "is someone signed in". The status
 * starts as `loading` rather than `signedOut` so that a restored session does
 * not flash the sign-in screen on cold start.
 */
export function AuthSessionProvider({
  authService,
  children,
}: AuthSessionProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let active = true;

    authService
      .getSession()
      .then((restored) => {
        if (!active) {
          return;
        }
        setSession(restored);
        setStatus(restored === null ? 'signedOut' : 'signedIn');
      })
      .catch(() => {
        if (active) {
          setStatus('signedOut');
        }
      });

    const unsubscribe = authService.onSessionChange((next) => {
      if (!active) {
        return;
      }
      setSession(next);
      setStatus(next === null ? 'signedOut' : 'signedIn');
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authService]);

  const signIn = useCallback(
    async (input: SignInInput) => {
      const next = await authService.signIn(input);
      setSession(next);
      setStatus('signedIn');
    },
    [authService],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      const next = await authService.signUp(input);
      setSession(next);
      // A confirmation-pending signup yields no session, so the user stays out.
      setStatus(next === null ? 'signedOut' : 'signedIn');
    },
    [authService],
  );

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
    setStatus('signedOut');
  }, [authService]);

  const value = useMemo<AuthSessionValue>(
    () => ({ status, session, signIn, signUp, signOut }),
    [status, session, signIn, signUp, signOut],
  );

  return (
    <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionValue {
  const value = useContext(AuthSessionContext);
  if (value === null) {
    throw new Error('useAuthSession must be used inside an AuthSessionProvider');
  }
  return value;
}
