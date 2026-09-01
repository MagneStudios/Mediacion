import { Redirect, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

import { LoadingState } from '@/design-system';
import type { AuthService } from '@/services/auth/auth.service';
import { backend } from '@/services/backend-instance';

import { AuthSessionProvider, useAuthSession } from './auth-session';

/**
 * Auth entry screens: reachable without a session, and a signed-in user is
 * bounced back home from them — there is nothing to do there with a session.
 */
const authRoutes = ['/login', '/signup'];

/**
 * Legal pages the instructivo TyC requires to be readable without
 * registering or logging in (§1: the documents themselves; §5: the botón de
 * arrepentimiento on the first screen, explicitly NOT behind the account,
 * and the canal de contacto — a consumer with a complaint may have no
 * account, or may have already closed it).
 * Unlike `authRoutes`, a signed-in user can visit these too.
 */
const legalRoutes = [
  '/terminos-y-condiciones',
  '/politica-de-privacidad',
  '/arrepentimiento',
  '/contacto',
];

const publicRoutes = [...authRoutes, ...legalRoutes];

function matches(routes: string[], pathname: string): boolean {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isPublic(pathname: string): boolean {
  return matches(publicRoutes, pathname);
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

  if (status === 'signedIn' && matches(authRoutes, pathname)) {
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
  const pathname = usePathname();

  if (auth === null) {
    // The auth screens are the one thing the pass-through cannot pass through
    // to. `login.tsx` and `signup.tsx` call `useAuthSession()` unconditionally,
    // and without a backend there is no `AuthSessionProvider` above them — so
    // reaching either one threw and dropped the app into the error boundary.
    // Nothing links there in this mode, but a typed URL, a bookmark or a
    // restored tab all get there, and the web build's catch-all rewrite means
    // the route resolves rather than 404s.
    //
    // Sending them home is the same answer `Gate` already gives a signed-in
    // visitor on an auth route (there is nothing to do there), and it keeps the
    // rule in the one file that owns it instead of teaching both screens to
    // survive without their provider.
    if (matches(authRoutes, pathname)) {
      return <Redirect href="/" />;
    }
    return <>{children}</>;
  }

  return (
    <AuthSessionProvider authService={auth}>
      <Gate>{children}</Gate>
    </AuthSessionProvider>
  );
}
