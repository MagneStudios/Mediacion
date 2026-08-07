import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';

import type { SignatureInboxItem } from '@/types/agreement';

const mockGetSignatureInbox = jest.fn();
let focusEffect: (() => void | (() => void)) | undefined;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    focusEffect = effect;
  },
}));
jest.mock('@/services/agreements.service', () => ({
  agreementsService: {
    getSignatureInbox: (...args: unknown[]) => mockGetSignatureInbox(...args),
  },
}));

// eslint-disable-next-line import/first
import { useSignatureInbox } from '../useSignatureInbox';

const item: SignatureInboxItem = {
  caseId: 'case-1',
  caseTitle: 'Caso 1',
  agreementTitle: 'Acuerdo 1',
  estado: 'enviado_a_firma',
  ownStatus: 'pendiente',
};

beforeEach(() => {
  jest.clearAllMocks();
  focusEffect = undefined;
});

afterEach(async () => {
  await cleanup();
});

describe('useSignatureInbox refresh handling', () => {
  it('shows an error when the initial load fails', async () => {
    mockGetSignatureInbox.mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useSignatureInbox());

    await waitFor(() => expect(hook.result.current.status).toBe('error'));
    expect(hook.result.current.items).toBeUndefined();
  });

  it('keeps the last successful inbox when a focus refresh fails', async () => {
    mockGetSignatureInbox.mockResolvedValueOnce([item]).mockRejectedValueOnce(new Error('offline'));
    const hook = await renderHook(() => useSignatureInbox());
    await waitFor(() => expect(hook.result.current.status).toBe('success'));

    await act(async () => {
      focusEffect?.();
      await Promise.resolve();
    });

    expect(hook.result.current.status).toBe('success');
    expect(hook.result.current.items).toEqual([item]);
  });
});
