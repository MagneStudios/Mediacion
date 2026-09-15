import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import i18n from '@/i18n';

const t = i18n.t.bind(i18n);

const mockGetInvitation = jest.fn();
const mockResendInvitation = jest.fn();
const mockRegenerateInvitation = jest.fn();

jest.mock('@/services/cases.service', () => ({
  casesService: {
    getInvitation: (...args: unknown[]) => mockGetInvitation(...args),
    resendInvitation: (...args: unknown[]) => mockResendInvitation(...args),
    regenerateInvitation: (...args: unknown[]) => mockRegenerateInvitation(...args),
  },
}));

import { InvitationSection } from '../InvitationSection';

function invitation(
  tipo: 'link' | 'codigo' | 'email' = 'link',
  estado: 'pendiente' | 'aceptada' = 'pendiente',
  token = 'mediacionapp://invitacion/mock-abc',
) {
  return {
    id: 'inv-1',
    caseId: 'case-1',
    tipo,
    token: tipo === 'email' ? null : token,
    emailDestino: tipo === 'email' ? 'a@b.com' : null,
    estado,
    pagoACargo: null,
    createdAt: '2026-09-10T00:00:00.000Z',
  };
}

beforeEach(() => {
  mockGetInvitation.mockReset();
  mockGetInvitation.mockResolvedValue(null);
  mockResendInvitation.mockReset();
  mockRegenerateInvitation.mockReset();
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

  it('does not show resend/regenerate when there is no pending invitation', async () => {
    await render(<InvitationSection caseId="case-1" estado="acordado" />);
    await screen.findByText(t('caseDetail.invitation.noPending'));
    expect(screen.queryByRole('button', { name: t('caseDetail.invitation.resend') })).toBeNull();
    expect(screen.queryByRole('button', { name: t('caseDetail.invitation.regenerateCode') })).toBeNull();
  });

  it('resends the invitation and applies the refreshed result', async () => {
    mockGetInvitation.mockResolvedValue(invitation('link', 'pendiente'));
    mockResendInvitation.mockResolvedValue(invitation('link', 'pendiente'));
    await render(<InvitationSection caseId="case-1" estado="activo" />);

    const resend = await screen.findByRole('button', { name: t('caseDetail.invitation.resend') });
    fireEvent.press(resend);

    await waitFor(() => expect(mockResendInvitation).toHaveBeenCalledWith('case-1', 'inv-1'));
  });

  it('shows a specific message when the invitation can no longer be resent', async () => {
    mockGetInvitation.mockResolvedValue(invitation('link', 'pendiente'));
    mockResendInvitation.mockRejectedValue(new Error('invitacion_no_reenviable'));
    await render(<InvitationSection caseId="case-1" estado="activo" />);

    const resend = await screen.findByRole('button', { name: t('caseDetail.invitation.resend') });
    fireEvent.press(resend);

    expect(await screen.findByText(t('caseDetail.invitation.noLongerResendable'))).toBeTruthy();
  });

  it('regenerates the code after confirming the dialog and reflects the new token', async () => {
    mockGetInvitation.mockResolvedValue(invitation('codigo', 'pendiente', 'OLDCODE'));
    mockRegenerateInvitation.mockResolvedValue(invitation('codigo', 'pendiente', 'NEWCODE'));
    await render(<InvitationSection caseId="case-1" estado="activo" />);

    const regenerate = await screen.findByRole('button', { name: t('caseDetail.invitation.regenerateCode') });
    fireEvent.press(regenerate);

    const confirm = await screen.findByRole('button', { name: t('caseDetail.invitation.regenerateDialog.confirm') });
    fireEvent.press(confirm);

    await waitFor(() => expect(mockRegenerateInvitation).toHaveBeenCalledWith('case-1', 'inv-1'));
    expect(await screen.findByText('NEWCODE')).toBeTruthy();
  });

  it('cancelling the regenerate dialog does not call the service', async () => {
    mockGetInvitation.mockResolvedValue(invitation('codigo', 'pendiente', 'OLDCODE'));
    await render(<InvitationSection caseId="case-1" estado="activo" />);

    const regenerate = await screen.findByRole('button', { name: t('caseDetail.invitation.regenerateCode') });
    fireEvent.press(regenerate);

    const cancel = await screen.findByRole('button', { name: t('caseDetail.invitation.regenerateDialog.cancel') });
    fireEvent.press(cancel);

    expect(mockRegenerateInvitation).not.toHaveBeenCalled();
  });
});
