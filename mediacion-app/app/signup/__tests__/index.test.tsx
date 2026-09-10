import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';

const mockReplace = jest.fn();
let mockSearchParams: { joinToken?: string } = {};
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return {
    Stack: { Screen: () => null },
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => mockSearchParams,
    Link: ({ children }: { children?: React.ReactNode }) => <Text>{children}</Text>,
  };
});

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

let mockAuthSessionStatus: 'signedOut' | 'signedIn' = 'signedOut';
const mockAuthSessionListeners = new Set<() => void>();
function setMockAuthSessionStatus(next: 'signedOut' | 'signedIn') {
  mockAuthSessionStatus = next;
  mockAuthSessionListeners.forEach((listener) => listener());
}
const mockSignUp = jest.fn();
jest.mock('@/features/auth/auth-session', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect, useState } = require('react');
  return {
    // A plain `{ status: mockAuthSessionStatus }` object would never re-render
    // SignUpScreen when the mock mutates that variable — the real
    // AuthSessionProvider is a Context whose consumers DO re-render on
    // `setStatus`. This subscribes like a real consumer so `onSuccess`'s
    // `status` check sees the same value a real signUp() flow would.
    useAuthSession: () => {
      const [, forceRender] = useState(0);
      useEffect(() => {
        const listener = () => forceRender((n: number) => n + 1);
        mockAuthSessionListeners.add(listener);
        return () => {
          mockAuthSessionListeners.delete(listener);
        };
      }, []);
      return { signUp: mockSignUp, status: mockAuthSessionStatus };
    },
  };
});

const mockRegisterAcceptance = jest.fn();
jest.mock('@/services/legal.service', () => ({
  legalService: { registerAcceptance: (...args: unknown[]) => mockRegisterAcceptance(...args) },
}));

// eslint-disable-next-line import/first
import SignUpScreen from '../index';

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <SignUpScreen />
    </I18nextProvider>,
  );
}

async function fillRequiredFields() {
  await fireEvent.changeText(screen.getByPlaceholderText(i18n.t('auth.nombrePlaceholder')), 'Ana');
  await fireEvent.changeText(screen.getByPlaceholderText(i18n.t('auth.apellidoPlaceholder')), 'Pérez');
  await fireEvent.changeText(screen.getByPlaceholderText(i18n.t('auth.emailPlaceholder')), 'ana@example.com');
  await fireEvent.changeText(screen.getByPlaceholderText(i18n.t('auth.newPasswordPlaceholder')), 'secreta123');
  await waitFor(() => expect(screen.getByDisplayValue('ana@example.com')).toBeTruthy());
}

async function tick(label: string) {
  await fireEvent.press(screen.getByLabelText(label));
  await waitFor(() => expect(screen.getByLabelText(label)).toBeChecked());
}

describe('SignUpScreen — TyC acceptance gate (instructivo §2)', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSignUp.mockReset();
    mockRegisterAcceptance.mockReset();
    mockRegisterAcceptance.mockResolvedValue(undefined);
    mockAuthSessionStatus = 'signedOut';
    mockSearchParams = {};
  });

  it('both checkboxes start unchecked — never pre-ticked', async () => {
    await renderScreen();
    expect(screen.getByLabelText(i18n.t('legal.acceptance.requiredA11yLabel'))).not.toBeChecked();
    expect(screen.getByLabelText(i18n.t('legal.acceptance.marketingA11yLabel'))).not.toBeChecked();
  });

  it('does not submit while the mandatory checkbox is unticked, even with every field filled', async () => {
    await renderScreen();
    await fillRequiredFields();

    await fireEvent.press(screen.getByRole('button', { name: i18n.t('auth.signUp.submitAction') }));
    expect(mockSignUp).not.toHaveBeenCalled();

    // Marketing alone must not unlock the submit — it is optional by law.
    await tick(i18n.t('legal.acceptance.marketingA11yLabel'));
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('auth.signUp.submitAction') }));
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('submits once the mandatory checkbox is ticked and registers the acceptance with the marketing opt-in', async () => {
    mockSignUp.mockResolvedValue(undefined);
    await renderScreen();
    await fillRequiredFields();

    await tick(i18n.t('legal.acceptance.requiredA11yLabel'));
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('auth.signUp.submitAction') }));

    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    // Only the marketing opt-in travels from the client — IP, user agent,
    // timestamp and version are captured server-side (instructivo error #3).
    await waitFor(() => expect(mockRegisterAcceptance).toHaveBeenCalledWith({ marketing: false }));
  });

  it('a failed acceptance record does not strand the already-created account', async () => {
    mockSignUp.mockResolvedValue(undefined);
    mockRegisterAcceptance.mockRejectedValue(new Error('mock_register_acceptance_failed'));
    await renderScreen();
    await fillRequiredFields();

    await tick(i18n.t('legal.acceptance.requiredA11yLabel'));
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('auth.signUp.submitAction') }));

    // The flow completes (awaiting-confirmation notice), not an error screen.
    await waitFor(() => expect(screen.getByText(i18n.t('auth.signUp.checkEmail.title'))).toBeTruthy());
  });

  describe('punto #2 (AJUSTES-PACTUM-2026-09-10): el alta ya no termina acá — sigue a elegir plan', () => {
    it('con sesión creada, navega al paso de plan en vez de al dashboard', async () => {
      mockSignUp.mockImplementation(async () => {
        setMockAuthSessionStatus('signedIn');
      });
      await renderScreen();
      await fillRequiredFields();

      await tick(i18n.t('legal.acceptance.requiredA11yLabel'));
      await fireEvent.press(screen.getByRole('button', { name: i18n.t('auth.signUp.submitAction') }));

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/signup/plan', params: undefined }));
    });

    it('propaga el joinToken pendiente (punto #4) al paso de plan', async () => {
      mockSearchParams = { joinToken: 'mediacionapp://invitacion/mock-abc123' };
      mockSignUp.mockImplementation(async () => {
        setMockAuthSessionStatus('signedIn');
      });
      await renderScreen();
      await fillRequiredFields();

      await tick(i18n.t('legal.acceptance.requiredA11yLabel'));
      await fireEvent.press(screen.getByRole('button', { name: i18n.t('auth.signUp.submitAction') }));

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith({
          pathname: '/signup/plan',
          params: { joinToken: 'mediacionapp://invitacion/mock-abc123' },
        }),
      );
    });

    it('sin sesión (falta confirmar email), no navega — se queda en el aviso', async () => {
      mockSignUp.mockResolvedValue(undefined);
      await renderScreen();
      await fillRequiredFields();

      await tick(i18n.t('legal.acceptance.requiredA11yLabel'));
      await fireEvent.press(screen.getByRole('button', { name: i18n.t('auth.signUp.submitAction') }));

      await waitFor(() => expect(screen.getByText(i18n.t('auth.signUp.checkEmail.title'))).toBeTruthy());
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
