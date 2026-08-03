import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';

const t = i18n.t.bind(i18n);

const mockRoutePush = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockRoutePush, replace: jest.fn(), dismissAll: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'case-1' }),
  usePathname: () => '/case/case-1',
}));

let mockIsWide = false;
let mockHorizontalPadding = 16;

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: mockHorizontalPadding, isWide: mockIsWide }),
}));

const mockNegotiation: { status: string; state: unknown } = {
  status: 'loading',
  state: null,
};
jest.mock('@/features/negotiation/hooks/useNegotiation', () => ({
  useNegotiation: () => mockNegotiation,
}));

const mockMediator: { status: string; state: unknown } = {
  status: 'loading',
  state: null,
};
jest.mock('@/features/mediator/hooks/useMediator', () => ({
  useMediator: () => mockMediator,
}));

const mockAgreement: { status: string; state: unknown } = {
  status: 'loading',
  state: null,
};
jest.mock('@/features/agreements/hooks/useAgreement', () => ({
  useAgreement: () => mockAgreement,
}));

jest.mock('@/services/cases.service', () => ({
  casesService: {
    getInvitation: jest.fn(),
    simulateInvitationAcceptance: jest.fn(),
  },
}));

jest.mock('@/services/activity.service', () => ({
  appendCaseActivity: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/notices.service', () => ({
  appendCaseNotice: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

let mockDetail: unknown = null;
let mockStatus: 'loading' | 'error' | 'success' = 'loading';

jest.mock('@/features/cases/hooks/useCaseDetail', () => ({
  useCaseDetail: () => ({ status: mockStatus, detail: mockDetail, reload: jest.fn() }),
}));

import { CaseDetailScreen } from '../CaseDetailScreen';

function buildDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1',
    title: 'Custodia compartida',
    caseCode: 'CASO-2026-0431',
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

async function renderScreen(caseId = 'case-1') {
  await render(
    <I18nextProvider i18n={i18n}>
      <CaseDetailScreen caseId={caseId} />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  mockRoutePush.mockClear();
  mockDetail = null;
  mockStatus = 'loading';
  mockNegotiation.status = 'loading';
  mockNegotiation.state = null;
  mockMediator.status = 'loading';
  mockMediator.state = null;
  mockAgreement.status = 'loading';
  mockAgreement.state = null;
  mockIsWide = false;
  mockHorizontalPadding = 16;
});

// ---------------------------------------------------------------------------
// Loading / Error states
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — loading and error', () => {
  it('shows loading state when status is loading', async () => {
    mockStatus = 'loading';
    await renderScreen();
    expect(screen.getByText(t('common.loading'))).toBeTruthy();
  });

  it('shows error state with retry when status is error', async () => {
    mockStatus = 'error';
    mockDetail = null;
    await renderScreen();
    expect(screen.getByText(t('states.error.title'))).toBeTruthy();
    expect(screen.getByText(t('states.error.retry'))).toBeTruthy();
  });

  it('shows error state when detail is null even with success status', async () => {
    mockStatus = 'success';
    mockDetail = null;
    await renderScreen();
    expect(screen.getByText(t('states.error.title'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Awaiting counterparty state (estado === 'nuevo')
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — awaiting counterparty', () => {
  beforeEach(() => {
    mockDetail = buildDetail({
      estado: 'nuevo',
      visualStatus: 'info',
      statusLabelKey: 'awaitingCounterparty',
      counterpartyName: null,
      roundNumber: null,
    });
    mockStatus = 'success';
  });

  it('shows awaiting counterparty status pill in the header', async () => {
    await renderScreen();
    const elements = screen.getAllByText(t('cases.status.awaitingCounterparty'));
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows view invitation button', async () => {
    await renderScreen();
    expect(screen.getByText(t('caseDetail.awaitingCounterparty.viewInvitation'))).toBeTruthy();
  });

  it('shows simulate acceptance button', async () => {
    await renderScreen();
    expect(screen.getByText(t('caseDetail.awaitingCounterparty.simulateAcceptance.action'))).toBeTruthy();
  });

  it('does not show positions section when awaiting counterparty', async () => {
    await renderScreen();
    expect(screen.queryByText(t('caseDetail.positions.title'))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Active case state
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — active case', () => {
  beforeEach(() => {
    mockDetail = buildDetail();
    mockStatus = 'success';
  });

  it('shows case title', async () => {
    await renderScreen();
    expect(screen.getByText('Custodia compartida')).toBeTruthy();
  });

  it('shows case code', async () => {
    await renderScreen();
    expect(screen.getByText(t('caseDetail.caseCode', { code: 'CASO-2026-0431' }))).toBeTruthy();
  });

  it('shows method badge', async () => {
    await renderScreen();
    expect(screen.getByText(t('methods.mediacion'))).toBeTruthy();
  });

  it('shows status pill', async () => {
    await renderScreen();
    expect(screen.getByText(t('cases.status.inReview'))).toBeTruthy();
  });

  it('shows private positions section with privacy notice', async () => {
    await renderScreen();
    expect(screen.getByText(t('caseDetail.positions.title'))).toBeTruthy();
    expect(screen.getByText(t('caseDetail.positions.supportingCopy'))).toBeTruthy();
  });

  it('shows negotiation section', async () => {
    await renderScreen();
    expect(screen.getByText(t('negotiation.sectionTitle'))).toBeTruthy();
  });

  it('shows mediator section when eligibility is available', async () => {
    mockMediator.status = 'success';
    mockMediator.state = {
      mediation: null,
      eligibility: 'available',
    };
    await renderScreen();
    expect(screen.getByText(t('mediator.sectionTitle'))).toBeTruthy();
  });

  it('shows agreement section only when estado is acordado', async () => {
    await renderScreen();
    expect(screen.queryByText(t('agreement.sectionTitle'))).toBeNull();

    mockDetail = buildDetail({ estado: 'acordado', visualStatus: 'success', statusLabelKey: 'signed' });
    mockAgreement.status = 'success';
    mockAgreement.state = {
      agreement: { id: 'a1', title: 'Test', summary: '', terms: [], estado: 'firmado', readyAt: null, completedAt: null },
      signers: [{ role: 'authenticated_party', status: 'firmado' }, { role: 'other_party', status: 'firmado' }],
      allSignaturesComplete: true,
      waitingForOtherParty: false,
      ownSignatureComplete: true,
      readOnly: true,
      canPrepareDocument: false,
      canSign: false,
    };
    await renderScreen();
    expect(screen.getByText(t('agreement.sectionTitle'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Method and status visibility
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — method and status visibility', () => {
  beforeEach(() => {
    mockDetail = buildDetail();
    mockStatus = 'success';
  });

  it('shows conciliacion method badge when metodo is conciliacion', async () => {
    mockDetail = buildDetail({ metodo: 'conciliacion' });
    await renderScreen();
    expect(screen.getByText(t('methods.conciliacion'))).toBeTruthy();
  });

  it('shows negociacion method badge when metodo is negociacion', async () => {
    mockDetail = buildDetail({ metodo: 'negociacion' });
    await renderScreen();
    const elements = screen.getAllByText(t('methods.negociacion'));
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Privacy — "La contraparte no puede verla"
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — privacy', () => {
  it('always shows the privacy-supporting copy in the positions section', async () => {
    mockDetail = buildDetail();
    mockStatus = 'success';
    await renderScreen();
    expect(screen.getByText(t('caseDetail.positions.supportingCopy'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Responsive layout — compact and wide
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — responsive', () => {
  it('renders without crash in compact layout', async () => {
    mockDetail = buildDetail();
    mockStatus = 'success';
    await renderScreen();
    expect(screen.getByText('Custodia compartida')).toBeTruthy();
  });

  it('renders in wide layout with no empty rail when secondary renders nothing', async () => {
    mockIsWide = true;
    mockHorizontalPadding = 32;
    mockDetail = buildDetail();
    mockStatus = 'success';
    // Mediator renders nothing (hideWhenUnavailable + loading) and no
    // agreement applies — the secondary rail collapses, primary content
    // still renders fully.
    mockMediator.status = 'loading';
    mockMediator.state = null;
    await renderScreen();
    expect(screen.getByText('Custodia compartida')).toBeTruthy();
    expect(screen.getByText(t('caseDetail.positions.title'))).toBeTruthy();
    expect(screen.getByText(t('negotiation.sectionTitle'))).toBeTruthy();
    expect(screen.queryByText(t('mediator.sectionTitle'))).toBeNull();
  });

  it('does not render a fixed-width empty rail at round 3 when mediator is still hidden', async () => {
    mockIsWide = true;
    mockHorizontalPadding = 32;
    mockDetail = buildDetail({ roundNumber: 3 });
    mockStatus = 'success';
    // Round 3 alone does NOT force a rail: the mediator card is still
    // self-hidden by its own visibility rules, so the layout must adapt
    // to the real (absent) secondary content.
    mockMediator.status = 'success';
    mockMediator.state = {
      mediation: null,
      eligibility: 'unavailable_before_round_3',
    };
    await renderScreen();
    expect(screen.getByText('Custodia compartida')).toBeTruthy();
    expect(screen.getByText(t('caseDetail.positions.title'))).toBeTruthy();
    expect(screen.queryByText(t('mediator.sectionTitle'))).toBeNull();
  });

  it('renders mediator content in wide layout when the mediator card actually shows it', async () => {
    mockIsWide = true;
    mockHorizontalPadding = 32;
    mockDetail = buildDetail({ roundNumber: 3 });
    mockStatus = 'success';
    mockMediator.status = 'success';
    mockMediator.state = {
      mediation: null,
      eligibility: 'available',
    };
    await renderScreen();
    expect(screen.getByText('Custodia compartida')).toBeTruthy();
    expect(screen.getByText(t('mediator.sectionTitle'))).toBeTruthy();
  });

  it('renders agreement content in wide layout when acordado', async () => {
    mockIsWide = true;
    mockHorizontalPadding = 32;
    mockDetail = buildDetail({ estado: 'acordado', visualStatus: 'success', statusLabelKey: 'signed' });
    mockStatus = 'success';
    mockAgreement.status = 'success';
    mockAgreement.state = {
      agreement: { id: 'a1', title: 'Test', summary: '', terms: [], estado: 'firmado', readyAt: null, completedAt: null },
      signers: [{ role: 'authenticated_party', status: 'firmado' }, { role: 'other_party', status: 'firmado' }],
      allSignaturesComplete: true,
      waitingForOtherParty: false,
      ownSignatureComplete: true,
      readOnly: true,
      canPrepareDocument: false,
      canSign: false,
    };
    await renderScreen();
    expect(screen.getByText(t('agreement.sectionTitle'))).toBeTruthy();
  });

  it('renders both mediator and agreement content in wide layout when both are present', async () => {
    mockIsWide = true;
    mockHorizontalPadding = 32;
    mockDetail = buildDetail({ estado: 'acordado', visualStatus: 'success', statusLabelKey: 'signed' });
    mockStatus = 'success';
    mockMediator.status = 'success';
    mockMediator.state = {
      mediation: { id: 'm1', caseId: 'case-1', estado: 'aceptada', ronda: 3, fechaSolicitud: '', fechaAceptacion: '' },
      eligibility: 'assigned',
    };
    mockAgreement.status = 'success';
    mockAgreement.state = {
      agreement: { id: 'a1', title: 'Test', summary: '', terms: [], estado: 'firmado', readyAt: null, completedAt: null },
      signers: [{ role: 'authenticated_party', status: 'firmado' }, { role: 'other_party', status: 'firmado' }],
      allSignaturesComplete: true,
      waitingForOtherParty: false,
      ownSignatureComplete: true,
      readOnly: true,
      canPrepareDocument: false,
      canSign: false,
    };
    await renderScreen();
    expect(screen.getByText(t('mediator.sectionTitle'))).toBeTruthy();
    expect(screen.getByText(t('agreement.sectionTitle'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Header — long title and metadata
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — header', () => {
  it('renders long titles without crash', async () => {
    mockDetail = buildDetail({
      title: 'Custodia compartida y régimen de visitas para los menores durante el período vacacional extendido',
    });
    mockStatus = 'success';
    await renderScreen();
    expect(screen.getByText(
      'Custodia compartida y régimen de visitas para los menores durante el período vacacional extendido',
    )).toBeTruthy();
  });

  it('shows counterparty name when available', async () => {
    mockDetail = buildDetail({ counterpartyName: 'Marco D.' });
    mockStatus = 'success';
    await renderScreen();
    expect(screen.getByText(/Marco D\./)).toBeTruthy();
  });

  it('shows round number when available', async () => {
    mockDetail = buildDetail({ roundNumber: 2 });
    mockStatus = 'success';
    await renderScreen();
    const roundText = t('cases.round', { number: 2 });
    expect(screen.getByText(new RegExp(roundText))).toBeTruthy();
  });

  it('combines counterparty and round into one line', async () => {
    mockDetail = buildDetail({ counterpartyName: 'Marco D.', roundNumber: 2 });
    mockStatus = 'success';
    await renderScreen();
    const roundText = t('cases.round', { number: 2 });
    expect(screen.getByText(/Marco D\./)).toBeTruthy();
    expect(screen.getByText(new RegExp(roundText))).toBeTruthy();
  });

  it('does not render empty subinfo line when no counterparty and no round', async () => {
    mockDetail = buildDetail({ counterpartyName: null, roundNumber: null });
    mockStatus = 'success';
    await renderScreen();
    // Title, case code, method badge, and status pill should still render
    expect(screen.getByText('Custodia compartida')).toBeTruthy();
    // Subinfo line elements should be absent
    expect(screen.queryByText(/·/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Positions section — desktop button layout
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — positions desktop layout', () => {
  it('shows both position buttons on desktop (not full-width)', async () => {
    mockIsWide = true;
    mockHorizontalPadding = 32;
    mockDetail = buildDetail();
    mockStatus = 'success';
    await renderScreen();
    expect(screen.getByText(t('caseDetail.positions.createAction'))).toBeTruthy();
    expect(screen.getByText(t('caseDetail.positions.viewAction'))).toBeTruthy();
  });

  it('shows only view button when positions are not editable', async () => {
    mockDetail = buildDetail({ estado: 'cerrado' });
    mockStatus = 'success';
    await renderScreen();
    expect(screen.queryByText(t('caseDetail.positions.createAction'))).toBeNull();
    expect(screen.getByText(t('caseDetail.positions.viewAction'))).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Mediator hidden when hideWhenUnavailable and loading
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — mediator visibility rules', () => {
  beforeEach(() => {
    mockDetail = buildDetail();
    mockStatus = 'success';
  });

  it('hides mediator section when hideWhenUnavailable and still loading', async () => {
    mockMediator.status = 'loading';
    mockMediator.state = null;
    await renderScreen();
    expect(screen.queryByText(t('mediator.sectionTitle'))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// No invented metrics, timeline, or actions
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — no invented capabilities', () => {
  beforeEach(() => {
    mockDetail = buildDetail();
    mockStatus = 'success';
  });

  it('does not render any invented progress percentage', async () => {
    await renderScreen();
    expect(screen.queryByText(/65%/)).toBeNull();
    expect(screen.queryByText(/Completado/)).toBeNull();
    expect(screen.queryByText(/Completed/)).toBeNull();
  });

  it('does not render invented consensus metrics', async () => {
    await renderScreen();
    expect(screen.queryByText(/Consenso/)).toBeNull();
    expect(screen.queryByText(/Consensus/)).toBeNull();
  });

  it('does not render named mediator profile before round 3', async () => {
    await renderScreen();
    expect(screen.queryByText(/Elena Valdés/)).toBeNull();
    expect(screen.queryByText(/Mediadora Familiar/)).toBeNull();
    expect(screen.queryByText(/Mediator/)).toBeNull();
  });

  it('does not render chat/document/schedule actions', async () => {
    await renderScreen();
    expect(screen.queryByText(/Cargar Nueva Evidencia/)).toBeNull();
    expect(screen.queryByText(/Solicitar Reunión/)).toBeNull();
    expect(screen.queryByText(/Agenda/)).toBeNull();
  });

  it('does not render "Días de Apertura" invented metric', async () => {
    await renderScreen();
    expect(screen.queryByText(/Días de Apertura/)).toBeNull();
  });

  it('does not render "Acciones Pendientes" counter', async () => {
    await renderScreen();
    expect(screen.queryByText(/Acciones Pendientes/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// con_aviso visual priority
// ---------------------------------------------------------------------------
describe('CaseDetailScreen — con_aviso visual priority', () => {
  it('renders con_aviso label when agreement is in that estado', async () => {
    mockDetail = buildDetail({ estado: 'acordado', visualStatus: 'success', statusLabelKey: 'signed' });
    mockStatus = 'success';
    mockAgreement.status = 'success';
    mockAgreement.state = {
      agreement: { id: 'a1', title: 'Test', summary: '', terms: [], estado: 'con_aviso', readyAt: null, completedAt: null },
      signers: [{ role: 'authenticated_party', status: 'firmado' }, { role: 'other_party', status: 'firmado' }],
      allSignaturesComplete: true,
      waitingForOtherParty: false,
      ownSignatureComplete: true,
      readOnly: true,
      canPrepareDocument: false,
      canSign: false,
    };
    await renderScreen();
    expect(screen.getByText(t('agreement.status.con_aviso'))).toBeTruthy();
  });
});
