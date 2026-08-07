import { act, render, screen, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import { Text } from 'react-native';

import type { AuthService } from '@/services/auth/auth.service';

import { AuthSessionProvider, useAuthSession } from '../auth-session';

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

function Probe() {
  const { status } = useAuthSession();
  return <Text testID="status">{status}</Text>;
}

function renderProvider(authService: AuthService) {
  const result = render(
    <AuthSessionProvider authService={authService}>
      <Probe />
    </AuthSessionProvider>,
  );
  return result;
}

describe('AuthSessionProvider', () => {
  it('resolves to signedOut when there is no stored session', async () => {
    renderProvider(buildAuthService());

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
  });

  it('resolves to signedIn when a session is restored from storage', async () => {
    renderProvider(
      buildAuthService({ getSession: jest.fn().mockResolvedValue(session) }),
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));
  });

  it('starts in loading so a restored session does not flash the sign-in screen', async () => {
    await renderProvider(
      buildAuthService({ getSession: jest.fn().mockReturnValue(new Promise(() => {})) }),
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');
  });

  it('falls back to signedOut when reading the stored session fails', async () => {
    renderProvider(
      buildAuthService({
        getSession: jest.fn().mockRejectedValue(new Error('storage unavailable')),
      }),
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));
  });

  it('follows a background sign-out pushed by supabase', async () => {
    let emit: (next: Session | null) => void = () => undefined;
    renderProvider(
      buildAuthService({
        getSession: jest.fn().mockResolvedValue(session),
        onSessionChange: jest.fn((listener) => {
          emit = listener;
          return () => undefined;
        }),
      }),
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedIn'));

    await act(async () => {
      emit(null);
    });

    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
  });

  it('unsubscribes from session changes on unmount', async () => {
    const unsubscribe = jest.fn();
    const view = await renderProvider(
      buildAuthService({ onSessionChange: jest.fn().mockReturnValue(unsubscribe) }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('signedOut'),
    );

    await act(async () => {
      view.unmount();
    });

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('stays signedOut after a signUp that requires e-mail confirmation', async () => {
    function SignUpProbe() {
      const { status, signUp } = useAuthSession();
      return (
        <Text
          testID="status"
          onPress={() =>
            void signUp({
              email: 'a@b.com',
              password: 'secret',
              nombre: 'Ana',
              apellido: 'Perez',
            })
          }
        >
          {status}
        </Text>
      );
    }
    const authService = buildAuthService({ signUp: jest.fn().mockResolvedValue(null) });
    render(
      <AuthSessionProvider authService={authService}>
        <SignUpProbe />
      </AuthSessionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signedOut'));

    await act(async () => {
      screen.getByTestId('status').props.onPress();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
  });

});
