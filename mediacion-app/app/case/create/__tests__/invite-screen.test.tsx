import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16 }),
}));

const mockSetInvitationResult = jest.fn();
let mockDraft: { caseId: string | null; invitation: unknown };
jest.mock('@/features/cases/hooks/useCaseCreationFlow', () => ({
  useCaseCreationFlow: () => ({ draft: mockDraft, setInvitationResult: mockSetInvitationResult }),
}));

const mockCreateInvitation = jest.fn();
jest.mock('@/services/cases.service', () => ({
  casesService: { createInvitation: (...args: unknown[]) => mockCreateInvitation(...args) },
}));

// eslint-disable-next-line import/first
import CaseCreateInviteScreen from '../invite';

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <CaseCreateInviteScreen />
    </I18nextProvider>,
  );
}

function submit() {
  return fireEvent.press(screen.getByText(i18n.t('caseCreation.invite.sendInvitation')));
}

// A SelectableCard press needs to settle before the very next synchronous
// interaction reads state in this test environment — same concern as
// changeText elsewhere (see app/admin/planes/__tests__/create.test.tsx).
// The card's "Selected" badge appearing is the observable settle signal.
async function selectCard(title: string, expectedSelectedCount: number) {
  fireEvent.press(screen.getByText(title));
  await waitFor(() => expect(screen.getAllByText(i18n.t('caseCreation.method.selected'))).toHaveLength(expectedSelectedCount));
}

// Punto #6 (AJUSTES-PACTUM-2026-09-10): "sacar el split 50/50 de la UI y de
// la lógica de cobro". El selector "quién paga" (R-07) se sacó de esta
// pantalla — el modelo pasa a ser suscripción individual por parte.
describe('CaseCreateInviteScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSetInvitationResult.mockReset();
    mockCreateInvitation.mockReset();
    mockDraft = { caseId: 'case-1', invitation: null };
  });

  it('no muestra ningún selector de "quién paga"', async () => {
    await renderScreen();
    expect(screen.queryByText(i18n.t('caseCreation.invite.pagoACargo.invitador.title'))).toBeNull();
    expect(screen.queryByText(i18n.t('caseCreation.invite.pagoACargo.invitado.title'))).toBeNull();
  });

  it('keeps submit disabled until an invitation method is chosen', async () => {
    mockCreateInvitation.mockResolvedValue({
      id: 'inv-1',
      caseId: 'case-1',
      tipo: 'link',
      token: 'tok',
      emailDestino: null,
      estado: 'pendiente',
      pagoACargo: null,
      createdAt: '2026-08-10T00:00:00.000Z',
    });
    await renderScreen();

    // Pressing submit before a method is chosen must be a no-op — the
    // button's own `disabled` prop is what enforces this, checked here via
    // its observable effect since Button's accessibilityLabel falls back to
    // `loadingLabel` regardless of `loading`, making a role/name query
    // unreliable for this particular button.
    submit();
    expect(mockCreateInvitation).not.toHaveBeenCalled();

    await selectCard(i18n.t('caseCreation.invite.method.link.title'), 1);
    submit();
    await waitFor(() => expect(mockCreateInvitation).toHaveBeenCalled());
  });

  it('prepara la invitación sin enviar pagoACargo', async () => {
    mockCreateInvitation.mockResolvedValue({
      id: 'inv-1',
      caseId: 'case-1',
      tipo: 'link',
      token: 'tok',
      emailDestino: null,
      estado: 'pendiente',
      pagoACargo: null,
      createdAt: '2026-08-10T00:00:00.000Z',
    });
    await renderScreen();

    await selectCard(i18n.t('caseCreation.invite.method.link.title'), 1);
    submit();

    await waitFor(() => expect(mockCreateInvitation).toHaveBeenCalled());
    const sentInput = mockCreateInvitation.mock.calls[0][0];
    expect(sentInput).toEqual({ casoId: 'case-1', tipo: 'link', emailDestino: undefined });
    expect(sentInput).not.toHaveProperty('pagoACargo');
  });
});
