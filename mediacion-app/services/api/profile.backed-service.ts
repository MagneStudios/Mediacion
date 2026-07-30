import type {
  AccountActionResult,
  MockProfile,
  NotificationPreferences,
  UpdateProfileInput,
} from '@/types/profile';

import type { AuthService } from '../auth/auth.service';
import type { ProfileService } from '../profile.service';
import type { ProfileApiService } from './profile.api-service';

/**
 * Presents the real `/me` endpoints plus real Supabase auth under the contract
 * the profile screens already consume.
 *
 * Three members of `ProfileService` have no server counterpart, and each is
 * handled explicitly rather than faked:
 *
 * - `restoreMockSession`: a real session restores itself, since the Supabase
 *   client persists it and refreshes in the background. This asks for it and
 *   fails if there is none, because "restored" with no session would be false.
 *
 * - `requestAccountDeactivationMock`: now backed by `POST /me/desactivacion`,
 *   which is idempotent — a repeat call reports the original request rather
 *   than filing a second one.
 */
export function createBackedProfileService(
  api: ProfileApiService,
  auth: AuthService,
): ProfileService {
  return {
    getProfile(): Promise<MockProfile> {
      return api.getProfile();
    },

    updateProfile(input: UpdateProfileInput): Promise<MockProfile> {
      return api.updateProfile(input);
    },

    getNotificationPreferences(): Promise<NotificationPreferences> {
      return api.getNotificationPreferences();
    },

    updateNotificationPreferences(
      input: NotificationPreferences,
    ): Promise<NotificationPreferences> {
      return api.updateNotificationPreferences(input);
    },

    async signOutMock(): Promise<void> {
      await auth.signOut();
    },

    async restoreMockSession(): Promise<void> {
      const session = await auth.getSession();
      if (session === null) {
        throw new Error('There is no stored session to restore. Sign in again.');
      }
    },

    requestAccountDeactivationMock(): Promise<AccountActionResult> {
      return api.requestAccountDeactivation();
    },
  };
}
