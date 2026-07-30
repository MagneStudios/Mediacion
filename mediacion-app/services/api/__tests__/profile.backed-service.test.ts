import type { Session } from '@supabase/supabase-js';

import type { MockProfile } from '@/types/profile';

import type { AuthService } from '../../auth/auth.service';
import type { ProfileApiService } from '../profile.api-service';
import { createBackedProfileService } from '../profile.backed-service';

const profile = {
  id: 'u-1',
  nombre: 'Ana',
  email: 'ana@example.com',
} as unknown as MockProfile;

function stubApi(overrides: Partial<ProfileApiService> = {}): ProfileApiService {
  return {
    getProfile: async () => profile,
    updateProfile: async () => profile,
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
    // `/me` exposes GET and PATCH over usuarios columns only; no endpoint backs
    // these. They follow the same in-memory approach the profile service
    // already uses for fields no column backs, rather than pretending to persist.
    it('starts from the application defaults', async () => {
      const service = createBackedProfileService(stubApi(), stubAuth());
      await expect(service.getNotificationPreferences()).resolves.toEqual(
        expect.objectContaining({ caseUpdates: expect.any(Boolean) }),
      );
    });

    it('reflects an update for the rest of the session', async () => {
      const service = createBackedProfileService(stubApi(), stubAuth());
      const current = await service.getNotificationPreferences();
      const next = { ...current, productUpdates: !current.productUpdates };
      await expect(service.updateNotificationPreferences(next)).resolves.toEqual(next);
      await expect(service.getNotificationPreferences()).resolves.toEqual(next);
    });

    it('hands back a copy, so a caller cannot mutate the stored state', async () => {
      const service = createBackedProfileService(stubApi(), stubAuth());
      const first = await service.getNotificationPreferences();
      first.caseUpdates = !first.caseUpdates;
      const second = await service.getNotificationPreferences();
      expect(second.caseUpdates).not.toBe(first.caseUpdates);
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
    // No endpoint exists, and AccountActionResult has no failure variant. Telling
    // someone their deactivation was filed when nothing was sent is a real harm:
    // they may stop using the account expecting it to be closed.
    it('refuses rather than reporting a request it never made', async () => {
      const service = createBackedProfileService(stubApi(), stubAuth());
      await expect(service.requestAccountDeactivationMock()).rejects.toThrow(
        /not supported/i,
      );
    });

    it('stays refused on a second attempt — no local state pretends otherwise', async () => {
      const service = createBackedProfileService(stubApi(), stubAuth());
      await expect(service.requestAccountDeactivationMock()).rejects.toThrow();
      await expect(service.requestAccountDeactivationMock()).rejects.toThrow();
    });
  });
});
