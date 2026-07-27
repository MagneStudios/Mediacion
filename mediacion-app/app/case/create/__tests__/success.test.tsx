import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';

let mockCaseId: string | null;
const mockRouteReplace = jest.fn();
const mockRouteDismissTo = jest.fn();
const mockRoutePush = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ replace: mockRouteReplace, dismissTo: mockRouteDismissTo, push: mockRoutePush, dismissAll: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/case/create/success',
}));

jest.mock('@/features/cases/hooks/useCaseCreationFlow', () => ({
  useCaseCreationFlow: () => ({ draft: { caseId: mockCaseId, invitation: { tipo: 'link', token: 'abc' } }, reset: jest.fn() }),
}));

// eslint-disable-next-line import/first
import CaseCreateSuccessScreen from '../success';

beforeEach(() => {
  mockCaseId = 'case-1';
  mockRouteReplace.mockClear();
  mockRouteDismissTo.mockClear();
  mockRoutePush.mockClear();
});

async function renderScreen() {
  await render(<I18nextProvider i18n={i18n}><CaseCreateSuccessScreen /></I18nextProvider>);
}

const tap = (label: string) => screen.getByText(label).parent?.props.onClick?.({} as never);

describe('CaseCreateSuccessScreen — navigation', () => {
  it('calls router.replace exactly once when caseId exists', async () => {
    await renderScreen();
    tap(i18n.t('caseCreation.success.viewCase'));
    expect(mockRouteReplace).toHaveBeenCalledTimes(1);
  });

  it('navigates to /case/[id] with the correct id', async () => {
    await renderScreen();
    tap(i18n.t('caseCreation.success.viewCase'));
    expect(mockRouteReplace).toHaveBeenCalledWith({ pathname: '/case/[id]', params: { id: 'case-1' } });
  });

  it('does NOT call router.push', async () => {
    await renderScreen();
    tap(i18n.t('caseCreation.success.viewCase'));
    expect(mockRoutePush).not.toHaveBeenCalled();
  });

  it('does NOT call dismissTo with /(tabs) when caseId exists', async () => {
    await renderScreen();
    tap(i18n.t('caseCreation.success.viewCase'));
    expect(mockRouteDismissTo).not.toHaveBeenCalled();
  });

  it('falls back to dismissTo when caseId is missing', async () => {
    mockCaseId = null;
    await renderScreen();
    tap(i18n.t('caseCreation.success.viewCase'));
    expect(mockRouteDismissTo).toHaveBeenCalledWith('/(tabs)');
    expect(mockRouteReplace).not.toHaveBeenCalled();
  });

  it('does not perform two navigation actions', async () => {
    await renderScreen();
    tap(i18n.t('caseCreation.success.viewCase'));
    const total = mockRouteReplace.mock.calls.length + mockRoutePush.mock.calls.length + mockRouteDismissTo.mock.calls.length;
    expect(total).toBe(1);
  });
});
