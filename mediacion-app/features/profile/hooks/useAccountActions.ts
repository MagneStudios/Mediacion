import { useCallback, useState } from 'react';

import { profileService } from '../../../services/profile.service';
import type { AccountActionResult } from '../../../types/profile';

export type MutationStatus = 'idle' | 'pending' | 'error';

/**
 * The three mocked session/account-lifecycle actions: sign-out, session
 * restore (from the signed-out landing screen), and the idempotent
 * deactivation request. Each returns its own outcome directly (rather than
 * relying on the caller to read back state after a render) so the screen can
 * navigate or branch copy immediately once the awaited call settles.
 */
export function useAccountActions() {
  const [signOutStatus, setSignOutStatus] = useState<MutationStatus>('idle');
  const [restoreStatus, setRestoreStatus] = useState<MutationStatus>('idle');
  const [deactivateStatus, setDeactivateStatus] = useState<MutationStatus>('idle');
  const [deactivationResult, setDeactivationResult] = useState<AccountActionResult | null>(null);

  const signOut = useCallback(async (): Promise<boolean> => {
    if (signOutStatus === 'pending') return false;
    setSignOutStatus('pending');
    try {
      await profileService.signOutMock();
      setSignOutStatus('idle');
      return true;
    } catch {
      setSignOutStatus('error');
      return false;
    }
  }, [signOutStatus]);

  const restoreSession = useCallback(async (): Promise<boolean> => {
    if (restoreStatus === 'pending') return false;
    setRestoreStatus('pending');
    try {
      await profileService.restoreMockSession();
      setRestoreStatus('idle');
      return true;
    } catch {
      setRestoreStatus('error');
      return false;
    }
  }, [restoreStatus]);

  const requestDeactivation = useCallback(async (): Promise<AccountActionResult | null> => {
    if (deactivateStatus === 'pending') return null;
    setDeactivateStatus('pending');
    try {
      const result = await profileService.requestAccountDeactivationMock();
      setDeactivationResult(result);
      setDeactivateStatus('idle');
      return result;
    } catch {
      setDeactivateStatus('error');
      return null;
    }
  }, [deactivateStatus]);

  const resetSignOutStatus = useCallback(() => setSignOutStatus('idle'), []);
  const resetRestoreStatus = useCallback(() => setRestoreStatus('idle'), []);
  const resetDeactivateStatus = useCallback(() => setDeactivateStatus('idle'), []);

  return {
    signOutStatus,
    signOut,
    resetSignOutStatus,
    restoreStatus,
    restoreSession,
    resetRestoreStatus,
    deactivateStatus,
    deactivationResult,
    requestDeactivation,
    resetDeactivateStatus,
  };
}
