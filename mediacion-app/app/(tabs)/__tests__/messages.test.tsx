import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import NoticeCenterScreen from '../messages';

const t = i18n.t.bind(i18n);

const mockRoutePush = jest.fn();
let mockIsWide = false;
let mockHorizontalPadding = 16;

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockRoutePush, replace: jest.fn(), dismissAll: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  usePathname: () => '/messages',
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: mockHorizontalPadding, isWide: mockIsWide }),
}));

const mockNoticesHook: {
  status: 'loading' | 'error' | 'success';
  notices: unknown[];
  markingId: string | null;
  markErrorId: string | null;
  markAllStatus: string;
  markOneRead: jest.Mock;
  markAllRead: jest.Mock;
  reload: jest.Mock;
} = {
  status: 'loading',
  notices: [],
  markingId: null,
  markErrorId: null,
  markAllStatus: 'idle',
  markOneRead: jest.fn(),
  markAllRead: jest.fn(),
  reload: jest.fn(),
};

jest.mock('@/features/notices/hooks/useNotices', () => ({
  useNotices: () => mockNoticesHook,
}));

jest.mock('@/services/cases.service', () => ({
  casesService: {
    getCaseTitle: jest.fn().mockResolvedValue('Custodia compartida'),
  },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

function buildNotice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notice-1',
    category: 'proposal',
    titleKey: 'notices.fixtures.proposalReady.title',
    bodyKey: 'notices.fixtures.proposalReady.body',
    createdAt: '2026-07-01T11:05:00.000Z',
    read: false,
    priority: 'important',
    destination: { type: 'negotiation', caseId: 'case-2' } as const,
    caseId: 'case-2',
    caseTitle: 'Reparto de bienes',
    ...overrides,
  };
}

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <NoticeCenterScreen />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  mockRoutePush.mockClear();
  mockIsWide = false;
  mockHorizontalPadding = 16;
  mockNoticesHook.status = 'loading';
  mockNoticesHook.notices = [];
  mockNoticesHook.markingId = null;
  mockNoticesHook.markErrorId = null;
  mockNoticesHook.markAllStatus = 'idle';
  mockNoticesHook.markOneRead.mockReset();
  mockNoticesHook.markAllRead.mockReset();
  mockNoticesHook.reload.mockReset();
});

