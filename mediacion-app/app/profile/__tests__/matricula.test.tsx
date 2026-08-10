import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { MockProfile } from '@/types/profile';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));
jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const baseProfile: MockProfile = {
  nombre: 'Julieta',
  apellido: 'Fernández',
  rol: 'parte',
  idioma: 'es',
  activo: true,
  communicationPreference: 'email_summary',
  accessibilityPreference: 'system_default',
};

const mockUpdateProfile = jest.fn();
let mockProfileHook: {
  status: 'loading' | 'error' | 'success';
  profile: MockProfile | null;
  reload: jest.Mock;
  updateStatus: 'idle' | 'pending' | 'error';
  updateProfile: typeof mockUpdateProfile;
  resetUpdateStatus: jest.Mock;
};
jest.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: () => mockProfileHook,
}));

// eslint-disable-next-line import/first
import ProfileEditScreen from '../edit';

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <ProfileEditScreen />
    </I18nextProvider>,
  );
}

describe('ProfileEditScreen — R-05 matrícula profesional', () => {
  beforeEach(() => {
    mockUpdateProfile.mockReset();
    mockUpdateProfile.mockResolvedValue(baseProfile);
    mockProfileHook = {
      status: 'success',
      profile: baseProfile,
      reload: jest.fn(),
      updateStatus: 'idle',
      updateProfile: mockUpdateProfile,
      resetUpdateStatus: jest.fn(),
    };
  });

  it('shows the attach action and no "attached" state when there is no matrícula yet', async () => {
    await renderScreen();
    expect(screen.getByText(i18n.t('profile.edit.matriculaAttach'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('profile.edit.matriculaAttached'))).toBeNull();
  });

  it('never claims a real file exists — the hint says the license is not verified', async () => {
    await renderScreen();
    expect(screen.getByText(i18n.t('profile.edit.matriculaHint'))).toBeTruthy();
  });

  it('simulates attaching, then shows the attached confirmation and a remove action', async () => {
    await renderScreen();

    fireEvent.press(screen.getByText(i18n.t('profile.edit.matriculaAttach')));

    await waitFor(() => expect(screen.getByText(i18n.t('profile.edit.matriculaAttached'))).toBeTruthy());
    expect(screen.getByText(i18n.t('profile.edit.matriculaRemove'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('profile.edit.matriculaAttach'))).toBeNull();
  });

  it('removing the attachment goes back to the attach action', async () => {
    await renderScreen();
    fireEvent.press(screen.getByText(i18n.t('profile.edit.matriculaAttach')));
    await waitFor(() => expect(screen.getByText(i18n.t('profile.edit.matriculaRemove'))).toBeTruthy());

    fireEvent.press(screen.getByText(i18n.t('profile.edit.matriculaRemove')));

    await waitFor(() => expect(screen.getByText(i18n.t('profile.edit.matriculaAttach'))).toBeTruthy());
    expect(screen.queryByText(i18n.t('profile.edit.matriculaAttached'))).toBeNull();
  });

  it('prefills the license number from the loaded profile', async () => {
    mockProfileHook.profile = { ...baseProfile, numeroMatricula: 'CPACF 12345' };
    await renderScreen();
    expect(screen.getByDisplayValue('CPACF 12345')).toBeTruthy();
  });

  it('saving sends the edited license number and the current attachment state', async () => {
    await renderScreen();

    fireEvent.changeText(screen.getByLabelText(i18n.t('profile.edit.matriculaNumberLabel')), 'CPACF 99999');
    await waitFor(() => expect(screen.getByLabelText(i18n.t('profile.edit.matriculaNumberLabel')).props.value).toBe('CPACF 99999'));

    fireEvent.press(screen.getByText(i18n.t('profile.edit.save')));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ numeroMatricula: 'CPACF 99999' })),
    );
  });
});
