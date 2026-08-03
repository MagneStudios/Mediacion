import { act, renderHook, waitFor } from '@testing-library/react-native';

import { profileService } from '@/services/profile.service';
import type { MockProfile } from '@/types/profile';
import { useProfile } from '../useProfile';

// React 19 only flushes test updates when this flag is on; RTL v14's bundled
// act() sets a mangled global instead, so hook tests must set it themselves.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@/services/profile.service', () => ({
  profileService: {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
  },
}));

type FocusCallback = () => undefined | (() => void);
let mockFocusCallback: FocusCallback | null = null;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: FocusCallback) => {
    mockFocusCallback = callback;
  },
}));

const service = profileService as jest.Mocked<typeof profileService>;

const profile: MockProfile = {
  nombre: 'Ana',
  apellido: 'Perez',
  rol: 'parte',
  idioma: 'es',
  activo: true,
  communicationPreference: 'in_app_only',
  accessibilityPreference: 'system_default',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFocusCallback = null;
});

describe('useProfile', () => {
  it('loads the profile on mount', async () => {
    service.getProfile.mockResolvedValueOnce(profile);

    const { result } = await renderHook(() => useProfile());

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.profile).toEqual(profile);
  });

  it('keeps the last good profile when the focus refresh fails, with no unhandled rejection', async () => {
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      service.getProfile.mockResolvedValueOnce(profile);
      const { result } = await renderHook(() => useProfile());
      await waitFor(() => expect(result.current.status).toBe('success'));

      service.getProfile.mockRejectedValueOnce(new Error('offline'));
      await act(async () => {
        mockFocusCallback?.();
      });
      await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
      await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

      expect(rejections).toHaveLength(0);
      expect(result.current.status).toBe('success');
      expect(result.current.profile).toEqual(profile);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
