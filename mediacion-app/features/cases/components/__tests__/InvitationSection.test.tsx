import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import i18n from '@/i18n';

const t = i18n.t.bind(i18n);

const mockGetInvitation = jest.fn();

jest.mock('@/services/cases.service', () => ({
  casesService: {
    getInvitation: (...args: unknown[]) => mockGetInvitation(...args),
  },
}));

import { InvitationSection } from '../InvitationSection';

function invitation(tipo: 'link' | 'codigo' | 'email' = 'link', estado: 'pendiente' | 'aceptada' = 'pendiente') {
  return {
    id: 'inv-1',
    caseId: 'case-1',
    tipo,
    token: tipo === 'email' ? null : 'mediacionapp://invitacion/mock-abc',
    emailDestino: tipo === 'email' ? 'a@b.com' : null,
    estado,
    pagoACargo: null,
    createdAt: '2026-09-10T00:00:00.000Z',
  };
}

beforeEach(() => {
  mockGetInvitation.mockReset();
  mockGetInvitation.mockResolvedValue(null);
});

describe('InvitationSection', () => {
  it('fetches the invitation on mount (owns its own fetch)', async () => {
    await render(<InvitationSection caseId="case-1" estado="activo" />);
    expect(mockGetInvitation).toHaveBeenCalledWith('case-1');
  });

  it('shows the view-invitation button for a nuevo case with no invitation yet', async () => {
    await render(<InvitationSection caseId="case-1" estado="nuevo" />);
    expect(await screen.findByText(t('caseDetail.awaitingCounterparty.viewInvitation'))).toBeTruthy();
  });

  it('shows a pending invitation badge and copy/share once loaded', async () => {
    mockGetInvitation.mockResolvedValue(invitation('link', 'pendiente'));
    await render(<InvitationSection caseId="case-1" estado="activo" />);
    expect(await screen.findByText(t('caseDetail.awaitingCounterparty.invitationStatus.pendiente'))).toBeTruthy();
  });

  it('loads the invitation when the view-invitation button is pressed', async () => {
    mockGetInvitation.mockResolvedValueOnce(null).mockResolvedValueOnce(invitation('codigo', 'pendiente'));
    await render(<InvitationSection caseId="case-1" estado="nuevo" />);

    await screen.findByText(t('caseDetail.awaitingCounterparty.viewInvitation'));
    fireEvent.press(screen.getByText(t('caseDetail.awaitingCounterparty.viewInvitation')));

    await waitFor(() =>
      expect(screen.getByText(t('caseDetail.awaitingCounterparty.invitationStatus.pendiente'))).toBeTruthy(),
    );
  });

  it('shows the no-pending message (not a fake badge) for a non-nuevo case with no invitation', async () => {
    await render(<InvitationSection caseId="case-1" estado="acordado" />);
    expect(await screen.findByText(t('caseDetail.invitation.noPending'))).toBeTruthy();
    expect(screen.queryByText(t('caseDetail.awaitingCounterparty.invitationStatus.pendiente'))).toBeNull();
  });

  it('always shows disabled reenviar/regenerar with a visible disabledReason', async () => {
    await render(<InvitationSection caseId="case-1" estado="activo" />);
    const resend = screen.getByRole('button', { name: t('caseDetail.invitation.resend') });
    const regenerate = screen.getByRole('button', { name: t('caseDetail.invitation.regenerateCode') });
    expect(resend.props.accessibilityState?.disabled).toBe(true);
    expect(regenerate.props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText(t('caseDetail.invitation.disabledReason'))).toBeTruthy();
  });
});
