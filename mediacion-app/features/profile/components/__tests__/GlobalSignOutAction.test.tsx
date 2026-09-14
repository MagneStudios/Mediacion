import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';

import { GlobalSignOutAction } from '../GlobalSignOutAction';

const mockDismissAll = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ dismissAll: mockDismissAll, replace: mockReplace }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ isWide: false, isCompact: true, showDesktopSidebar: false, horizontalPadding: 16 }),
}));

const mockSignOut = jest.fn();
jest.mock('../../hooks/useAccountActions', () => ({
  useAccountActions: () => ({
    signOutStatus: 'idle',
    signOut: mockSignOut,
    resetSignOutStatus: jest.fn(),
  }),
}));

function renderAction() {
  return render(
    <I18nextProvider i18n={i18n}>
      <GlobalSignOutAction />
    </I18nextProvider>,
  );
}

describe('GlobalSignOutAction', () => {
  beforeEach(() => {
    mockSignOut.mockReset();
    mockDismissAll.mockReset();
    mockReplace.mockReset();
  });

  it('opens the confirmation dialog when pressed, without signing out yet', async () => {
    await renderAction();

    fireEvent.press(screen.getByLabelText(i18n.t('common.signOut')));

    expect(await screen.findByText(i18n.t('profile.account.signOut.dialogTitle'))).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signs out and redirects to /signed-out on confirm', async () => {
    mockSignOut.mockResolvedValue(true);
    await renderAction();

    fireEvent.press(screen.getByLabelText(i18n.t('common.signOut')));
    fireEvent.press(await screen.findByText(i18n.t('profile.account.signOut.confirm')));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/signed-out');
  });

  it('does not navigate away when sign-out fails', async () => {
    mockSignOut.mockResolvedValue(false);
    await renderAction();

    fireEvent.press(screen.getByLabelText(i18n.t('common.signOut')));
    fireEvent.press(await screen.findByText(i18n.t('profile.account.signOut.confirm')));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
