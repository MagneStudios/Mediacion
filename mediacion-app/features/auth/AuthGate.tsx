import { Redirect, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

import { LoadingState } from '@/design-system';
import type { AuthService } from '@/services/auth/auth.service';
import { backend } from '@/services/backend-instance';

import { AuthSessionProvider, useAuthSession } from './auth-session';

/** Routes reachable without a session. Everything else requires one. */
const publicRoutes = ['/login', '/signup'];

function isPublic(pathname: string): boolean {
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function Gate({ children }: { children: ReactNode }) {
  const { status } = useAuthSession();
  const pathname = usePathname();
  const { t } = useTranslation();

  // `loading` is not "signed out": Supabase restores a persisted session
  // asynchronously, so redirecting here would bounce a signed-in user to the
  // login screen on every cold start.
  if (status === 'loading') {
    return <LoadingState label={t('common.loading')} />;
  }

  if (status === 'signedOut' && !isPublic(pathname)) {
    return <Redirect href="/login" />;
  }

  if (status === 'signedIn' && isPublic(pathname)) {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}

export type AuthGateProps = {
  children: ReactNode;
  /** Test seam. In the app this comes from the live backend. */
  authService?: AuthService | null;
};

/**
 * Gates the app on a real session — but only when there is a backend to
 * authenticate against.
 *
 * With no backend configured the screens run on mocks, and there is nothing to
 * sign in to. Gating then would lock the app behind a login form that cannot
 * possibly succeed, so this passes straight through instead.
 */
export function AuthGate({ children, authService }: AuthGateProps) {
  const auth = authService === undefined ? (backend?.auth ?? null) : authService;

  if (auth === null) {
    return <>{children}</>;
  }

  return (
    <AuthSessionProvider authService={auth}>
      <Gate>{children}</Gate>
    </AuthSessionProvider>
  );
}
