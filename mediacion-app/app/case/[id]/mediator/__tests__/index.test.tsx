import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { MediatorState } from '@/types/mediator';

const t = i18n.t.bind(i18n);
const mockRequestMediator = jest.fn();
const mockResetRequestStatus = jest.fn();
let mockCaseId = 'case-1';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockCaseId }),
}));
jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ isWide: false, horizontalPadding: 16 }),
}));

const mockMediatorHook = {
  status: 'success' as 'loading' | 'error' | 'success',
  state: {
    caseId: 'case-1',
    eligibility: 'available',
    mediation: null,
    canRequest: true,
    readOnly: false,
  } as MediatorState | null,
  reload: jest.fn(),
  requestStatus: 'idle' as 'idle' | 'pending' | 'error',
  requestMediator: mockRequestMediator,
  resetRequestStatus: mockResetRequestStatus,
};
jest.mock('@/features/mediator/hooks/useMediator', () => ({
  useMediator: () => mockMediatorHook,
}));

// eslint-disable-next-line import/first
import MediatorDashboardScreen from '../index';

beforeEach(() => {
  jest.clearAllMocks();
  mockCaseId = 'case-1';
  mockMediatorHook.status = 'success';
  mockMediatorHook.state = {
    caseId: 'case-1',
    eligibility: 'available',
    mediation: null,
    canRequest: true,
    readOnly: false,
  };
  mockMediatorHook.requestStatus = 'idle';
  mockRequestMediator.mockResolvedValue(false);
});

describe('MediatorDashboardScreen request recovery', () => {
  it('keeps the dialog open and exposes retry after a failed request', async () => {
    const view = await render(
      <I18nextProvider i18n={i18n}>
        <MediatorDashboardScreen />
      </I18nextProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: t('mediator.summary.requestAction') }));
    await fireEvent.press(screen.getByRole('button', { name: t('mediator.request.dialog.confirm') }));
    expect(mockRequestMediator).toHaveBeenCalledTimes(1);

    mockMediatorHook.requestStatus = 'error';
    await view.rerender(
      <I18nextProvider i18n={i18n}>
        <MediatorDashboardScreen />
      </I18nextProvider>,
    );
    expect(screen.getByText(t('mediator.request.error.title'))).toBeTruthy();
    expect(screen.getByText(t('common.retry'))).toBeTruthy();
  });

  it('invalidates an open confirmation when eligibility changes', async () => {
    const view = await render(
      <I18nextProvider i18n={i18n}>
        <MediatorDashboardScreen />
      </I18nextProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: t('mediator.summary.requestAction') }));
    expect(screen.getByText(t('mediator.request.dialog.title'))).toBeTruthy();

    mockMediatorHook.state = {
      ...mockMediatorHook.state!,
      eligibility: 'pending',
      canRequest: false,
      readOnly: true,
    };
    await view.rerender(
      <I18nextProvider i18n={i18n}>
        <MediatorDashboardScreen />
      </I18nextProvider>,
    );
    expect(screen.queryByText(t('mediator.request.dialog.title'))).toBeNull();
  });

  it('closes the confirmation and resets request state when the case changes', async () => {
    const view = await render(
      <I18nextProvider i18n={i18n}>
        <MediatorDashboardScreen />
      </I18nextProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: t('mediator.summary.requestAction') }));
    mockCaseId = 'case-2';
    await view.rerender(
      <I18nextProvider i18n={i18n}>
        <MediatorDashboardScreen />
      </I18nextProvider>,
    );

    expect(screen.queryByText(t('mediator.request.dialog.title'))).toBeNull();
    expect(mockResetRequestStatus).toHaveBeenLastCalledWith();
  });
});
