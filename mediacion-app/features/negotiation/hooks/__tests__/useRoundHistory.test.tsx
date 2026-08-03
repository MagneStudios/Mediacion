import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import type { RoundHistoryItem } from '@/types/negotiation';

const mockGetRoundHistory = jest.fn();
let focusEffect: (() => void | (() => void)) | undefined;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focusEffect = effect;
  },
}));
jest.mock('@/services/negotiation.service', () => ({
  negotiationService: {
    getRoundHistory: (...args: unknown[]) => mockGetRoundHistory(...args),
  },
}));

// eslint-disable-next-line import/first
import { useRoundHistory } from '../useRoundHistory';

function item(roundNumber: number): RoundHistoryItem {
  return {
    roundId: `round-${roundNumber}`,
    roundNumber,
    proposalSummary: `Ronda ${roundNumber}`,
    finalStatus: 'rechazada',
    agreementReached: false,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  focusEffect = undefined;
});

afterEach(async () => {
  await cleanup();
});

describe('useRoundHistory refresh handling', () => {
  it('shows an error when the initial load fails', async () => {
    mockGetRoundHistory.mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useRoundHistory('case-1'));

    await waitFor(() => expect(hook.result.current.status).toBe('error'));
    expect(hook.result.current.items).toBeUndefined();
  });

  it('keeps the last successful history when a focus refresh fails', async () => {
    mockGetRoundHistory.mockResolvedValueOnce([item(1)]).mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useRoundHistory('case-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    await act(async () => {
      focusEffect?.();
      await Promise.resolve();
    });

    expect(hook.result.current.status).toBe('success');
    expect(hook.result.current.items).toEqual([item(1)]);
  });

  it('does not expose history from the previous case during navigation', async () => {
    const caseOneRead = deferred<RoundHistoryItem[]>();
    const caseTwoRead = deferred<RoundHistoryItem[]>();
    mockGetRoundHistory.mockImplementation((caseId: string) =>
      caseId === 'case-1' ? caseOneRead.promise : caseTwoRead.promise,
    );
    const hook = await renderHook<ReturnType<typeof useRoundHistory>, { caseId: string }>(
      ({ caseId }) => useRoundHistory(caseId),
      { initialProps: { caseId: 'case-1' } },
    );

    await hook.rerender({ caseId: 'case-2' });
    expect(hook.result.current.status).toBe('loading');
    expect(hook.result.current.items).toBeUndefined();
    await act(async () => {
      caseTwoRead.resolve([item(2)]);
      await caseTwoRead.promise;
    });
    await waitFor(() => expect(hook.result.current.items).toEqual([item(2)]));
    await act(async () => {
      caseOneRead.resolve([item(1)]);
      await caseOneRead.promise;
    });
    expect(hook.result.current.items).toEqual([item(2)]);
  });
});
