import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import type { MediatorState } from '@/types/mediator';

const mockGetMediatorState = jest.fn();
const mockRequestMediator = jest.fn();
let focusEffect: (() => void | (() => void)) | undefined;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focusEffect = effect;
  },
}));
jest.mock('@/services/mediator.service', () => ({
  mediatorService: {
    getMediatorState: (...args: unknown[]) => mockGetMediatorState(...args),
    requestMediator: (...args: unknown[]) => mockRequestMediator(...args),
  },
}));

// eslint-disable-next-line import/first
import { useMediator } from '../useMediator';

function makeState(caseId: string, eligibility: MediatorState['eligibility'] = 'available'): MediatorState {
  return {
    caseId,
    eligibility,
    mediation: null,
    canRequest: eligibility === 'available',
    readOnly: eligibility !== 'available',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  focusEffect = undefined;
});

afterEach(async () => {
  await cleanup();
});

describe('useMediator hardening', () => {
  it('shows an error when the initial load fails', async () => {
    mockGetMediatorState.mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useMediator('case-1'));

    await waitFor(() => expect(hook.result.current.status).toBe('error'));
    expect(hook.result.current.state).toBeNull();
  });

  it('keeps the last successful state when a focus refresh fails', async () => {
    const initial = makeState('case-1');
    mockGetMediatorState.mockResolvedValueOnce(initial).mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useMediator('case-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    await act(async () => {
      focusEffect?.();
      await Promise.resolve();
    });

    expect(hook.result.current.status).toBe('success');
    expect(hook.result.current.state).toEqual(initial);
  });

  it('blocks a second request synchronously', async () => {
    mockGetMediatorState.mockResolvedValue(makeState('case-1'));
    const request = deferred<MediatorState>();
    mockRequestMediator.mockReturnValue(request.promise);
    const hook = await renderHook(() => useMediator('case-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(() => {
      first = hook.result.current.requestMediator();
      second = hook.result.current.requestMediator();
    });

    expect(mockRequestMediator).toHaveBeenCalledTimes(1);
    await act(async () => {
      request.resolve(makeState('case-1', 'assigned'));
      await expect(first).resolves.toBe(true);
      await expect(second).resolves.toBe(false);
    });
  });

  it('never renders a late read from the previous case', async () => {
    const caseOneRead = deferred<MediatorState | null>();
    const caseTwoRead = deferred<MediatorState | null>();
    mockGetMediatorState.mockImplementation((caseId: string) =>
      caseId === 'case-1' ? caseOneRead.promise : caseTwoRead.promise,
    );

    const hook = await renderHook<ReturnType<typeof useMediator>, { caseId: string }>(({ caseId }) => useMediator(caseId), {
      initialProps: { caseId: 'case-1' },
    });
    await hook.rerender({ caseId: 'case-2' });
    expect(hook.result.current.status).toBe('loading');
    expect(hook.result.current.state).toBeNull();

    await act(async () => {
      caseTwoRead.resolve(makeState('case-2'));
      await caseTwoRead.promise;
    });
    await waitFor(() => expect(hook.result.current.state?.caseId).toBe('case-2'));

    await act(async () => {
      caseOneRead.resolve(makeState('case-1'));
      await caseOneRead.promise;
    });
    expect(hook.result.current.state?.caseId).toBe('case-2');
  });

  it('does not let an older focus refresh overwrite a mutation', async () => {
    mockGetMediatorState.mockResolvedValueOnce(makeState('case-1'));
    const staleRead = deferred<MediatorState | null>();
    mockGetMediatorState.mockReturnValueOnce(staleRead.promise);
    mockRequestMediator.mockResolvedValue(makeState('case-1', 'assigned'));
    const hook = await renderHook(() => useMediator('case-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    await act(() => {
      focusEffect?.();
    });
    await act(async () => {
      await expect(hook.result.current.requestMediator()).resolves.toBe(true);
    });
    expect(hook.result.current.state?.eligibility).toBe('assigned');

    await act(async () => {
      staleRead.resolve(makeState('case-1', 'available'));
      await staleRead.promise;
    });
    expect(hook.result.current.state?.eligibility).toBe('assigned');
  });

  it('ignores a request response after navigation and resets mutation state', async () => {
    mockGetMediatorState.mockImplementation((caseId: string) => Promise.resolve(makeState(caseId)));
    const request = deferred<MediatorState>();
    mockRequestMediator.mockReturnValue(request.promise);
    const hook = await renderHook<ReturnType<typeof useMediator>, { caseId: string }>(({ caseId }) => useMediator(caseId), {
      initialProps: { caseId: 'case-1' },
    });
    await waitFor(() => expect(hook.result.current.status).toBe('success'));
    let pending!: Promise<boolean>;
    await act(() => {
      pending = hook.result.current.requestMediator();
    });

    await hook.rerender({ caseId: 'case-2' });
    await waitFor(() => expect(hook.result.current.state?.caseId).toBe('case-2'));
    await act(async () => {
      request.resolve(makeState('case-1', 'assigned'));
      await expect(pending).resolves.toBe(false);
    });

    expect(hook.result.current.state?.caseId).toBe('case-2');
    expect(hook.result.current.requestStatus).toBe('idle');
  });

  it('keeps a failed request recoverable', async () => {
    mockGetMediatorState.mockResolvedValue(makeState('case-1'));
    mockRequestMediator.mockRejectedValue(new Error('offline'));
    const hook = await renderHook(() => useMediator('case-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    await act(async () => {
      await expect(hook.result.current.requestMediator()).resolves.toBe(false);
    });
    expect(hook.result.current.requestStatus).toBe('error');
  });
});
