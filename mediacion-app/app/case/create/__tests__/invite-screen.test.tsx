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

describe('CaseCreateInviteScreen — R-07 pago a cargo selector', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSetInvitationResult.mockReset();
    mockCreateInvitation.mockReset();
    mockDraft = { caseId: 'case-1', invitation: null };
  });

  it('renders both "quién paga" options', async () => {
    await renderScreen();
    expect(screen.getByText(i18n.t('caseCreation.invite.pagoACargo.invitador.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('caseCreation.invite.pagoACargo.invitado.title'))).toBeTruthy();
  });

  it('keeps submit disabled until both a payer and an invitation method are chosen', async () => {
    mockCreateInvitation.mockResolvedValue({
      id: 'inv-1',
      caseId: 'case-1',
      tipo: 'link',
      token: 'tok',
      emailDestino: null,
      estado: 'pendiente',
      pagoACargo: 'invitador',
      createdAt: '2026-08-10T00:00:00.000Z',
    });
    await renderScreen();

    // Pressing submit before either choice is made must be a no-op — the
    // button's own `disabled` prop is what enforces this, checked here via
    // its observable effect since Button's accessibilityLabel falls back to
    // `loadingLabel` regardless of `loading`, making a role/name query
    // unreliable for this particular button.
    submit();
    expect(mockCreateInvitation).not.toHaveBeenCalled();

    await selectCard(i18n.t('caseCreation.invite.pagoACargo.invitador.title'), 1);
    submit();
    expect(mockCreateInvitation).not.toHaveBeenCalled();

    await selectCard(i18n.t('caseCreation.invite.method.link.title'), 2);
    submit();
    await waitFor(() => expect(mockCreateInvitation).toHaveBeenCalled());
  });

  it('sends the selected pagoACargo when preparing the invitation', async () => {
    mockCreateInvitation.mockResolvedValue({
      id: 'inv-1',
      caseId: 'case-1',
      tipo: 'link',
      token: 'tok',
      emailDestino: null,
      estado: 'pendiente',
      pagoACargo: 'invitado',
      createdAt: '2026-08-10T00:00:00.000Z',
    });
    await renderScreen();

    await selectCard(i18n.t('caseCreation.invite.pagoACargo.invitado.title'), 1);
    await selectCard(i18n.t('caseCreation.invite.method.link.title'), 2);
    submit();

    await waitFor(() =>
      expect(mockCreateInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ casoId: 'case-1', tipo: 'link', pagoACargo: 'invitado' }),
      ),
    );
  });
});
