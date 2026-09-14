import { render, screen, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import { Text } from 'react-native';

import type { AuthService } from '@/services/auth/auth.service';

import { AuthGate } from '../AuthGate';

let mockPathname = '/';
let mockSearchParams: { token?: string } = {};

// `Redirect` renders its destination instead of navigating, so a test can
// assert *where* the gate sends someone rather than only that it stopped
// rendering the children. `href` is a plain string for most routes, but the
// invitación→signup bounce (punto #4) hands an object `{pathname, params}` —
// serialized so a single assertion helper covers both shapes.
jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
  useLocalSearchParams: () => mockSearchParams,
  Redirect: ({ href }: { href: string | { pathname: string; params?: Record<string, string> } }) => {
    const { Text: RNText } = jest.requireActual('react-native');
    return <RNText testID="redirect">{typeof href === 'string' ? href : JSON.stringify(href)}</RNText>;
  },
}));

const session = { access_token: 'jwt-abc' } as unknown as Session;

function buildAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getSession: jest.fn().mockResolvedValue(null),
    getAccessToken: jest.fn().mockResolvedValue(null),
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
    onSessionChange: jest.fn().mockReturnValue(() => undefined),
    ...overrides,
  };
}

function renderGate(authService: AuthService | null, pathname: string, searchParams: { token?: string } = {}) {
  mockPathname = pathname;
  mockSearchParams = searchParams;
  return render(
    <AuthGate authService={authService}>
      <Text testID="app">app</Text>
    </AuthGate>,
  );
}

const expectRedirectTo = async (href: string) =>
  waitFor(() => expect(screen.getByTestId('redirect')).toHaveTextContent(href));

const expectAppRendered = async () => waitFor(() => expect(screen.getByTestId('app')).toBeTruthy());

/**
 * With no backend the app runs entirely on mocks and there is nothing to
 * authenticate against, so the gate passes through — that part is deliberate
 * and predates these tests.
 *
 * What it did *not* handle is the two screens the pass-through cannot pass
 * through to: `login.tsx` and `signup.tsx` call `useAuthSession()`
 * unconditionally, so with no `AuthSessionProvider` above them they threw
 * ("useAuthSession must be used inside an AuthSessionProvider") and dropped the
 * whole app into the error boundary. Reproduced in a browser against a clean
 * tree before fixing.
 */
describe('AuthGate without a backend', () => {
  it('lets every ordinary route through — the mock app is not gated', async () => {
    renderGate(null, '/');
    await expectAppRendered();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('sends /login home instead of crashing on the missing provider', async () => {
    renderGate(null, '/login');
    await expectRedirectTo('/');
    expect(screen.queryByTestId('app')).toBeNull();
  });

  it('sends /signup home too', async () => {
    renderGate(null, '/signup');
    await expectRedirectTo('/');
  });

  it('still serves the legal routes, which are public for a different reason', async () => {
    // These are public because the instructivo TyC requires them readable
    // without an account — not because auth is unavailable. They must keep
    // rendering, not redirect.
    for (const route of ['/terminos-y-condiciones', '/arrepentimiento', '/contacto']) {
      renderGate(null, route);
      await expectAppRendered();
    }
  });
});

describe('AuthGate with a backend', () => {
  it('shows the app to a signed-in visitor', async () => {
    renderGate(buildAuthService({ getSession: jest.fn().mockResolvedValue(session) }), '/');
    await expectAppRendered();
  });

  it('bounces a signed-out visitor to the login screen', async () => {
    renderGate(buildAuthService(), '/profile');
    await expectRedirectTo('/login');
  });

  it('renders the login screen for a signed-out visitor — the provider is there', async () => {
    renderGate(buildAuthService(), '/login');
    await expectAppRendered();
  });

  it('bounces a signed-in visitor away from the auth routes', async () => {
    renderGate(buildAuthService({ getSession: jest.fn().mockResolvedValue(session) }), '/login');
    await expectRedirectTo('/');
  });

  describe('punto #2 (AJUSTES-PACTUM-2026-09-10): /signup/plan no es un auth route', () => {
    it('bounces a signed-out visitor to login, unlike the bare /signup', async () => {
      renderGate(buildAuthService(), '/signup/plan');
      await expectRedirectTo('/login');
    });

    it('lets a signed-in visitor stay on it — the opposite of /login or /signup', async () => {
      renderGate(buildAuthService({ getSession: jest.fn().mockResolvedValue(session) }), '/signup/plan');
      await expectAppRendered();
      expect(screen.queryByTestId('redirect')).toBeNull();
    });
  });

  describe('punto #4: un link de invitación sin cuenta', () => {
    it('manda a /signup con el joinToken reconstruido, no a /login', async () => {
      renderGate(buildAuthService(), '/invitacion/mock-abc123', { token: 'mock-abc123' });
      await expectRedirectTo(
        JSON.stringify({ pathname: '/signup', params: { joinToken: 'mediacionapp://invitacion/mock-abc123' } }),
      );
    });

    it('sin token cae al /login genérico en vez de romper', async () => {
      renderGate(buildAuthService(), '/invitacion/mock-abc123', {});
      await expectRedirectTo('/login');
    });
  });
});
