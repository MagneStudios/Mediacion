import { act, renderHook, waitFor } from '@testing-library/react-native';

import { profileService } from '@/services/profile.service';
import type { NotificationPreferences } from '@/types/profile';
import { useNotificationPreferences } from '../useNotificationPreferences';

// React 19 only flushes test updates when this flag is on; RTL v14's bundled
// act() sets a mangled global instead, so hook tests must set it themselves.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/services/profile.service', () => ({
  profileService: {
    getNotificationPreferences: jest.fn(),
    updateNotificationPreferences: jest.fn(),
  },
}));

type FocusCallback = () => undefined | (() => void);
let mockFocusCallback: FocusCallback | null = null;

// Captures the focus callback instead of running it, so a test can simulate
// the screen regaining focus at a chosen moment.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: FocusCallback) => {
    mockFocusCallback = callback;
  },
}));

const service = profileService as jest.Mocked<typeof profileService>;

const basePrefs: NotificationPreferences = {
  caseUpdates: true,
  proposalReady: true,
  responseReceived: true,
  signatureReady: true,
  agreementCompleted: true,
  mediatorAvailability: true,
  productUpdates: true,
};

async function renderLoaded() {
  service.getNotificationPreferences.mockResolvedValueOnce(basePrefs);
  const utils = await renderHook(() => useNotificationPreferences());
  await waitFor(() => expect(utils.result.current.status).toBe('success'));
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFocusCallback = null;
});

describe('useNotificationPreferences', () => {
  it('loads the preferences on mount', async () => {
    const { result } = await renderLoaded();

    expect(result.current.preferences).toEqual(basePrefs);
  });

  it('reports an error when the initial load fails', async () => {
    service.getNotificationPreferences.mockRejectedValueOnce(new Error('offline'));

    const { result } = await renderHook(() => useNotificationPreferences());

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('keeps the last good data when the focus refresh fails, with no unhandled rejection', async () => {
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const { result } = await renderLoaded();
      service.getNotificationPreferences.mockRejectedValueOnce(new Error('offline'));

      await act(async () => {
        mockFocusCallback?.();
      });
      // unhandledRejection fires on a later macrotask, so yield twice.
      await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
      await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

      expect(rejections).toHaveLength(0);
      expect(result.current.status).toBe('success');
      expect(result.current.preferences).toEqual(basePrefs);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('applies a successful focus refresh', async () => {
    const { result } = await renderLoaded();
    const refreshed = { ...basePrefs, productUpdates: false };
    service.getNotificationPreferences.mockResolvedValueOnce(refreshed);

    await act(async () => {
      mockFocusCallback?.();
    });

    await waitFor(() => expect(result.current.preferences).toEqual(refreshed));
  });

  it('toggles one key by sending the full next object', async () => {
    const { result } = await renderLoaded();
    const next = { ...basePrefs, productUpdates: false };
    service.updateNotificationPreferences.mockResolvedValueOnce(next);

    await act(async () => {
      await result.current.togglePreference('productUpdates');
    });

    expect(service.updateNotificationPreferences).toHaveBeenCalledWith(next);
    expect(result.current.preferences).toEqual(next);
    expect(result.current.updateStatus).toBe('idle');
  });

  it('surfaces a toggle failure without applying it, and retries the same key', async () => {
    const { result } = await renderLoaded();
    service.updateNotificationPreferences.mockRejectedValueOnce(new Error('500'));

    await act(async () => {
      await result.current.togglePreference('caseUpdates');
    });

    expect(result.current.updateStatus).toBe('error');
    expect(result.current.preferences).toEqual(basePrefs);

    const next = { ...basePrefs, caseUpdates: false };
    service.updateNotificationPreferences.mockResolvedValueOnce(next);

    await act(async () => {
      result.current.retryLastToggle();
    });

    await waitFor(() => expect(result.current.updateStatus).toBe('idle'));
    expect(service.updateNotificationPreferences).toHaveBeenLastCalledWith(next);
  });
});
