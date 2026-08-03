import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import type { NegotiationRound, NegotiationState, SharedProposal } from '@/types/negotiation';

const mockGetNegotiationState = jest.fn();
const mockStartNextRound = jest.fn();
const mockGenerateSharedProposal = jest.fn();
const mockSubmitOwnProposalResponse = jest.fn();
let focusEffect: (() => void | (() => void)) | undefined;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focusEffect = effect;
  },
}));
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
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function makeState(caseId: string): NegotiationState {
  return {
    ...baseState,
    caseId,
    currentRound: baseState.currentRound
      ? { ...baseState.currentRound, id: `round-${caseId}`, caseId }
      : null,
  };
}

async function renderLoadedHook() {
  mockGetNegotiationState.mockResolvedValue(baseState);
  const hook = await renderHook(() => useNegotiation('case-1'));
  await waitFor(() => expect(hook.result.current.status).toBe('success'));
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
  focusEffect = undefined;
});

afterEach(async () => {
  await cleanup();
});

describe('useNegotiation mutation guards', () => {
  it('shows an error when the initial load fails', async () => {
    mockGetNegotiationState.mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useNegotiation('case-1'));

    await waitFor(() => expect(hook.result.current.status).toBe('error'));
    expect(hook.result.current.state).toBeUndefined();
  });

  it('keeps the last successful state when a focus refresh fails', async () => {
    mockGetNegotiationState.mockResolvedValueOnce(baseState).mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useNegotiation('case-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    await act(async () => {
      focusEffect?.();
      await Promise.resolve();
    });

    expect(hook.result.current.status).toBe('success');
    expect(hook.result.current.state).toEqual(baseState);
  });

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

  it('finishes a confirmed round mutation when its readback fails and allows a safe reload', async () => {
    const hook = await renderLoadedHook();
    mockStartNextRound.mockResolvedValueOnce(round);
    mockGetNegotiationState.mockRejectedValueOnce(new Error('readback failed'));

    await act(async () => {
      await hook.result.current.startNextRound();
    });

    expect(mockStartNextRound).toHaveBeenCalledTimes(1);
    expect(hook.result.current.startRoundStatus).toBe('idle');
    expect(hook.result.current.status).toBe('error');

    mockGetNegotiationState.mockResolvedValueOnce(baseState);
    await act(() => {
      hook.result.current.reload();
    });
    await waitFor(() => expect(hook.result.current.status).toBe('success'));
    expect(mockStartNextRound).toHaveBeenCalledTimes(1);
  });

  it('finishes a confirmed proposal mutation when its readback fails and allows a safe reload', async () => {
    const hook = await renderLoadedHook();
    mockGenerateSharedProposal.mockResolvedValueOnce(proposal);
    mockGetNegotiationState.mockRejectedValueOnce(new Error('readback failed'));

    await act(async () => {
      await hook.result.current.generateProposal();
    });

    expect(mockGenerateSharedProposal).toHaveBeenCalledTimes(1);
    expect(hook.result.current.generateStatus).toBe('idle');
    expect(hook.result.current.status).toBe('error');

    mockGetNegotiationState.mockResolvedValueOnce(baseState);
    await act(() => {
      hook.result.current.reload();
    });
    await waitFor(() => expect(hook.result.current.status).toBe('success'));
    expect(mockGenerateSharedProposal).toHaveBeenCalledTimes(1);
  });

  it('does not let an old operation release the current case operation', async () => {
    mockGetNegotiationState.mockImplementation((caseId: string) => Promise.resolve(makeState(caseId)));
    const oldRequest = deferred<NegotiationRound>();
    const currentRequest = deferred<NegotiationRound>();
    mockStartNextRound.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(currentRequest.promise);
    const hook = await renderHook<ReturnType<typeof useNegotiation>, { caseId: string }>(
      ({ caseId }) => useNegotiation(caseId),
      { initialProps: { caseId: 'case-1' } },
    );
    await waitFor(() => expect(hook.result.current.state?.caseId).toBe('case-1'));

    let oldOperation!: Promise<void>;
    await act(() => {
      oldOperation = hook.result.current.startNextRound();
    });
    await hook.rerender({ caseId: 'case-2' });
    await waitFor(() => expect(hook.result.current.state?.caseId).toBe('case-2'));

    let currentOperation!: Promise<void>;
    await act(() => {
      currentOperation = hook.result.current.startNextRound();
    });
    await act(async () => {
      oldRequest.resolve({ ...round, id: 'round-case-1', caseId: 'case-1' });
      await oldOperation;
    });
    await act(async () => {
      await hook.result.current.startNextRound();
    });
    expect(mockStartNextRound).toHaveBeenCalledTimes(2);

    await act(async () => {
      currentRequest.resolve({ ...round, id: 'round-case-2', caseId: 'case-2' });
      await currentOperation;
    });
    expect(hook.result.current.state?.caseId).toBe('case-2');
    expect(hook.result.current.startRoundStatus).toBe('idle');
  });

  it('does not let an older reload overwrite a confirmed response', async () => {
    const hook = await renderLoadedHook();
    const staleReload = deferred<NegotiationState>();
    mockGetNegotiationState.mockReturnValueOnce(staleReload.promise);
    const acceptedState = {
      ...baseState,
      currentProposal: { ...proposal, estado: 'aceptada' as const },
      bothAccepted: true,
    };
    mockSubmitOwnProposalResponse.mockResolvedValueOnce(acceptedState);

    await act(() => {
      hook.result.current.reload();
    });
    await act(async () => {
      await hook.result.current.submitResponse(proposal.id, 'acepta');
    });
    expect(hook.result.current.state).toEqual(acceptedState);

    await act(async () => {
      staleReload.resolve(baseState);
      await staleReload.promise;
    });
    expect(hook.result.current.state).toEqual(acceptedState);
    expect(hook.result.current.status).toBe('success');
  });
});
