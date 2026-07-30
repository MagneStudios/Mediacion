import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';

const mockRoutePush = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockRoutePush, replace: jest.fn(), dismissAll: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'case-1' }),
  usePathname: () => '/case/case-1',
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockAgreementHook = {
  status: 'success' as 'loading' | 'error' | 'success',
  state: null as unknown,
};

jest.mock('@/features/agreements/hooks/useAgreement', () => ({
  useAgreement: () => mockAgreementHook,
}));

// eslint-disable-next-line import/first
import { AgreementSummaryCard } from '../AgreementSummaryCard';

function buildState(estado: string) {
  return {
    agreement: {
      id: 'agr-1',
      title: 'Test',
      summary: '',
      terms: [],
      estado,
      readyAt: null,
      completedAt: null,
    },
    signers: [
      { role: 'authenticated_party', status: 'firmado' },
      { role: 'other_party', status: 'firmado' },
    ],
    allSignaturesComplete: estado === 'firmado' || estado === 'con_aviso',
    waitingForOtherParty: false,
    ownSignatureComplete: true,
    readOnly: estado === 'firmado' || estado === 'con_aviso',
    canPrepareDocument: false,
    canSign: false,
  };
}

async function renderCard() {
  await render(
    <I18nextProvider i18n={i18n}>
      <AgreementSummaryCard caseId="case-1" />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  mockRoutePush.mockClear();
  mockAgreementHook.status = 'success';
  mockAgreementHook.state = null;
});

describe('AgreementSummaryCard', () => {
  it('shows con_aviso label when estado is con_aviso', async () => {
    mockAgreementHook.state = buildState('con_aviso');
    await renderCard();
    expect(screen.getByText(i18n.t('agreement.status.con_aviso'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('agreement.status.firmado'))).toBeNull();
  });

  it('shows firmado label when estado is firmado', async () => {
    mockAgreementHook.state = buildState('firmado');
    await renderCard();
    expect(screen.getByText(i18n.t('agreement.status.firmado'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('agreement.status.con_aviso'))).toBeNull();
  });

  it('shows enviado_a_firma label for that estado', async () => {
    mockAgreementHook.state = buildState('enviado_a_firma');
    await renderCard();
    expect(screen.getByText(i18n.t('agreement.status.enviado_a_firma'))).toBeTruthy();
  });

  it('shows borrador label for that estado', async () => {
    const draftState = {
      ...buildState('borrador'),
      allSignaturesComplete: false,
      ownSignatureComplete: false,
      readOnly: false,
    };
    mockAgreementHook.state = draftState;
    await renderCard();
    expect(screen.getByText(i18n.t('agreement.status.borrador'))).toBeTruthy();
  });
});
