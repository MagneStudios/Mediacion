import type { Session } from '@supabase/supabase-js';

import type {
  AccountActionResult,
  MockProfile,
  NotificationPreferences,
} from '@/types/profile';

import type { AuthService } from '../../auth/auth.service';
import type { ProfileApiService } from '../profile.api-service';
import { createBackedProfileService } from '../profile.backed-service';

const profile = {
  id: 'u-1',
  nombre: 'Ana',
  email: 'ana@example.com',
} as unknown as MockProfile;

const defaultPreferences: NotificationPreferences = {
  caseUpdates: true,
  proposalReady: true,
  responseReceived: true,
  signatureReady: true,
  agreementCompleted: true,
  mediatorAvailability: true,
  productUpdates: true,
};

const deactivationResult: AccountActionResult = {
  status: 'requested',
  requestedAt: '2026-07-30T12:00:00.000Z',
  depuracionProgramadaAt: '2027-01-30T12:00:00.000Z',
};

function stubApi(overrides: Partial<ProfileApiService> = {}): ProfileApiService {
  return {
    getProfile: async () => profile,
    updateProfile: async () => profile,
    getNotificationPreferences: async () => defaultPreferences,
    updateNotificationPreferences: async () => defaultPreferences,
    requestAccountDeactivation: async () => deactivationResult,
    ...overrides,
  };
}

function stubAuth(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getAccessToken: async () => 'token',
    getSession: async () => ({}) as Session,
    signIn: async () => ({}) as Session,
    signUp: async () => null,
    signOut: async () => undefined,
    onSessionChange: () => () => undefined,
    ...overrides,
  };
}

describe('createBackedProfileService', () => {
  it('reads and writes the profile through the API', async () => {
    const updateProfile = jest.fn(async () => profile);
    const service = createBackedProfileService(stubApi({ updateProfile }), stubAuth());
    await expect(service.getProfile()).resolves.toEqual(profile);
    await service.updateProfile({ nombre: 'Ana María' });
    expect(updateProfile).toHaveBeenCalledWith({ nombre: 'Ana María' });
  });

  describe('notification preferences', () => {
    it('reads them from the API rather than from local state', async () => {
      const stored = { ...defaultPreferences, productUpdates: false };
      const getNotificationPreferences = jest.fn(async () => stored);
      const service = createBackedProfileService(
        stubApi({ getNotificationPreferences }),
        stubAuth(),
      );
      await expect(service.getNotificationPreferences()).resolves.toEqual(stored);
      expect(getNotificationPreferences).toHaveBeenCalled();
    });

    it('sends an update to the API and returns what the server stored', async () => {
      const persisted = { ...defaultPreferences, caseUpdates: false };
      const updateNotificationPreferences = jest.fn(async () => persisted);
      const service = createBackedProfileService(
        stubApi({ updateNotificationPreferences }),
        stubAuth(),
      );
      const next = { ...defaultPreferences, caseUpdates: false };
      // The server's answer wins: it merges the patch onto what it holds, so
      // echoing the request back could disagree with what was actually saved.
      await expect(service.updateNotificationPreferences(next)).resolves.toEqual(persisted);
      expect(updateNotificationPreferences).toHaveBeenCalledWith(next);
    });
  });

  describe('session actions', () => {
    it('signs out for real', async () => {
      const signOut = jest.fn(async () => undefined);
      const service = createBackedProfileService(stubApi(), stubAuth({ signOut }));
      await service.signOutMock();
      expect(signOut).toHaveBeenCalled();
    });

    it('restores by asking Supabase for the persisted session', async () => {
      const getSession = jest.fn(async () => ({}) as Session);
      const service = createBackedProfileService(stubApi(), stubAuth({ getSession }));
      await expect(service.restoreMockSession()).resolves.toBeUndefined();
      expect(getSession).toHaveBeenCalled();
    });

    it('fails when there is no session to restore, rather than faking one', async () => {
      const service = createBackedProfileService(
        stubApi(),
        stubAuth({ getSession: async () => null }),
      );
      await expect(service.restoreMockSession()).rejects.toThrow();
    });
  });

  describe('account deactivation', () => {
    it('files the request through the API', async () => {
      const requestAccountDeactivation = jest.fn(async () => deactivationResult);
      const service = createBackedProfileService(
        stubApi({ requestAccountDeactivation }),
        stubAuth(),
      );
      await expect(service.requestAccountDeactivationMock()).resolves.toEqual(
        deactivationResult,
      );
      expect(requestAccountDeactivation).toHaveBeenCalled();
    });

    it('reports the server verdict on a repeat, never inventing a second request', async () => {
      // The endpoint is idempotent: a repeat returns the ORIGINAL timestamp.
      // The service must pass that through rather than treating it as new.
      const already: AccountActionResult = {
        status: 'already_requested',
        requestedAt: deactivationResult.requestedAt,
        depuracionProgramadaAt: deactivationResult.depuracionProgramadaAt,
      };
      const service = createBackedProfileService(
        stubApi({ requestAccountDeactivation: async () => already }),
        stubAuth(),
      );
      await expect(service.requestAccountDeactivationMock()).resolves.toEqual(already);
    });
  });
});
