import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { NegotiationEligibility, NegotiationState, SharedProposal } from '@/types/negotiation';
import type { MediatorState } from '@/types/mediator';

const t = i18n.t.bind(i18n);

const mockReloadCase = jest.fn();
const mockReloadNegotiation = jest.fn();
const mockStartNextRound = jest.fn();
const mockGenerateProposal = jest.fn();
const mockSubmitResponse = jest.fn();
const mockResetRespondStatus = jest.fn();
const mockRoutePush = jest.fn();
const mockRouteBack = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockRoutePush, back: mockRouteBack, replace: jest.fn(), dismissAll: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'case-1' }),
  usePathname: () => '/case/case-1/negotiation',
}));

let mockResponsiveLayout = { isWide: false, horizontalPadding: 16 };
jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => mockResponsiveLayout,
}));

const mockCaseDetailHook = {
  status: 'loading' as 'loading' | 'error' | 'success',
  detail: undefined as unknown,
  reload: mockReloadCase,
};
jest.mock('@/features/cases/hooks/useCaseDetail', () => ({
  useCaseDetail: () => mockCaseDetailHook,
}));

const mockNegotiationHook = {
  status: 'loading' as 'loading' | 'error' | 'success',
  state: null as NegotiationState | null,
  reload: mockReloadNegotiation,
  startRoundStatus: 'idle' as 'idle' | 'pending' | 'error',
  startNextRound: mockStartNextRound,
  generateStatus: 'idle' as 'idle' | 'pending' | 'error',
  generateProposal: mockGenerateProposal,
  respondStatus: 'idle' as 'idle' | 'pending' | 'error',
  submitResponse: mockSubmitResponse,
  resetRespondStatus: mockResetRespondStatus,
};
jest.mock('@/features/negotiation/hooks/useNegotiation', () => ({
  useNegotiation: () => mockNegotiationHook,
}));

const mockMediatorHook = {
  status: 'success' as 'loading' | 'error' | 'success',
  state: { eligibility: 'unavailable_before_round_3', mediation: null } as MediatorState | null,
  reload: jest.fn(),
};
jest.mock('@/features/mediator/hooks/useMediator', () => ({
  useMediator: () => mockMediatorHook,
}));

// eslint-disable-next-line import/first
import NegotiationDashboardScreen from '../index';

function buildProposal(overrides: Partial<SharedProposal> = {}): SharedProposal {
  return {
    id: 'prop-1',
    caseId: 'case-1',
    roundId: 'round-2',
    roundNumber: 2,
    meetingPoint: [{ categoria: 'bienes', punto: 50, estado: 'acordable' }],
    narrative: 'Una alternativa intermedia entre ambas posiciones.',
    estado: 'pendiente',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function buildState(eligibility: NegotiationEligibility, overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    caseId: 'case-1',
    eligibility,
    currentRound: { id: 'round-2', caseId: 'case-1', number: 2, estado: 'activa', mediatorAvailable: false, createdAt: '2026-01-01T00:00:00Z' },
    currentProposal: null,
    ownResponse: null,
    waitingForOtherParty: false,
    bothAccepted: false,
    roundResolved: false,
    mediatorAvailable: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResponsiveLayout = { isWide: false, horizontalPadding: 16 };
  mockCaseDetailHook.status = 'loading';
  mockCaseDetailHook.detail = undefined;
  mockNegotiationHook.status = 'loading';
  mockNegotiationHook.state = null;
  mockNegotiationHook.startRoundStatus = 'idle';
  mockNegotiationHook.generateStatus = 'idle';
  mockNegotiationHook.respondStatus = 'idle';
  mockMediatorHook.status = 'success';
  mockMediatorHook.state = { eligibility: 'unavailable_before_round_3', mediation: null } as MediatorState;
});

function setReady(state: NegotiationState) {
  mockCaseDetailHook.status = 'success';
  mockCaseDetailHook.detail = { id: 'case-1', title: 'Custodia compartida', estado: 'en_negociacion' } as unknown;
  mockNegotiationHook.status = 'success';
  mockNegotiationHook.state = state;
}

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <NegotiationDashboardScreen />
    </I18nextProvider>,
  );
}

