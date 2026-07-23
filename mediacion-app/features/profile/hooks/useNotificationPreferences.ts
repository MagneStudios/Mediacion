import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { profileService } from '../../../services/profile.service';
import type { NotificationPreferences } from '../../../types/profile';

export type FetchStatus = 'loading' | 'error' | 'success';
export type MutationStatus = 'idle' | 'pending' | 'error';

/**
 * The seven demo notification categories, plus a single toggle mutation.
 * Mirrors useAgreement()'s fetch/focus-refresh shape. Every toggle sends the
 * full next preferences object (never a partial patch), so a forced failure
 * never leaves a half-applied change.
 */
export function useNotificationPreferences() {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const [updateStatus, setUpdateStatus] = useState<MutationStatus>('idle');
  const [lastToggledKey, setLastToggledKey] = useState<keyof NotificationPreferences | null>(null);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    profileService.getNotificationPreferences().then((result) => {
      if (cancelled) return;
      setPreferences(result);
      setStatus('success');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    hasLoadedOnceRef.current = false;
    profileService
      .getNotificationPreferences()
      .then((result) => {
        if (cancelled) return;
        setPreferences(result);
        setStatus('success');
        hasLoadedOnceRef.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) return;
      return fetchSilently();
    }, [fetchSilently]),
  );

  const togglePreference = useCallback(
    async (key: keyof NotificationPreferences) => {
      if (!preferences || updateStatus === 'pending') return;
      const next: NotificationPreferences = { ...preferences, [key]: !preferences[key] };
      setLastToggledKey(key);
      setUpdateStatus('pending');
      try {
        const result = await profileService.updateNotificationPreferences(next);
        setPreferences(result);
        setUpdateStatus('idle');
      } catch {
        setUpdateStatus('error');
      }
    },
    [preferences, updateStatus],
  );

  const retryLastToggle = useCallback(() => {
    if (lastToggledKey) togglePreference(lastToggledKey);
  }, [lastToggledKey, togglePreference]);

  const resetUpdateStatus = useCallback(() => {
    setUpdateStatus('idle');
  }, []);

  return { status, preferences, reload, updateStatus, togglePreference, retryLastToggle, resetUpdateStatus };
}
