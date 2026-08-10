import { buildInitialNotificationPreferences, buildInitialProfile } from '../mocks/profile';
import type { AccountActionResult, MockProfile, NotificationPreferences, UpdateProfileInput } from '../types/profile';
import { createFailureController, delay, rejectAfter } from './mock-utils';
import { createBackedProfileService } from './api/profile.backed-service';
import { backend } from './backend-instance';

/**
 * Replaceable service boundary for the authenticated party's own profile,
 * notification preferences, and mocked session/account actions.
 *
 * BACKEND ALIGNMENT: see types/profile.ts for exactly which fields mirror
 * real `usuarios` columns and which are frontend-only mock presentation
 * state with no backend equivalent yet. This file never reads case,
 * position, negotiation, agreement, or signature data — profile state is
 * fully independent of product data, and signing out never clears any of
 * it. No password, token, biometric-verification, or auth-claim field is
 * ever read, stored, returned, or logged here.
 */
export type ProfileService = {
  getProfile(): Promise<MockProfile>;
  updateProfile(input: UpdateProfileInput): Promise<MockProfile>;
  getNotificationPreferences(): Promise<NotificationPreferences>;
  updateNotificationPreferences(input: NotificationPreferences): Promise<NotificationPreferences>;
  signOutMock(): Promise<void>;
  restoreMockSession(): Promise<void>;
  requestAccountDeactivationMock(): Promise<AccountActionResult>;
};

/** In-memory only — cleared on app restart, never written to disk, never logged. */
let mockProfile: MockProfile = buildInitialProfile();
let mockNotificationPreferences: NotificationPreferences = buildInitialNotificationPreferences();

/**
 * Smallest possible mock "session" flag — not a token, not a user id, not an
 * auth object. No route in this phase gates on it (there is no real
 * authentication yet); it exists only so signOutMock/restoreMockSession have
 * something concrete to flip, standing in for a future real session check.
 */
let mockSessionActive = true;

/** Test-only: resets the in-memory store back to its initial seed. Never imported by a screen. */
export function __resetMockProfile(): void {
  mockProfile = buildInitialProfile();
  mockNotificationPreferences = buildInitialNotificationPreferences();
  mockSessionActive = true;
}

const failures = createFailureController<
  'updateProfile' | 'updateNotificationPreferences' | 'requestAccountDeactivationMock'
>();

export function __mockForceProfileFailure(
  operation: 'updateProfile' | 'updateNotificationPreferences' | 'requestAccountDeactivationMock',
): void {
  failures.force(operation);
}

/**
 * R-06: the anonymization job runs 6 months after baja by default (10 years
 * for a user with an active subscription — not modeled here, since this app
 * has no subscription state at all yet; see `MockProfile`'s doc comment).
 */
const depuracionWindowMonths = 6;

function addMonths(iso: string, months: number): string {
  const date = new Date(iso);
  date.setMonth(date.getMonth() + months);
  return date.toISOString();
}

export function createMockProfileService(): ProfileService {
  return {
    async getProfile() {
      return delay({ ...mockProfile }, 300);
    },

    async updateProfile(input) {
      if (failures.consume('updateProfile')) {
        return rejectAfter('profile_update_failed', 500);
      }
      // Build the full next object before touching anything, so a forced
      // failure above never leaves a half-applied edit.
      const next: MockProfile = { ...mockProfile, ...input };
      const committed = await delay(next, 500);
      mockProfile = committed;
      return { ...committed };
    },

    async getNotificationPreferences() {
      return delay({ ...mockNotificationPreferences }, 300);
    },

    async updateNotificationPreferences(input) {
      if (failures.consume('updateNotificationPreferences')) {
        return rejectAfter('notification_preferences_update_failed', 500);
      }
      const next: NotificationPreferences = { ...input };
      const committed = await delay(next, 400);
      mockNotificationPreferences = committed;
      return { ...committed };
    },

    async signOutMock() {
      await delay(undefined, 400);
      mockSessionActive = false;
    },

    async restoreMockSession() {
      await delay(undefined, 300);
      mockSessionActive = true;
    },

    async requestAccountDeactivationMock() {
      if (failures.consume('requestAccountDeactivationMock')) {
        return rejectAfter('account_deactivation_failed', 600);
      }
      // Idempotent: a second call always returns the original timestamps —
      // never a new mutation, never a new record. `activo` is never flipped
      // here — a deactivation *request* is not a real backend deactivation.
      if (mockProfile.deactivationRequestedAt && mockProfile.depuracionProgramadaAt) {
        const requestedAt = mockProfile.deactivationRequestedAt;
        const depuracionProgramadaAt = mockProfile.depuracionProgramadaAt;
        return delay({ status: 'already_requested', requestedAt, depuracionProgramadaAt }, 300);
      }
      const requestedAt = new Date().toISOString();
      // R-06: computed in the same build-next-state step as requestedAt, so
      // a forced failure above never leaves one set without the other.
      const depuracionProgramadaAt = addMonths(requestedAt, depuracionWindowMonths);
      const committed = await delay({ requestedAt, depuracionProgramadaAt }, 700);
      mockProfile = { ...mockProfile, deactivationRequestedAt: committed.requestedAt, depuracionProgramadaAt: committed.depuracionProgramadaAt };
      return { status: 'requested', ...committed };
    },
  };
}

/** Default instance consumed by the feature hooks — the single place to swap in a real API-backed implementation later. */
export const profileService: ProfileService = backend
  ? createBackedProfileService(backend.profile, backend.auth)
  : createMockProfileService();