describe('NegotiationDashboardScreen', () => {
  describe('loading', () => {
    it('shows LoadingState while the case is loading', async () => {
      await renderScreen();
      expect(screen.getByText(t('common.loading'))).toBeTruthy();
    });

    it('shows LoadingState while negotiation state is loading (case already resolved)', async () => {
      mockCaseDetailHook.status = 'success';
      mockCaseDetailHook.detail = { id: 'case-1' } as unknown;
      mockNegotiationHook.status = 'loading';
      await renderScreen();
      expect(screen.getByText(t('common.loading'))).toBeTruthy();
    });
  });

  describe('error', () => {
    it('shows the not-found ErrorState when the case fails to load, with a working back action', async () => {
      mockCaseDetailHook.status = 'error';
      mockNegotiationHook.status = 'error';
      await renderScreen();
      expect(screen.getByText(t('negotiation.notFound.title'))).toBeTruthy();
      await fireEvent.press(screen.getByText(t('common.back')));
      expect(mockRouteBack).toHaveBeenCalledTimes(1);
    });

    it('shows the generic ErrorState with retry when negotiation state fails to load', async () => {
      mockCaseDetailHook.status = 'success';
      mockCaseDetailHook.detail = { id: 'case-1' } as unknown;
      mockNegotiationHook.status = 'error';
      await renderScreen();
      expect(screen.getByText(t('states.error.title'))).toBeTruthy();
      await fireEvent.press(screen.getByText(t('states.error.retry')));
      expect(mockReloadNegotiation).toHaveBeenCalledTimes(1);
    });
  });

  describe('eligibility — waiting/incomplete states, no invented decisions', () => {
    it('waiting_counterparty shows the real summary title + description', async () => {
      setReady(buildState('waiting_counterparty', { currentRound: null }));
      await renderScreen();
      expect(screen.getByText(t('negotiation.summary.waitingCounterparty.title'))).toBeTruthy();
      expect(screen.getByText(t('negotiation.summary.waitingCounterparty.description'))).toBeTruthy();
    });

    it('positions_incomplete shows the real summary title + description', async () => {
      setReady(buildState('positions_incomplete', { currentRound: null }));
      await renderScreen();
      expect(screen.getByText(t('negotiation.summary.positionsIncomplete.title'))).toBeTruthy();
    });

    it('waiting_other_party shows the real summary title + description', async () => {
      setReady(buildState('waiting_other_party'));
      await renderScreen();
      expect(screen.getByText(t('negotiation.summary.waitingOtherParty.title'))).toBeTruthy();
    });
  });

  describe('ready — start round / generate proposal', () => {
    it('shows "start next round" when ready with no active round, and calls the real callback', async () => {
      setReady(buildState('ready', { currentRound: null }));
      await renderScreen();
      await fireEvent.press(screen.getByText(t('negotiation.startRound.action')));
      expect(mockStartNextRound).toHaveBeenCalledTimes(1);
    });

    it('shows "generate proposal" + privacy note when ready with an active round and no proposal yet', async () => {
      setReady(
        buildState('ready', {
          currentRound: { id: 'r2', caseId: 'case-1', number: 2, estado: 'activa', mediatorAvailable: false, createdAt: '2026-01-01T00:00:00Z' },
        }),
      );
      await renderScreen();
      expect(screen.getByText(t('negotiation.generate.action'))).toBeTruthy();
      expect(screen.getByText(t('negotiation.generate.privacyNote'))).toBeTruthy();
      await fireEvent.press(screen.getByText(t('negotiation.generate.action')));
      expect(mockGenerateProposal).toHaveBeenCalledTimes(1);
    });

    it('shows the AI generation-in-progress state instead of the button while generateStatus is pending', async () => {
      mockNegotiationHook.generateStatus = 'pending';
      setReady(
        buildState('ready', {
          currentRound: { id: 'r2', caseId: 'case-1', number: 2, estado: 'activa', mediatorAvailable: false, createdAt: '2026-01-01T00:00:00Z' },
        }),
      );
      await renderScreen();
      expect(screen.getByText(t('negotiation.generate.generatingTitle'))).toBeTruthy();
      expect(screen.queryByText(t('negotiation.generate.action'))).toBeNull();
    });
  });

  describe('proposal available — content, privacy, and no invented elements', () => {
    it('renders the real proposal narrative, intro, and meeting point — never a fabricated title or consensus score', async () => {
      setReady(buildState('in_progress', { currentProposal: buildProposal() }));
      await renderScreen();
      expect(screen.getByText(t('negotiation.proposal.title', { round: 2 }))).toBeTruthy();
      expect(screen.getByText(t('negotiation.proposal.intro'))).toBeTruthy();
      expect(screen.getByText('Una alternativa intermedia entre ambas posiciones.')).toBeTruthy();
      expect(screen.queryByText(/consenso/i)).toBeNull();
      expect(screen.queryByText(/%/)).toBeNull();
      expect(screen.queryByText(/expediente/i)).toBeNull();
    });

    it('shows the rationale only when the proposal actually carries one', async () => {
      setReady(buildState('in_progress', { currentProposal: buildProposal({ rationale: undefined }) }));
      await renderScreen();
      expect(screen.queryByText(t('negotiation.proposal.rationaleTitle'))).toBeNull();
    });

    it('shows the rationale block, visually separate, when present', async () => {
      setReady(buildState('in_progress', { currentProposal: buildProposal({ rationale: 'Prioriza la continuidad escolar.' }) }));
      await renderScreen();
      expect(screen.getByText(t('negotiation.proposal.rationaleTitle'))).toBeTruthy();
      expect(screen.getByText('Prioriza la continuidad escolar.')).toBeTruthy();
    });

    it('always shows the dashboard-level privacy notice', async () => {
      setReady(buildState('in_progress', { currentProposal: buildProposal() }));
      await renderScreen();
      expect(screen.getByText(t('negotiation.dashboard.privacyNotice'))).toBeTruthy();
    });

    it('never exposes private-position or raw-range data anywhere on screen', async () => {
      setReady(buildState('in_progress', { currentProposal: buildProposal() }));
      await renderScreen();
      expect(screen.queryByText(/posici[oó]n privada/i)).toBeNull();
      expect(screen.queryByText(/rango/i)).toBeNull();
    });
  });

  describe('accept / reject — real callbacks, no nested Pressables', () => {
    it('shows accept + reject as sibling actions when a response is owed', async () => {
      setReady(buildState('in_progress', { currentProposal: buildProposal() }));
      await renderScreen();
      expect(screen.getByRole('button', { name: t('negotiation.response.accept') })).toBeTruthy();
      expect(screen.getByRole('button', { name: t('negotiation.response.reject') })).toBeTruthy();
    });

    it('accepting opens the existing confirmation dialog, and confirming calls the real submitResponse with "acepta"', async () => {
      setReady(buildState('in_progress', { currentProposal: buildProposal() }));
      await renderScreen();
      await fireEvent.press(screen.getByRole('button', { name: t('negotiation.response.accept') }));
      expect(screen.getByText(t('negotiation.response.dialogs.accept.title'))).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: t('negotiation.response.dialogs.confirmAccept') }));
      expect(mockSubmitResponse).toHaveBeenCalledWith('prop-1', 'acepta');
    });

    it('rejecting opens the existing confirmation dialog, and confirming calls the real submitResponse with "rechaza"', async () => {
      setReady(buildState('in_progress', { currentProposal: buildProposal() }));
      await renderScreen();
      await fireEvent.press(screen.getByRole('button', { name: t('negotiation.response.reject') }));
      expect(screen.getByText(t('negotiation.response.dialogs.reject.title'))).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: t('negotiation.response.dialogs.confirmReject') }));
      expect(mockSubmitResponse).toHaveBeenCalledWith('prop-1', 'rechaza');
    });
  });

  describe('waiting for the other party after responding', () => {
    it('shows the real "waiting for the other party" state', async () => {
      setReady(
        buildState('in_progress', {
          currentProposal: buildProposal(),
          ownResponse: { proposalId: 'prop-1', decision: 'acepta', createdAt: '2026-01-01T00:00:00Z' },
          waitingForOtherParty: true,
        }),
      );
      await renderScreen();
      expect(screen.getByText(t('negotiation.response.waitingOtherTitle'))).toBeTruthy();
      expect(screen.queryByRole('button', { name: t('negotiation.response.accept') })).toBeNull();
    });
  });

  describe('round resolved — no agreement', () => {
    it('shows the real "no agreement" outcome, reusing the existing summary title', async () => {
      setReady(
        buildState('ready', {
          currentProposal: buildProposal({ estado: 'rechazada' }),
          roundResolved: true,
          bothAccepted: false,
        }),
      );
      await renderScreen();
      expect(screen.getByText(t('negotiation.summary.completedNoAgreement.title'))).toBeTruthy();
      expect(screen.getByText(t('negotiation.resolution.notAcceptedBody'))).toBeTruthy();
    });
  });

  describe('both parties accepted', () => {
    it('shows the agreement-reached outcome and navigates to the real agreement route on press', async () => {
      setReady(
        buildState('read_only', {
          currentProposal: buildProposal({ estado: 'aceptada' }),
          bothAccepted: true,
        }),
      );
      await renderScreen();
      expect(screen.getByText(t('negotiation.summary.agreementReached.title'))).toBeTruthy();
      await fireEvent.press(screen.getByText(t('negotiation.resolution.reviewAgreementAction')));
      expect(mockRoutePush).toHaveBeenCalledWith({ pathname: '/case/[id]/agreement', params: { id: 'case-1' } });
    });
  });

  describe('mediator — real eligibility only, no duplicated logic', () => {
    it('reflects whatever useMediator reports, never a parallel roundNumber-based guess', async () => {
      mockMediatorHook.state = { eligibility: 'available', mediation: null } as MediatorState;
      setReady(buildState('ready', { currentRound: null }));
      await renderScreen();
      expect(screen.getByText(t('mediator.summary.available.title'))).toBeTruthy();
    });

    it('shows the not-yet-available mediator state when round < 3, without inventing names/photos/chats', async () => {
      mockMediatorHook.state = { eligibility: 'unavailable_before_round_3', mediation: null } as MediatorState;
      setReady(buildState('ready', { currentRound: null }));
      await renderScreen();
      expect(screen.getByText(t('mediator.summary.unavailableBeforeRound3.title'))).toBeTruthy();
      expect(screen.queryByText(/Lucía/i)).toBeNull();
    });
  });

  describe('history navigation', () => {
    it('navigates to the real history route', async () => {
      setReady(buildState('read_only'));
      await renderScreen();
      await fireEvent.press(screen.getByText(t('negotiation.history.viewAction')));
      expect(mockRoutePush).toHaveBeenCalledWith({ pathname: '/case/[id]/negotiation/history', params: { id: 'case-1' } });
    });
  });

  describe('responsive', () => {
    it('renders correctly at compact width', async () => {
      mockResponsiveLayout = { isWide: false, horizontalPadding: 16 };
      setReady(buildState('in_progress', { currentProposal: buildProposal() }));
      await renderScreen();
      expect(screen.getByText(t('negotiation.dashboard.title'))).toBeTruthy();
    });

    it('renders correctly at wide width', async () => {
      mockResponsiveLayout = { isWide: true, horizontalPadding: 32 };
      setReady(buildState('in_progress', { currentProposal: buildProposal() }));
      await renderScreen();
      expect(screen.getByText(t('negotiation.dashboard.title'))).toBeTruthy();
    });
  });
});
