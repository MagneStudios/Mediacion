import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { EstadoAcuerdo } from '@/types/agreement';

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

function buildState(estado: EstadoAcuerdo) {
  return {
    agreement: {
      id: 'agr-1',
      title: 'Mock Agreement',
      summary: '',
      terms: [],
      rationale: '',
      estado,
      readyAt: null,
      completedAt: null,
    },
    signers: [],
    waitingForOtherParty: false,
    allSignaturesComplete: estado === 'firmado',
    canPrepareDocument: estado === 'borrador',
    canSign: estado === 'enviado_a_firma',
    readOnly: estado === 'firmado' || estado === 'con_aviso',
  };
}

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
    mockAgreementHook.state = buildState('borrador');
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

describe('AgreementDashboardScreen — breach notice eligibility', () => {
  it('hides the breach notice form for borrador', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('borrador');
    await renderScreen();
    expect(screen.queryByText(i18n.t('agreement.breachNotice.form.title'))).toBeNull();
  });

  it('hides the breach notice form for enviado_a_firma', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('enviado_a_firma');
    await renderScreen();
    expect(screen.queryByText(i18n.t('agreement.breachNotice.form.title'))).toBeNull();
  });

  it('shows the breach notice form for firmado', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('firmado');
    await renderScreen();
    expect(screen.getByText(i18n.t('agreement.breachNotice.form.title'))).toBeTruthy();
  });

  it('shows the breach notice form for con_aviso', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('con_aviso');
    await renderScreen();
    expect(screen.getByText(i18n.t('agreement.breachNotice.form.title'))).toBeTruthy();
  });
});

describe('AgreementDashboardScreen — breach notice behavior', () => {
  beforeEach(() => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('firmado');
  });

  // BreachNoticeForm (not modified by this change) already disables its own
  // submit action whenever the description is blank/whitespace-only — so a
  // real press can never reach the screen's onSubmit handler in that state.
  // That disabled state is itself the validation signal: it structurally
  // guarantees the dialog can never open with an empty description. The
  // screen's own blank-guard in handleBreachSubmit is defense-in-depth for
  // the same rule, already covered directly in BreachNoticeForm's own test
  // suite (disables submit when blank/whitespace).
  it('keeps the submit action disabled and the dialog closed while the description is blank', async () => {
    await renderScreen();
    const submitButton = screen.getByRole('button', { name: i18n.t('agreement.breachNotice.form.submitAction') });
    expect(submitButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(submitButton);
    expect(screen.queryByText(i18n.t('agreement.breachNotice.dialog.title'))).toBeNull();
  });

  it('keeps the submit action disabled and the dialog closed while the description is only whitespace', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')), '   ');
    const submitButton = screen.getByRole('button', { name: i18n.t('agreement.breachNotice.form.submitAction') });
    expect(submitButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(submitButton);
    expect(screen.queryByText(i18n.t('agreement.breachNotice.dialog.title'))).toBeNull();
  });

  it('opens the dialog on a valid (non-blank) submit', async () => {
    await renderScreen();
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')),
      'They missed the handover.',
    );
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.form.submitAction') }));
    const headers = screen.getAllByRole('header');
    expect(headers.some((header) => header.props.children === i18n.t('agreement.breachNotice.dialog.title'))).toBe(true);
  });

  it('closes the dialog on confirm without showing any success copy', async () => {
    await renderScreen();
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')),
      'They missed the handover.',
    );
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.form.submitAction') }));
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.dialog.confirmAction') }));
    expect(screen.queryByText(i18n.t('agreement.breachNotice.dialog.title'))).toBeNull();
    expect(screen.queryByText(/registered/i)).toBeNull();
    expect(screen.queryByText(/registrad[oa]/i)).toBeNull();
  });

  it('closes the dialog on cancel and preserves the typed description', async () => {
    await renderScreen();
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')),
      'They missed the handover.',
    );
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.form.submitAction') }));
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.breachNotice.dialog.cancel') }));
    expect(screen.queryByText(i18n.t('agreement.breachNotice.dialog.title'))).toBeNull();
    expect(screen.getByPlaceholderText(i18n.t('agreement.breachNotice.form.descriptionPlaceholder')).props.value).toBe(
      'They missed the handover.',
    );
  });
});

describe('AgreementDashboardScreen — con_aviso copy no longer contradicts the breach action', () => {
  it('shows the con_aviso notice alongside the still-available breach notice form', async () => {
    mockAgreementHook.status = 'success';
    mockAgreementHook.state = buildState('con_aviso');
    await renderScreen();
    expect(screen.getByText(i18n.t('agreement.status.conAvisoNotice'))).toBeTruthy();
    expect(screen.getByText(i18n.t('agreement.breachNotice.form.title'))).toBeTruthy();
  });

  it('the con_aviso notice no longer claims that no further actions are available', async () => {
    const noticeText = i18n.t('agreement.status.conAvisoNotice');
    expect(noticeText).not.toMatch(/doesn't accept new actions/i);
    expect(noticeText).not.toMatch(/no admite nuevas acciones/i);
  });
});
