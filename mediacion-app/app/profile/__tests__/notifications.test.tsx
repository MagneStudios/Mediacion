import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { NotificationPreferences } from '@/types/profile';
import ProfileNotificationsScreen from '../notifications';

const t = i18n.t.bind(i18n);

const basePrefs: NotificationPreferences = {
  caseUpdates: true,
  proposalReady: true,
  responseReceived: true,
  signatureReady: true,
  agreementCompleted: true,
  mediatorAvailability: true,
  productUpdates: true,
};

const mockReload = jest.fn();
const mockTogglePreference = jest.fn();
const mockRetryLastToggle = jest.fn();

const mockHook = {
  status: 'success' as 'loading' | 'error' | 'success',
  preferences: basePrefs as NotificationPreferences | null,
  reload: mockReload,
  updateStatus: 'idle' as 'idle' | 'pending' | 'error',
  togglePreference: mockTogglePreference,
  retryLastToggle: mockRetryLastToggle,
  resetUpdateStatus: jest.fn(),
};

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false, isCompact: true }),
}));

jest.mock('@/features/profile/hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: () => mockHook,
}));

// The row's own rendering is NotificationPreferenceRow's concern; here we only
// prove the screen wires the right props through. The host RCTSwitch drops the
// `disabled` prop, so the stand-in surfaces it as a testID instead.
jest.mock('@/features/profile/components/NotificationPreferenceRow', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Switch } = require('react-native');
  return {
    NotificationPreferenceRow: ({
      label,
      value,
      onValueChange,
      disabled,
    }: {
      label: string;
      value: boolean;
      onValueChange: (next: boolean) => void;
      disabled?: boolean;
    }) => (
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        testID={disabled ? 'row-disabled' : 'row-enabled'}
      />
    ),
  };
});

function renderScreen() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ProfileNotificationsScreen />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHook.status = 'success';
  mockHook.preferences = basePrefs;
  mockHook.updateStatus = 'idle';
});

describe('ProfileNotificationsScreen', () => {
  it('shows the loading state before the preferences arrive', async () => {
    mockHook.status = 'loading';
    mockHook.preferences = null;
    await renderScreen();

    expect(screen.getByText(t('common.loading'))).toBeTruthy();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('shows the error state and retries via reload', async () => {
    mockHook.status = 'error';
    mockHook.preferences = null;
    await renderScreen();

    expect(screen.getByText(t('states.error.title'))).toBeTruthy();

    await fireEvent.press(screen.getByText(t('states.error.retry')));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('renders one switch per category, reflecting each value', async () => {
    mockHook.preferences = { ...basePrefs, productUpdates: false };
    await renderScreen();

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(7);
    expect(screen.getByLabelText(t('profile.notifications.categories.caseUpdates.label')).props.value).toBe(true);
    expect(screen.getByLabelText(t('profile.notifications.categories.productUpdates.label')).props.value).toBe(false);
  });

  it('toggling a switch reports that category key', async () => {
    await renderScreen();

    const caseUpdates = screen.getByLabelText(t('profile.notifications.categories.caseUpdates.label'));
    await fireEvent(caseUpdates, 'valueChange', false);

    expect(mockTogglePreference).toHaveBeenCalledWith('caseUpdates');
  });

  it('disables every switch while a toggle is pending', async () => {
    mockHook.updateStatus = 'pending';
    await renderScreen();

    expect(screen.getAllByTestId('row-disabled')).toHaveLength(7);
    expect(screen.queryAllByTestId('row-enabled')).toHaveLength(0);
  });

  it('shows the toggle-failure banner and retries the failed toggle', async () => {
    mockHook.updateStatus = 'error';
    await renderScreen();

    expect(screen.getByText(t('profile.notifications.error.title'))).toBeTruthy();

    await fireEvent.press(screen.getByText(t('profile.notifications.error.retry')));
    expect(mockRetryLastToggle).toHaveBeenCalledTimes(1);
  });
});
