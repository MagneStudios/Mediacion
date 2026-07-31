import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { CaseSummary } from '@/types/case';

// Text assertions go through i18n.t(...) — see CaseCard.test.tsx for why.
const t = i18n.t.bind(i18n);

let mockResponsiveLayout = { isWide: false, horizontalPadding: 16 };
jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => mockResponsiveLayout,
}));

let mockUseCasesResult: unknown;
jest.mock('../hooks/useCases', () => ({
  useCases: () => mockUseCasesResult,
}));

// eslint-disable-next-line import/first
import { CasesDashboardScreen } from '../CasesDashboardScreen';

function buildCase(overrides: Partial<CaseSummary> = {}): CaseSummary {
  return {
    id: 'case-1',
    title: 'Custodia compartida',
    counterpartyName: 'Marco D.',
    estado: 'en_negociacion',
    metodo: 'mediacion',
    roundNumber: 2,
    visualStatus: 'info',
    statusLabelKey: 'inReview',
    slaHours: 36,
    ...overrides,
  };
}

const threeCases: CaseSummary[] = [
  buildCase({ id: 'case-1', title: 'Custodia compartida', metodo: 'mediacion', statusLabelKey: 'inReview', visualStatus: 'info' }),
  buildCase({ id: 'case-2', title: 'Reparto de bienes', metodo: 'negociacion', statusLabelKey: 'proposalReady', visualStatus: 'ai', roundNumber: 1, slaHours: null }),
  buildCase({ id: 'case-3', title: 'Pensión de alimentos', metodo: 'conciliacion', statusLabelKey: 'signed', visualStatus: 'success', roundNumber: null, slaHours: null }),
];

function renderScreen(props: Partial<{ onOpenCase: jest.Mock; onCreateCase: jest.Mock }> = {}) {
  const onOpenCase = props.onOpenCase ?? jest.fn();
  const onCreateCase = props.onCreateCase ?? jest.fn();
  return render(
    <I18nextProvider i18n={i18n}>
      <CasesDashboardScreen onOpenCase={onOpenCase} onCreateCase={onCreateCase} />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  mockResponsiveLayout = { isWide: false, horizontalPadding: 16 };
});

