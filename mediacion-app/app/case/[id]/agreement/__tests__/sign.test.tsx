import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { AgreementState } from '@/types/agreement';

function makeState(estado: AgreementState['agreement']['estado'] = 'enviado_a_firma'): AgreementState {
  const signed = estado === 'firmado' || estado === 'con_aviso';
  return {
    agreement: {
      id: 'agreement-1',
      caseId: 'case-1',
      sourceProposalId: 'proposal-1',
      sourceRoundNumber: 1,
      title: 'Agreement',
      summary: '',
      terms: [],
      estado,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    signers: [
      { role: 'authenticated_party', status: signed ? 'firmado' : 'pendiente' },
      { role: 'other_party', status: signed ? 'firmado' : 'pendiente' },
    ],
    ownSignatureComplete: signed,
    waitingForOtherParty: false,
    allSignaturesComplete: signed,
    canPrepareDocument: estado === 'borrador',
    canSign: estado === 'enviado_a_firma',
    readOnly: estado === 'firmado' || estado === 'con_aviso',
  };
}

const mockAgreementHook = {
  status: 'success' as const,
  state: makeState(),
  reload: jest.fn(),
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

describe('AgreementSignScreen — estado por firmante (sin acción de firmar)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAgreementHook.state = makeState();
  });

  it('muestra la invitación enviada y no ofrece confirmar la firma', async () => {
    await render(
      <I18nextProvider i18n={i18n}>
        <AgreementSignScreen />
      </I18nextProvider>,
    );

    // La invitación por mail, no un botón de "confirmar": la firma ocurre
    // fuera de la app (SignNow), y un segundo POST /acuerdos/:id/firmar sería
    // un 409. Esta pantalla no debe exponer ninguna acción que lo dispare.
    expect(screen.getByText(i18n.t('agreement.sign.invitationSent.title'))).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();

    // El estado por firmante se muestra con los rótulos de rol, sin nombres.
    expect(screen.getByText(i18n.t('agreement.progress.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('agreement.signer.own'))).toBeTruthy();
    expect(screen.getByText(i18n.t('agreement.signer.other'))).toBeTruthy();
  });

  it('con el acuerdo ya firmado muestra el estado completo, no la invitación', async () => {
    mockAgreementHook.state = makeState('firmado');
    await render(
      <I18nextProvider i18n={i18n}>
        <AgreementSignScreen />
      </I18nextProvider>,
    );

    expect(screen.getByText(i18n.t('agreement.response.completed'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('agreement.sign.invitationSent.title'))).toBeNull();
  });

  it('sin documento listo muestra el estado "no listo", nunca un botón de firmar', async () => {
    mockAgreementHook.state = makeState('borrador');
    await render(
      <I18nextProvider i18n={i18n}>
        <AgreementSignScreen />
      </I18nextProvider>,
    );

    expect(screen.getByText(i18n.t('agreement.sign.notReady'))).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
