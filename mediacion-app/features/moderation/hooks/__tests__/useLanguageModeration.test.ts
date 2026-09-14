import { renderHook, waitFor } from '@testing-library/react-native';

import { useLanguageModeration } from '../useLanguageModeration';

describe('useLanguageModeration', () => {
  it('does not flag empty text', async () => {
    const { result } = await renderHook(() => useLanguageModeration(''));
    expect(result.current.result.flagged).toBe(false);
    expect(result.current.status).toBe('idle');
  });

  it('flags text containing a profanity term after the debounce', async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useLanguageModeration(v), {
      initialProps: { v: 'hola' },
    });
    await rerender({ v: 'qué idiota' });
    expect(result.current.status).toBe('checking');
    expect(result.current.result.flagged).toBe(false);
    await waitFor(() => expect(result.current.result.flagged).toBe(true), { timeout: 1000 });
    expect(result.current.status).toBe('idle');
  });

  it('does not flag clean text after the debounce', async () => {
    const { result, rerender } = await renderHook(({ v }: { v: string }) => useLanguageModeration(v), {
      initialProps: { v: 'hola' },
    });
    await rerender({ v: 'gracias por tu paciencia' });
    await waitFor(() => expect(result.current.result.flagged).toBe(false), { timeout: 1000 });
  });
});
