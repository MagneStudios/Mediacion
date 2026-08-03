import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import type { NegotiationRound, NegotiationState, SharedProposal } from '@/types/negotiation';

const mockGetNegotiationState = jest.fn();
const mockStartNextRound = jest.fn();
const mockGenerateSharedProposal = jest.fn();
const mockSubmitOwnProposalResponse = jest.fn();

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/services/negotiation.service', () => ({
  negotiationService: {
    getNegotiationState: (...args: unknown[]) => mockGetNegotiationState(...args),
    startNextRound: (...args: unknown[]) => mockStartNextRound(...args),
    generateSharedProposal: (...args: unknown[]) => mockGenerateSharedProposal(...args),
    submitOwnProposalResponse: (...args: unknown[]) => mockSubmitOwnProposalResponse(...args),
  },
}));

// eslint-disable-next-line import/first
import { useNegotiation } from '../useNegotiation';

const round: NegotiationRound = {
  id: 'round-1',
  caseId: 'case-1',
  number: 1,
  estado: 'activa',
  mediatorAvailable: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const proposal: SharedProposal = {
  id: 'proposal-1',
  caseId: 'case-1',
  roundId: round.id,
  roundNumber: 1,
  meetingPoint: [],
  narrative: 'Propuesta compartida',
  estado: 'pendiente',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const baseState: NegotiationState = {
  caseId: 'case-1',
  eligibility: 'ready',
  currentRound: round,
  currentProposal: null,
  ownResponse: null,
  waitingForOtherParty: false,
  bothAccepted: false,
  roundResolved: false,
  mediatorAvailable: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function renderLoadedHook() {
  mockGetNegotiationState.mockResolvedValue(baseState);
  const hook = await renderHook(() => useNegotiation('case-1'));
  await waitFor(() => expect(hook.result.current.status).toBe('success'));
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(async () => {
  await cleanup();
});

describe('useNegotiation mutation guards', () => {
  it('allows only one in-flight call for every mutation before React rerenders', async () => {
    const hook = await renderLoadedHook();
    const roundRequest = deferred<NegotiationRound>();
    mockStartNextRound.mockReturnValue(roundRequest.promise);

    let firstRound!: Promise<void>;
    let secondRound!: Promise<void>;
    await act(() => {
      firstRound = hook.result.current.startNextRound();
      secondRound = hook.result.current.startNextRound();
    });

    expect(mockStartNextRound).toHaveBeenCalledTimes(1);
    await act(async () => {
      roundRequest.resolve(round);
      await Promise.all([firstRound, secondRound]);
    });

    const proposalRequest = deferred<SharedProposal>();
    mockGenerateSharedProposal.mockReturnValue(proposalRequest.promise);

    let firstProposal!: Promise<void>;
    let secondProposal!: Promise<void>;
    await act(() => {
      firstProposal = hook.result.current.generateProposal();
      secondProposal = hook.result.current.generateProposal();
    });

    expect(mockGenerateSharedProposal).toHaveBeenCalledTimes(1);
    await act(async () => {
      proposalRequest.resolve(proposal);
      await Promise.all([firstProposal, secondProposal]);
    });

    const responseRequest = deferred<NegotiationState>();
    mockSubmitOwnProposalResponse.mockReturnValue(responseRequest.promise);

    let firstResponse!: Promise<void>;
    let secondResponse!: Promise<void>;
    await act(() => {
      firstResponse = hook.result.current.submitResponse(proposal.id, 'acepta');
      secondResponse = hook.result.current.submitResponse(proposal.id, 'acepta');
    });

    expect(mockSubmitOwnProposalResponse).toHaveBeenCalledTimes(1);
    await act(async () => {
      responseRequest.resolve({ ...baseState, currentProposal: { ...proposal, estado: 'aceptada' }, bothAccepted: true });
      await Promise.all([firstResponse, secondResponse]);
    });
  });
});
