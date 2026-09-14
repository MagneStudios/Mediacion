import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { InvitationResultCard } from '../InvitationResultCard';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('InvitationResultCard', () => {
  it('renders the label and value', async () => {
    await render(<InvitationResultCard label="Código" value="ABC123" />);
    expect(screen.getByText('Código')).toBeTruthy();
    expect(screen.getByText('ABC123')).toBeTruthy();
  });

  it('renders no action row when neither copy nor share labels are given (e.g. email destination)', async () => {
    await render(<InvitationResultCard label="Correo" value="alguien@example.com" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  // Punto #5 (AJUSTES-PACTUM-2026-09-10): "ofrecer las dos vías: copiar
  // código y copiar/compartir link".
  describe('punto #5: compartir', () => {
    it('shows a share button when shareLabel is given, alongside copy', async () => {
      await render(<InvitationResultCard label="Enlace" value="https://x" copyLabel="Copiar enlace" shareLabel="Compartir enlace" />);
      expect(screen.getByText('Copiar enlace')).toBeTruthy();
      expect(screen.getByText('Compartir enlace')).toBeTruthy();
    });

    it('calls Share.share with the raw value', async () => {
      const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
      await render(<InvitationResultCard label="Enlace" value="https://x/mock-abc" shareLabel="Compartir enlace" />);

      await fireEvent.press(screen.getByText('Compartir enlace'));

      await waitFor(() => expect(shareSpy).toHaveBeenCalledWith({ message: 'https://x/mock-abc' }));
      shareSpy.mockRestore();
    });

    it('does not throw when the share sheet is dismissed without picking a target', async () => {
      const shareSpy = jest.spyOn(Share, 'share').mockRejectedValue(new Error('dismissed'));
      await render(<InvitationResultCard label="Enlace" value="https://x" shareLabel="Compartir enlace" />);

      await fireEvent.press(screen.getByText('Compartir enlace'));

      await waitFor(() => expect(shareSpy).toHaveBeenCalled());
      shareSpy.mockRestore();
    });
  });
});