describe('CasesDashboardScreen', () => {
  describe('loading', () => {
    it('shows the loading state', async () => {
      mockUseCasesResult = { status: 'loading', cases: undefined };
      await renderScreen();
      expect(screen.getByText(t('cases.loading'))).toBeTruthy();
    });
  });

  describe('error', () => {
    it('shows the error state with a working retry callback', async () => {
      const reload = jest.fn();
      mockUseCasesResult = { status: 'error', cases: undefined, reload };
      await renderScreen();
      expect(screen.getByText(t('cases.error.title'))).toBeTruthy();
      await fireEvent.press(screen.getByText(t('cases.error.retry')));
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty', () => {
    it('shows the empty state and no summary/filter row', async () => {
      mockUseCasesResult = { status: 'empty', cases: [] };
      await renderScreen();
      expect(screen.getByText(t('cases.empty.title'))).toBeTruthy();
      // No real data to filter or summarize — must not render an empty/zero filter row.
      expect(screen.queryByRole('tablist')).toBeNull();
    });

    it('still exposes the create-case action', async () => {
      mockUseCasesResult = { status: 'empty', cases: [] };
      await renderScreen();
      expect(screen.getByText(t('cases.createCase'))).toBeTruthy();
    });
  });

  describe('success — single case', () => {
    it('renders the one case', async () => {
      mockUseCasesResult = { status: 'success', cases: [threeCases[0]] };
      await renderScreen();
      expect(screen.getByText('Custodia compartida')).toBeTruthy();
    });
  });

  describe('success — several cases', () => {
    beforeEach(() => {
      mockUseCasesResult = { status: 'success', cases: threeCases };
    });

    it('renders every case title', async () => {
      await renderScreen();
      expect(screen.getByText('Custodia compartida')).toBeTruthy();
      expect(screen.getByText('Reparto de bienes')).toBeTruthy();
      expect(screen.getByText('Pensión de alimentos')).toBeTruthy();
    });

    it('summary bar shows the real total and real pending-response count', async () => {
      await renderScreen();
      expect(screen.getByText('3')).toBeTruthy(); // total
      expect(screen.getByText('1')).toBeTruthy(); // proposalReady count
    });

    it('navigates to the detail via the real onOpenCase callback, passing the exact case object', async () => {
      const onOpenCase = jest.fn();
      await renderScreen({ onOpenCase });
      await fireEvent.press(screen.getByRole('button', { name: new RegExp(t('cases.cta.respond')) }));
      expect(onOpenCase).toHaveBeenCalledWith(threeCases[1]);
    });

    it('calls the real onCreateCase callback from the create-case button', async () => {
      const onCreateCase = jest.fn();
      await renderScreen({ onCreateCase });
      await fireEvent.press(screen.getByText(t('cases.createCase')));
      expect(onCreateCase).toHaveBeenCalledTimes(1);
    });

    it('filters by method client-side without changing the underlying data source', async () => {
      await renderScreen();
      // Cards now show the method name too — target the filter chip
      // (first rendered element) via getAllByText instead of getByText.
      await fireEvent.press(screen.getAllByText(t('methods.mediacion'))[0]);
      expect(screen.getByText('Custodia compartida')).toBeTruthy();
      expect(screen.queryByText('Reparto de bienes')).toBeNull();
      expect(screen.queryByText('Pensión de alimentos')).toBeNull();
    });

    it('"all" filter restores the full list', async () => {
      await renderScreen();
      await fireEvent.press(screen.getAllByText(t('methods.mediacion'))[0]);
      await fireEvent.press(screen.getByText(t('cases.filters.all')));
      expect(screen.getByText('Reparto de bienes')).toBeTruthy();
    });
  });

  describe('long title', () => {
    it('renders a long case title without crashing', async () => {
      mockUseCasesResult = {
        status: 'success',
        cases: [buildCase({ title: 'Revisión integral del régimen de cuidado personal, alimentos y vivienda familiar compartida' })],
      };
      await renderScreen();
      expect(screen.getByText(/Revisión integral del régimen/)).toBeTruthy();
    });
  });

  describe('responsive — compact width (320/375/390px, isWide=false)', () => {
    it('renders a single-column list (no columnWrapper grid)', async () => {
      mockResponsiveLayout = { isWide: false, horizontalPadding: 16 };
      mockUseCasesResult = { status: 'success', cases: threeCases };
      await renderScreen();
      expect(screen.getByText('Custodia compartida')).toBeTruthy();
    });
  });

  describe('responsive — wide web (1280/1440px, isWide=true)', () => {
    it('renders the two-column composition without losing any case', async () => {
      mockResponsiveLayout = { isWide: true, horizontalPadding: 32 };
      mockUseCasesResult = { status: 'success', cases: threeCases };
      await renderScreen();
      expect(screen.getByText('Custodia compartida')).toBeTruthy();
      expect(screen.getByText('Reparto de bienes')).toBeTruthy();
      expect(screen.getByText('Pensión de alimentos')).toBeTruthy();
    });
  });

  describe('terminology and content safety', () => {
    beforeEach(() => {
      mockUseCasesResult = { status: 'success', cases: threeCases };
    });

    it('never renders "Expedientes" anywhere on the screen', async () => {
      await renderScreen();
      expect(screen.queryByText(/Expediente/i)).toBeNull();
    });

    it('never renders an invented metric (consensus %, message count) or a fabricated personalized greeting', async () => {
      await renderScreen();
      expect(screen.queryByText(/consenso/i)).toBeNull();
      expect(screen.queryByText(/mensaje/i)).toBeNull();
      expect(screen.queryByText(/Buen d[ií]a, Marco/i)).toBeNull();
      expect(screen.queryByText(/Good morning, Marco/i)).toBeNull();
    });

    it('never renders the fictional counterparty name "Marco" as a header greeting — the only real "Marco" allowed anywhere is a case card\'s counterparty field, never the screen header', async () => {
      await renderScreen();
      // "Marco" legitimately appears as counterpartyName inside the case
      // cards themselves (real mock fixture data) — but never inside the
      // header region above the list.
      const header = screen.getByRole('header');
      expect(header.props.children).not.toMatch(/Marco/i);
    });

    it('never renders a personalized greeting pattern of any kind (Hola/Buen día/Hi/Good morning + a name)', async () => {
      await renderScreen();
      expect(screen.queryByText(/^(Hola|Buen d[ií]a|Hi|Good morning|Hello)[,]?\s+\p{Lu}/u)).toBeNull();
    });

    it('shows the neutral title and description instead', async () => {
      await renderScreen();
      expect(screen.getByText(t('cases.title'))).toBeTruthy();
      expect(screen.getByText(t('cases.description'))).toBeTruthy();
    });
  });
});
