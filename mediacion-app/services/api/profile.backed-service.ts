import { buildInitialNotificationPreferences } from '../../mocks/profile';
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
 * - Notification preferences: `/me` exposes GET and PATCH over `usuarios`
 *   columns only, and none of these seven flags is a column. They are kept in
 *   memory for the session — the same approach `profile.api-service.ts` already
 *   takes for `communicationPreference` and friends — starting from the
 *   application defaults so the screen renders something truthful.
 *
 * - `restoreMockSession`: a real session restores itself, since the Supabase
 *   client persists it and refreshes in the background. This asks for it and
 *   fails if there is none, because "restored" with no session would be false.
 *
 * - `requestAccountDeactivationMock`: no endpoint exists, and
 *   `AccountActionResult` has no failure variant to express that. It rejects.
 *   Reporting `status: 'requested'` for a request that was never sent would let
 *   someone walk away believing their account is being closed.
 */
export function createBackedProfileService(
  api: ProfileApiService,
  auth: AuthService,
): ProfileService {
  let preferences: NotificationPreferences = buildInitialNotificationPreferences();

  return {
    getProfile(): Promise<MockProfile> {
      return api.getProfile();
    },

    updateProfile(input: UpdateProfileInput): Promise<MockProfile> {
      return api.updateProfile(input);
    },

    async getNotificationPreferences(): Promise<NotificationPreferences> {
      return { ...preferences };
    },

    async updateNotificationPreferences(
      input: NotificationPreferences,
    ): Promise<NotificationPreferences> {
      preferences = { ...input };
      return { ...preferences };
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

    async requestAccountDeactivationMock(): Promise<AccountActionResult> {
      throw new Error(
        'Account deactivation is not supported by the backend yet, so nothing was submitted.',
      );
    },
  };
}
