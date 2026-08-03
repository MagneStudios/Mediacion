import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import PrivacyScreen from '../privacy';

const t = i18n.t.bind(i18n);

const mockRoutePush = jest.fn();
let mockIsWide = false;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockRoutePush, replace: jest.fn(), dismissAll: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({
    horizontalPadding: mockIsWide ? 32 : 16,
    isWide: mockIsWide,
    isCompact: !mockIsWide,
  }),
}));

jest.mock('@/utils/blur-active-element', () => ({
  blurActiveElement: jest.fn(),
}));

// ProfileMenuItem's own compact/dashboard rendering is covered by
// ProfileMenuItem.test.tsx — here we only need to prove that this screen
// wires the *correct* `compact` value through, so the child is replaced by a
// thin, inspectable stand-in that surfaces the prop it received.
jest.mock('@/features/profile/components/ProfileMenuItem', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text } = require('react-native');
  return {
    ProfileMenuItem: ({ label, onPress, compact }: { label: string; onPress: () => void; compact?: boolean }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        testID={compact ? 'menu-item-compact' : 'menu-item-dashboard'}
      >
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});

function renderScreen() {
  return render(
    <I18nextProvider i18n={i18n}>
      <PrivacyScreen />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  mockRoutePush.mockClear();
  mockIsWide = false;
});

describe('ProfilePrivacyScreen — responsive ProfileMenuItem variant', () => {
  it('uses the compact variant on mobile widths (isWide false)', async () => {
    mockIsWide = false;
    await renderScreen();
    expect(screen.getAllByTestId('menu-item-compact')).toHaveLength(2);
    expect(screen.queryAllByTestId('menu-item-dashboard')).toHaveLength(0);
  });

  it('keeps simple related links compact on desktop widths', async () => {
    mockIsWide = true;
    await renderScreen();
    expect(screen.getAllByTestId('menu-item-compact')).toHaveLength(2);
    expect(screen.queryAllByTestId('menu-item-dashboard')).toHaveLength(0);
  });

  it('preserves navigation, labels and icons on mobile', async () => {
    mockIsWide = false;
    await renderScreen();
    expect(screen.getByText(t('profile.privacy.links.deactivation'))).toBeTruthy();
    expect(screen.getByText(t('profile.privacy.links.support'))).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: t('profile.privacy.links.deactivation') }));
    expect(mockRoutePush).toHaveBeenCalledWith('/profile/account');

    await fireEvent.press(screen.getByRole('button', { name: t('profile.privacy.links.support') }));
    expect(mockRoutePush).toHaveBeenCalledWith('/profile/help');
  });

  it('preserves navigation, labels and icons on desktop', async () => {
    mockIsWide = true;
    await renderScreen();
    expect(screen.getByText(t('profile.privacy.links.deactivation'))).toBeTruthy();
    expect(screen.getByText(t('profile.privacy.links.support'))).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: t('profile.privacy.links.deactivation') }));
    expect(mockRoutePush).toHaveBeenCalledWith('/profile/account');

    await fireEvent.press(screen.getByRole('button', { name: t('profile.privacy.links.support') }));
    expect(mockRoutePush).toHaveBeenCalledWith('/profile/help');
  });

  it('renders no nested buttons — exactly the two menu-item Pressables, nothing more', async () => {
    await renderScreen();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
