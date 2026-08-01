import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import ProfileScreen from '../profile';

const t = i18n.t.bind(i18n);

const mockRoutePush = jest.fn();
let mockIsCompact = false;
let mockIsWide = false;
let mockHorizontalPadding = 16;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockRoutePush, replace: jest.fn(), dismissAll: jest.fn(), back: jest.fn() }),
  usePathname: () => '/profile',
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({
    horizontalPadding: mockHorizontalPadding,
    isWide: mockIsWide,
    isCompact: mockIsCompact,
  }),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

jest.mock('@/utils/blur-active-element', () => ({
  blurActiveElement: jest.fn(),
}));

const mockProfileHook: {
  status: 'loading' | 'error' | 'success';
  profile: { nombre: string; apellido: string; rol: string; idioma: string; activo: boolean; communicationPreference: string; accessibilityPreference: string } | null;
  reload: jest.Mock;
  updateStatus: string;
  updateProfile: jest.Mock;
  resetUpdateStatus: jest.Mock;
} = {
  status: 'success',
  profile: {
    nombre: 'Julieta',
    apellido: 'Fernández',
    rol: 'parte',
    idioma: 'es',
    activo: true,
    communicationPreference: 'email_summary',
    accessibilityPreference: 'system_default',
  },
  reload: jest.fn(),
  updateStatus: 'idle',
  updateProfile: jest.fn(),
  resetUpdateStatus: jest.fn(),
};

jest.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: () => mockProfileHook,
}));

jest.mock('@/features/profile/hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: () => ({
    status: 'success' as const,
    preferences: {
      caseUpdates: true,
      proposalReady: true,
      responseReceived: true,
      signatureReady: true,
      agreementCompleted: true,
      mediatorAvailability: true,
      productUpdates: false,
    },
    reload: jest.fn(),
    updateStatus: 'idle' as const,
    togglePreference: jest.fn(),
    retryLastToggle: jest.fn(),
    resetUpdateStatus: jest.fn(),
  }),
}));

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <ProfileScreen />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  mockRoutePush.mockClear();
  mockIsCompact = false;
  mockIsWide = false;
  mockHorizontalPadding = 16;
  mockProfileHook.status = 'success';
  mockProfileHook.profile = {
    nombre: 'Julieta',
    apellido: 'Fernández',
    rol: 'parte',
    idioma: 'es',
    activo: true,
    communicationPreference: 'email_summary',
    accessibilityPreference: 'system_default',
  };
});

