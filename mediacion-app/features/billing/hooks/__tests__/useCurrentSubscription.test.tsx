import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { MockSubscription } from '@/types/billing';

const mockGetCurrentSubscription = jest.fn();
jest.mock('@/services/billing.service', () => ({
  billingService: {
    getCurrentSubscription: (...args: unknown[]) => mockGetCurrentSubscription(...args),
  },
}));

// eslint-disable-next-line import/first
import { useCurrentSubscription } from '../useCurrentSubscription';

const subscription: MockSubscription = {
  id: 'sub-1',
  planId: 'plan-base',
  estado: 'activa',
  fechaInicio: '2026-08-10T00:00:00.000Z',
  fechaFin: null,
};

describe('useCurrentSubscription', () => {
  beforeEach(() => {
    mockGetCurrentSubscription.mockReset();
  });

  it('reports success with null when there is no subscription', async () => {
    mockGetCurrentSubscription.mockResolvedValue(null);
    const { result } = await renderHook(() => useCurrentSubscription());
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.subscription).toBeNull();
  });

  it('reports success with the subscription once fetched', async () => {
    mockGetCurrentSubscription.mockResolvedValue(subscription);
    const { result } = await renderHook(() => useCurrentSubscription());
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.subscription).toEqual(subscription);
  });

  it('reports error and exposes reload when the fetch rejects', async () => {
    mockGetCurrentSubscription.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useCurrentSubscription());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(typeof result.current.reload).toBe('function');
  });

  it('reload() re-fetches', async () => {
    mockGetCurrentSubscription.mockResolvedValueOnce(null).mockResolvedValueOnce(subscription);
    const { result } = await renderHook(() => useCurrentSubscription());
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.subscription).toBeNull();

    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.subscription).toEqual(subscription));
  });
});
