import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import i18n from '../../../i18n';
import { profileService } from '../../../services/profile.service';
import type { MockProfile, UpdateProfileInput } from '../../../types/profile';
import { idiomaToLocale } from '../../../utils/map-language';

export type FetchStatus = 'loading' | 'error' | 'success';
export type MutationStatus = 'idle' | 'pending' | 'error';

/**
 * The authenticated party's own profile, plus the one mutation available on
 * it. Mirrors useAgreement()'s fetch/focus-refresh shape. A language change
 * is applied to i18n here (not inside the service), keeping the service a
 * pure data boundary — i18n is a UI-layer concern.
 */
export function useProfile() {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [profile, setProfile] = useState<MockProfile | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const [updateStatus, setUpdateStatus] = useState<MutationStatus>('idle');

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    profileService
      .getProfile()
      .then((result) => {
        if (cancelled) return;
        setProfile(result);
        setStatus('success');
      })
      .catch(() => {
        // A failed silent refresh keeps the data already on screen.
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
      .getProfile()
      .then((result) => {
        if (cancelled) return;
        setProfile(result);
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

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (updateStatus === 'pending') return;
      setUpdateStatus('pending');
      try {
        const result = await profileService.updateProfile(input);
        setProfile(result);
        if (input.idioma) {
          await i18n.changeLanguage(idiomaToLocale(result.idioma));
        }
        setUpdateStatus('idle');
      } catch {
        setUpdateStatus('error');
      }
    },
    [updateStatus],
  );

  const resetUpdateStatus = useCallback(() => {
    setUpdateStatus('idle');
  }, []);

  return { status, profile, reload, updateStatus, updateProfile, resetUpdateStatus };
}