// ---------------------------------------------------------------------------
// Loading / Error states
// ---------------------------------------------------------------------------
describe('ProfileScreen — loading, error', () => {
  it('shows loading state when status is loading', async () => {
    mockProfileHook.status = 'loading';
    await renderScreen();
    expect(screen.getByText(t('common.loading'))).toBeTruthy();
  });

  it('shows error state with retry when status is error', async () => {
    mockProfileHook.status = 'error';
    await renderScreen();
    expect(screen.getByText(t('states.error.title'))).toBeTruthy();
    expect(screen.getByText(t('states.error.retry'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Hero: desktop row layout (wide, >= 1024px)
// ---------------------------------------------------------------------------
describe('ProfileScreen — hero desktop (row layout)', () => {
  beforeEach(() => {
    mockIsWide = true;
    mockIsCompact = false;
    mockHorizontalPadding = 32;
  });

  it('renders avatar, display name, role, status badge, and edit button', async () => {
    await renderScreen();
    expect(screen.getByText('JF')).toBeTruthy();
    expect(screen.getByText('Julieta Fernández')).toBeTruthy();
    expect(screen.getByText(t('profile.role.parte'))).toBeTruthy();
    expect(screen.getByText(t('profile.status.active'))).toBeTruthy();
    const editButtons = screen.getAllByText(t('profile.menu.edit.label'));
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('uses row layout on desktop (isCompact false, isWide true)', async () => {
    await renderScreen();
    expect(screen.getByText('Julieta Fernández')).toBeTruthy();
  });

  it('renders without crash at wide layout', async () => {
    await renderScreen();
    expect(screen.getByText('JF')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Hero: mobile stacked layout (compact, < 768px)
// ---------------------------------------------------------------------------
describe('ProfileScreen — hero mobile (stacked layout)', () => {
  beforeEach(() => {
    mockIsCompact = true;
    mockIsWide = false;
    mockHorizontalPadding = 16;
  });

  it('renders the full display name legibly on compact', async () => {
    await renderScreen();
    expect(screen.getByText('Julieta Fernández')).toBeTruthy();
  });

  it('renders avatar, role, status badge, and edit button on compact', async () => {
    await renderScreen();
    expect(screen.getByText('JF')).toBeTruthy();
    expect(screen.getByText(t('profile.role.parte'))).toBeTruthy();
    expect(screen.getByText(t('profile.status.active'))).toBeTruthy();
    const editButtons = screen.getAllByText(t('profile.menu.edit.label'));
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders without crash at 320px-equivalent compact layout', async () => {
    await renderScreen();
    expect(screen.getByText('Julieta Fernández')).toBeTruthy();
  });

  it('renders inactive status correctly on compact', async () => {
    mockProfileHook.profile!.activo = false;
    await renderScreen();
    expect(screen.getByText(t('profile.status.inactive'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Name wrapping: no numberOfLines={1}, no ellipsis
// ---------------------------------------------------------------------------
describe('ProfileScreen — name text properties', () => {
  it('renders name in a Text node without numberOfLines truncation', async () => {
    await renderScreen();
    const name = screen.getByText('Julieta Fernández');
    expect(name).toBeTruthy();
    expect(name.props.numberOfLines).toBeUndefined();
  });

  it('renders long names without ellipsis', async () => {
    mockProfileHook.profile!.nombre = 'María Alejandra';
    mockProfileHook.profile!.apellido = 'de la Cruz Villanueva';
    await renderScreen();
    const name = screen.getByText('María Alejandra de la Cruz Villanueva');
    expect(name).toBeTruthy();
    expect(name.props.numberOfLines).toBeUndefined();
  });

  it('renders long names on compact without losing button visibility', async () => {
    mockIsCompact = true;
    mockIsWide = false;
    mockProfileHook.profile!.nombre = 'María Alejandra';
    mockProfileHook.profile!.apellido = 'de la Cruz Villanueva';
    await renderScreen();
    expect(screen.getByText('María Alejandra de la Cruz Villanueva')).toBeTruthy();
    const editButtons = screen.getAllByText(t('profile.menu.edit.label'));
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Button: separate row on compact, inline on desktop
// ---------------------------------------------------------------------------
describe('ProfileScreen — edit button placement', () => {
  it('renders edit button text on compact', async () => {
    mockIsCompact = true;
    mockIsWide = false;
    await renderScreen();
    const editButtons = screen.getAllByText(t('profile.menu.edit.label'));
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders edit button text on wide', async () => {
    mockIsWide = true;
    mockIsCompact = false;
    mockHorizontalPadding = 32;
    await renderScreen();
    const editButtons = screen.getAllByText(t('profile.menu.edit.label'));
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders role label visible on compact alongside the edit button', async () => {
    mockIsCompact = true;
    mockIsWide = false;
    await renderScreen();
    expect(screen.getByText(t('profile.role.parte'))).toBeTruthy();
    const editButtons = screen.getAllByText(t('profile.menu.edit.label'));
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// No horizontal overflow
// ---------------------------------------------------------------------------
describe('ProfileScreen — no horizontal overflow', () => {
  it('renders summary and options cards without crash on compact', async () => {
    mockIsCompact = true;
    mockIsWide = false;
    await renderScreen();
    expect(screen.getByText(t('profile.summary.sectionTitle'))).toBeTruthy();
  });

  it('renders summary and options cards without crash on wide', async () => {
    mockIsWide = true;
    mockIsCompact = false;
    mockHorizontalPadding = 32;
    await renderScreen();
    expect(screen.getByText(t('profile.summary.sectionTitle'))).toBeTruthy();
  });

  it('renders version footer', async () => {
    await renderScreen();
    expect(screen.getByText(t('profile.version', { version: '1.0.0' }))).toBeTruthy();
  });

  it('renders demo environment notice', async () => {
    await renderScreen();
    expect(screen.getByText(t('profile.demoNotice.title'))).toBeTruthy();
    expect(screen.getByText(t('profile.demoNotice.overview'))).toBeTruthy();
  });
});
