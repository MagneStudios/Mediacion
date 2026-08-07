import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));
jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false, isCompact: true }),
}));

const mockProfileHook = {
  status: 'error' as 'loading' | 'error' | 'success',
  profile: null,
  reload: jest.fn(),
  updateStatus: 'idle' as 'idle' | 'pending' | 'error',
  updateProfile: jest.fn(),
  resetUpdateStatus: jest.fn(),
};
jest.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: () => mockProfileHook,
}));

const mockNotificationsHook = {
  status: 'error' as 'loading' | 'error' | 'success',
  preferences: null,
  reload: jest.fn(),
  updateStatus: 'idle' as 'idle' | 'pending' | 'error',
  togglePreference: jest.fn(),
  retryLastToggle: jest.fn(),
};
jest.mock('@/features/profile/hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: () => mockNotificationsHook,
}));

// eslint-disable-next-line import/first
import ProfileEditScreen from '../edit';
// eslint-disable-next-line import/first
import ProfileNotificationsScreen from '../notifications';

const t = i18n.t.bind(i18n);

describe('Profile detail initial fetch errors', () => {
  it('shows a recoverable error instead of loading forever in edit', async () => {
    await render(
      <I18nextProvider i18n={i18n}>
        <ProfileEditScreen />
      </I18nextProvider>,
    );

    expect(screen.getByText(t('states.error.title'))).toBeTruthy();
    expect(screen.getByText(t('states.error.retry'))).toBeTruthy();
  });

  it('shows a recoverable error instead of loading forever in notifications', async () => {
    await render(
      <I18nextProvider i18n={i18n}>
        <ProfileNotificationsScreen />
      </I18nextProvider>,
    );

    expect(screen.getByText(t('states.error.title'))).toBeTruthy();
    expect(screen.getByText(t('states.error.retry'))).toBeTruthy();
  });
});
