import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import type { MediatorActivityItem } from '@/types/mediator';

const mockGetMediatorActivity = jest.fn();
let focusEffect: (() => void | (() => void)) | undefined;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focusEffect = effect;
  },
}));
jest.mock('@/services/mediator.service', () => ({
  mediatorService: {
    getMediatorActivity: (...args: unknown[]) => mockGetMediatorActivity(...args),
  },
}));

// eslint-disable-next-line import/first
import { useMediatorActivity } from '../useMediatorActivity';

function item(caseId: string): MediatorActivityItem {
  return { id: `item-${caseId}`, caseId, eventKey: 'request_submitted', createdAt: '2026-01-01T00:00:00.000Z' };
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

describe('useMediatorActivity hardening', () => {
  it('shows an error when the initial load fails', async () => {
    mockGetMediatorActivity.mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useMediatorActivity('case-1'));

    await waitFor(() => expect(hook.result.current.status).toBe('error'));
    expect(hook.result.current.items).toEqual([]);
  });

  it('does not expose items from the previous case during navigation', async () => {
    const caseOneRead = deferred<MediatorActivityItem[]>();
    const caseTwoRead = deferred<MediatorActivityItem[]>();
    mockGetMediatorActivity.mockImplementation((caseId: string) =>
      caseId === 'case-1' ? caseOneRead.promise : caseTwoRead.promise,
    );
    const hook = await renderHook<ReturnType<typeof useMediatorActivity>, { caseId: string }>(
      ({ caseId }) => useMediatorActivity(caseId),
      { initialProps: { caseId: 'case-1' } },
    );

    await hook.rerender({ caseId: 'case-2' });
    expect(hook.result.current.status).toBe('loading');
    expect(hook.result.current.items).toEqual([]);
    await act(async () => {
      caseTwoRead.resolve([item('case-2')]);
      await caseTwoRead.promise;
    });
    await waitFor(() => expect(hook.result.current.items[0]?.caseId).toBe('case-2'));
    await act(async () => {
      caseOneRead.resolve([item('case-1')]);
      await caseOneRead.promise;
    });
    expect(hook.result.current.items[0]?.caseId).toBe('case-2');
  });

  it('keeps the last successful activity when a focus refresh fails', async () => {
    mockGetMediatorActivity.mockResolvedValueOnce([item('case-1')]);
    mockGetMediatorActivity.mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useMediatorActivity('case-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    await act(async () => {
      focusEffect?.();
      await Promise.resolve();
    });
    expect(hook.result.current.status).toBe('success');
    expect(hook.result.current.items).toEqual([item('case-1')]);
  });
});
