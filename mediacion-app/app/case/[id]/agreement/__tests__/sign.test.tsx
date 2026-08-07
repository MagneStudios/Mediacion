import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';

const mockSubmitSignature = jest.fn();
const mockResetSignStatus = jest.fn();

const mockAgreementHook = {
  status: 'success' as const,
  state: {
    agreement: {
      id: 'agreement-1',
      caseId: 'case-1',
      sourceProposalId: 'proposal-1',
      sourceRoundNumber: 1,
      title: 'Agreement',
      summary: '',
      terms: [],
      estado: 'enviado_a_firma' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    signers: [
      { role: 'authenticated_party' as const, status: 'pendiente' as const },
      { role: 'other_party' as const, status: 'pendiente' as const },
    ],
    ownSignatureComplete: false,
    waitingForOtherParty: false,
    allSignaturesComplete: false,
    canPrepareDocument: false,
    canSign: true,
    readOnly: false,
  },
  reload: jest.fn(),
  signStatus: 'error' as 'idle' | 'pending' | 'error',
  submitSignature: mockSubmitSignature,
  resetSignStatus: mockResetSignStatus,
};

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'case-1' }),
}));
jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));
jest.mock('@/features/agreements/hooks/useAgreement', () => ({
  useAgreement: () => mockAgreementHook,
}));

// eslint-disable-next-line import/first
import AgreementSignScreen from '../sign';

beforeEach(() => {
  jest.clearAllMocks();
  mockAgreementHook.signStatus = 'error';
});

describe('AgreementSignScreen failure recovery', () => {
  it('requires a fresh confirmation and never exposes a retry that silently does nothing', async () => {
    await render(
      <I18nextProvider i18n={i18n}>
        <AgreementSignScreen />
      </I18nextProvider>,
    );

    expect(screen.getByText(i18n.t('agreement.sign.error.title'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: i18n.t('common.retry') })).toBeNull();

    const submit = screen.getByRole('button', { name: i18n.t('agreement.sign.action') });
    expect(submit.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox', { name: i18n.t('agreement.sign.confirmationLabel') }));
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('agreement.sign.action') }));

    expect(mockResetSignStatus).toHaveBeenCalledTimes(1);
    expect(mockSubmitSignature).toHaveBeenCalledWith('agreement-1');
  });
});