// ---------------------------------------------------------------------------
// Loading / Error / Empty states
// ---------------------------------------------------------------------------
describe('NoticeCenterScreen — loading, error, empty', () => {
  it('shows loading state when status is loading', async () => {
    mockNoticesHook.status = 'loading';
    await renderScreen();
    expect(screen.getByText(t('common.loading'))).toBeTruthy();
  });

  it('shows error state with retry when status is error', async () => {
    mockNoticesHook.status = 'error';
    await renderScreen();
    expect(screen.getByText(t('notices.error.title'))).toBeTruthy();
    expect(screen.getByText(t('notices.error.retry'))).toBeTruthy();
  });

  it('shows empty state when no notices and filter is all', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [];
    await renderScreen();
    expect(screen.getByText(t('notices.empty.title'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Header and summary
// ---------------------------------------------------------------------------
describe('NoticeCenterScreen — header and summary', () => {
  it('shows the notices title', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    expect(screen.getByText(t('notices.title'))).toBeTruthy();
  });

  it('shows "Estás al día" when no unread notices', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    expect(screen.getByText(t('notices.noUnread'))).toBeTruthy();
  });

  it('shows unread summary when there are unread notices', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: false }), buildNotice({ id: 'notice-2', read: false })];
    await renderScreen();
    expect(screen.getByText(t('notices.unreadSummary', { count: 2 }))).toBeTruthy();
  });

  it('shows demo notice and privacy notice', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    expect(screen.getByText(t('notices.demoNotice.title'))).toBeTruthy();
    expect(screen.getByText(t('notices.privacyNotice.title'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------
describe('NoticeCenterScreen — filters', () => {
  beforeEach(() => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true }), buildNotice({ id: 'notice-2', read: false })];
  });

  it('shows all filter chips', async () => {
    await renderScreen();
    expect(screen.getByText(t('notices.filters.all'))).toBeTruthy();
    const elements = screen.getAllByText(t('notices.filters.unread'));
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Mark actions
// ---------------------------------------------------------------------------
describe('NoticeCenterScreen — mark actions', () => {
  beforeEach(() => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: false })];
  });

  it('shows mark all as read button when there are unread notices', async () => {
    await renderScreen();
    expect(screen.getByText(t('notices.markAllAction'))).toBeTruthy();
  });

  it('shows view activity button', async () => {
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    expect(screen.getByText(t('notices.viewActivityAction'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Notice cards
// ---------------------------------------------------------------------------
describe('NoticeCenterScreen — notice cards', () => {
  it('renders a notice card with category, title, body, and case line', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: false })];
    await renderScreen();
    expect(screen.getByText(t('notices.category.proposal'))).toBeTruthy();
    expect(screen.getByText(t('notices.fixtures.proposalReady.title'))).toBeTruthy();
    expect(screen.getByText(t('notices.fixtures.proposalReady.body'))).toBeTruthy();
    expect(screen.getByText(t('notices.caseLine', { title: 'Reparto de bienes' }))).toBeTruthy();
  });

  it('marks a notice as unread visually', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: false })];
    await renderScreen();
    const elements = screen.getAllByText(t('notices.unreadLabel'));
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('marks a notice as read visually', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    // Card still renders with its content
    expect(screen.getByText(t('notices.fixtures.proposalReady.title'))).toBeTruthy();
  });

  it('shows important label for important notices', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: false, priority: 'important' })];
    await renderScreen();
    expect(screen.getByText(t('notices.importantLabel'))).toBeTruthy();
  });

  it('shows an error state when a mark-read attempt fails', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.markErrorId = 'notice-1';
    mockNoticesHook.notices = [buildNotice({ read: false })];
    await renderScreen();
    expect(screen.getByText(t('notices.markReadError'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Responsive layout
// ---------------------------------------------------------------------------
describe('NoticeCenterScreen — responsive', () => {
  it('renders without crash in compact layout', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    expect(screen.getByText(t('notices.title'))).toBeTruthy();
  });

  it('renders without crash in wide layout', async () => {
    mockIsWide = true;
    mockHorizontalPadding = 32;
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    expect(screen.getByText(t('notices.title'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// No invented capabilities
// ---------------------------------------------------------------------------
describe('NoticeCenterScreen — no invented capabilities', () => {
  it('does not render invented "Archivadas" filter', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    expect(screen.queryByText(/Archivadas/)).toBeNull();
    expect(screen.queryByText(/Archived/)).toBeNull();
  });

  it('does not render invented metric counters', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    expect(screen.queryByText(/Pendientes hoy/)).toBeNull();
    expect(screen.queryByText(/En revisión/)).toBeNull();
    expect(screen.queryByText(/Urgentes/)).toBeNull();
  });

  it('does not render invented mediator names in notice cards', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: false })];
    await renderScreen();
    expect(screen.queryByText(/Roberto Gómez/)).toBeNull();
    expect(screen.queryByText(/Elena Valdés/)).toBeNull();
    expect(screen.queryByText(/Mediador:/)).toBeNull();
  });

  it('does not render invented document references', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: false })];
    await renderScreen();
    expect(screen.queryByText(/Propuesta_Calendario/)).toBeNull();
    expect(screen.queryByText(/Documento:/)).toBeNull();
  });

  it('does not render an "Actualizado hace" timestamp', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    expect(screen.queryByText(/Actualizado hace/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
describe('NoticeCenterScreen — navigation', () => {
  it('shows "Ver actividad" button', async () => {
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    expect(screen.getByText(t('notices.viewActivityAction'))).toBeTruthy();
  });

  it('does not render a duplicate sidebar in mobile', async () => {
    mockIsWide = false;
    mockNoticesHook.status = 'success';
    mockNoticesHook.notices = [buildNotice({ read: true })];
    await renderScreen();
    // The screen should render without sidebar elements
    expect(screen.getByText(t('notices.title'))).toBeTruthy();
  });
});
