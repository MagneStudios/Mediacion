import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { SubscriptionUsage } from '@/types/billing';

const mockGetUsage = jest.fn();
jest.mock('@/services/billing.service', () => ({
  billingService: {
    getUsage: (...args: unknown[]) => mockGetUsage(...args),
  },
}));

// eslint-disable-next-line import/first
import { useSubscriptionUsage } from '../useSubscriptionUsage';

const usage: SubscriptionUsage = {
  periodStart: '2026-08-17T12:00:00.000Z',
  periodEnd: '2026-09-16T12:00:00.000Z',
  negotiations: { used: 2, limit: 3 },
  clients: null,
};

describe('useSubscriptionUsage', () => {
  beforeEach(() => {
    mockGetUsage.mockReset();
  });

  it('reports success with null when there is no plan to measure against', async () => {
    // The 404 the backed service maps to null. This is the state of anyone
    // without a subscription, which is normal — never the error status, or Mi
    // plan would show a retry for something retrying cannot fix.
    mockGetUsage.mockResolvedValue(null);
    const { result } = await renderHook(() => useSubscriptionUsage());
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.usage).toBeNull();
  });

  it('reports success with the usage once fetched', async () => {
    mockGetUsage.mockResolvedValue(usage);
    const { result } = await renderHook(() => useSubscriptionUsage());
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.usage).toEqual(usage);
  });

  it('reports error and exposes reload when the fetch rejects', async () => {
    mockGetUsage.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useSubscriptionUsage());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(typeof result.current.reload).toBe('function');
  });

  it('reload() re-fetches', async () => {
    mockGetUsage.mockResolvedValueOnce(null).mockResolvedValueOnce(usage);
    const { result } = await renderHook(() => useSubscriptionUsage());
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.usage).toBeNull();

    await act(async () => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.usage).toEqual(usage));
  });
});
