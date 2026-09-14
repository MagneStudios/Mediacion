import { renderHook, waitFor } from '@testing-library/react-native';

import { useDebouncedValue } from '../use-debounced-value';

describe('useDebouncedValue', () => {
  it('returns the initial value immediately', async () => {
    const { result } = await renderHook(() => useDebouncedValue('a', 400));
    expect(result.current).toBe('a');
  });

  it('updates only after the delay elapses', async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 400), {
      initialProps: { v: 'a' },
    });
    await rerender({ v: 'b' });
    expect(result.current).toBe('a');
    await waitFor(() => expect(result.current).toBe('b'), { timeout: 1000 });
  });

  it('resets the timer on rapid successive changes', async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useDebouncedValue(v, 400), {
      initialProps: { v: 'a' },
    });
    await rerender({ v: 'b' });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(result.current).toBe('a');
    await rerender({ v: 'c' });
    await waitFor(() => expect(result.current).toBe('c'), { timeout: 1000 });
  });
});
