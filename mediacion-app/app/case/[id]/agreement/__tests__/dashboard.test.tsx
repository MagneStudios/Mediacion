import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';

const mockReload = jest.fn();
const mockRoutePush = jest.fn();

const mockAgreementHook = {
  status: 'loading' as 'loading' | 'error' | 'success',
  state: null as unknown,
  reload: mockReload,
  prepareStatus: 'idle' as 'idle' | 'pending' | 'error',
  prepareDocument: jest.fn(),
};

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockRoutePush, replace: jest.fn(), dismissAll: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'case-1' }),
  usePathname: () => '/case/case-1/agreement',
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

jest.mock('@/features/agreements/hooks/useAgreement', () => ({
  useAgreement: () => mockAgreementHook,
}));

// eslint-disable-next-line import/first
import AgreementDashboardScreen from '../index';

beforeEach(() => {
  mockReload.mockClear();
  mockRoutePush.mockClear();
  mockAgreementHook.status = 'loading';
  mockAgreementHook.state = null;
  mockAgreementHook.prepareStatus = 'idle';
});

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <AgreementDashboardScreen />
    </I18nextProvider>,
  );
}

describe('AgreementDashboardScreen — rendering states', () => {
  it('renders LoadingState while status is loading', async () => {
    await renderScreen();
    expect(screen.getByText(i18n.t('common.loading'))).toBeTruthy();
  });

  it('renders ErrorState with retry when status is error', async () => {
    mockAgreementHook.status = 'error';
    await renderScreen();
    expect(screen.getByText(i18n.t('states.error.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('states.error.retry'))).toBeTruthy();
  });

  it('renders EmptyState when status is success and state is null', async () => {
    mockAgreementHook.status = 'success';
    await renderScreen();
    expect(screen.getByText(i18n.t('agreement.dashboard.empty.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('agreement.dashboard.empty.description'))).toBeTruthy();
  });

  it('renders the agreement dashboard title when state is present', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = {
      agreement: {
        id: 'agr-1',
        title: 'Mock Agreement',
        summary: '',
        terms: [],
        rationale: '',
        estado: 'borrador' as const,
        readyAt: null,
        completedAt: null,
      },
      signers: [],
      waitingForOtherParty: false,
      allSignaturesComplete: false,
      canPrepareDocument: false,
      canSign: false,
      readOnly: false,
    };
    await renderScreen();
    expect(screen.getByText(i18n.t('agreement.dashboard.title'))).toBeTruthy();
  });

  it('does not render EmptyState while loading', async () => {
    await renderScreen();
    expect(screen.queryByText(i18n.t('agreement.dashboard.empty.title'))).toBeNull();
    expect(screen.queryByText(i18n.t('states.error.title'))).toBeNull();
  });

  it('does not render ErrorState when status is success and state is null', async () => {
    mockAgreementHook.status = 'success';
    await renderScreen();
    expect(screen.queryByText(i18n.t('states.error.title'))).toBeNull();
    expect(screen.queryByText(i18n.t('states.error.retry'))).toBeNull();
  });

  it('does not offer retry on empty state', async () => {
    mockAgreementHook.status = 'success';
    await renderScreen();
    expect(screen.queryByText(i18n.t('states.error.retry'))).toBeNull();
    expect(screen.queryByText(i18n.t('common.retry'))).toBeNull();
  });
});
