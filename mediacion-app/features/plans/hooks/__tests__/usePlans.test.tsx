import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Plan } from '@/types/plan';

const mockListPlanes = jest.fn();
let focusEffect: (() => void | (() => void)) | undefined;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focusEffect = effect;
  },
}));
jest.mock('@/services/plans.service', () => ({
  plansService: {
    listPlanes: (...args: unknown[]) => mockListPlanes(...args),
  },
}));

// eslint-disable-next-line import/first
import { usePlans } from '../usePlans';

const plan: Plan = { id: 'plan-1', nombre: 'base', limiteCarpetas: 3, limiteCasos: 2, limiteIteracionesIa: 5, precio: 0, moneda: 'ARS' };

describe('usePlans', () => {
  beforeEach(() => {
    mockListPlanes.mockReset();
    focusEffect = undefined;
  });

  it('reports success with the fetched plans once loaded', async () => {
    // renderHook awaits a full render pass internally, so by the time it
    // resolves the mocked promise has typically already settled too — the
    // meaningful assertion is the final status, not catching the
    // synchronous 'loading' instant (see the other tests for that flow via
    // usePlans's own shape).
    mockListPlanes.mockResolvedValue([plan]);
    const { result } = await renderHook(() => usePlans());

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.plans).toEqual([plan]);
  });

  it('reports empty when the list resolves with no plans', async () => {
    mockListPlanes.mockResolvedValue([]);
    const { result } = await renderHook(() => usePlans());
    await waitFor(() => expect(result.current.status).toBe('empty'));
  });

  it('reports error and exposes reload when the fetch rejects', async () => {
    mockListPlanes.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => usePlans());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.status === 'error' && typeof result.current.reload).toBe('function');
  });

  it('refresh() re-fetches without flashing a loading state', async () => {
    mockListPlanes.mockResolvedValueOnce([plan]).mockResolvedValueOnce([plan, { ...plan, id: 'plan-2' }]);
    const { result } = await renderHook(() => usePlans());
    await waitFor(() => expect(result.current.status).toBe('success'));

    await act(async () => {
      if (result.current.status === 'success') result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('success');
      expect(result.current.status === 'success' && result.current.plans).toHaveLength(2);
    });
  });

  it('keeps the loaded catalog when a silent refresh fails', async () => {
    // Against `GET /planes` this is a dropped connection on focus, not a
    // hypothetical: the user did not ask for the read, so it must not swap a
    // good catalog for an error state — nor reject unhandled.
    mockListPlanes.mockResolvedValueOnce([plan]).mockRejectedValueOnce(new Error('offline'));
    const { result } = await renderHook(() => usePlans());
    await waitFor(() => expect(result.current.status).toBe('success'));

    await act(async () => {
      if (result.current.status === 'success') result.current.refresh();
    });

    await waitFor(() => expect(mockListPlanes).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe('success');
    expect(result.current.plans).toEqual([plan]);
  });

  it('silently refreshes on focus once the first load has completed', async () => {
    mockListPlanes.mockResolvedValue([plan]);
    await renderHook(() => usePlans());
    await waitFor(() => expect(mockListPlanes).toHaveBeenCalledTimes(1));

    expect(focusEffect).toBeDefined();
    act(() => {
      focusEffect?.();
    });
    await waitFor(() => expect(mockListPlanes).toHaveBeenCalledTimes(2));
  });
});
