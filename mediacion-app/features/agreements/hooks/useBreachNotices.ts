import { useCallback, useEffect, useRef, useState } from 'react';

import { agreementsService } from '../../../services/agreements.service';
import type { BreachNotice } from '../../../types/agreement';

export type UseBreachNoticesResult = {
  notices: BreachNotice[];
  status: 'loading' | 'error' | 'success';
  reload: () => void;
};

/**
 * Breach notices for one agreement (`GET /acuerdos/:id/incumplimientos`).
 *
 * Kept out of `useAgreement` on purpose: that hook owns a piece of shared
 * state with careful in-flight/revision guards around two mutations, and a
 * second list with its own lifecycle inside it would be one more thing those
 * guards have to be right about. This one only reads.
 *
 * `agreementId` is nullable so the screen can call it before an agreement
 * exists — a caso with no agreement has no notices, which is `success` with an
 * empty list, not a loading state that never resolves.
 */
export function useBreachNotices(agreementId: string | null): UseBreachNoticesResult {
  const [notices, setNotices] = useState<BreachNotice[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [attempt, setAttempt] = useState(0);
  // Which agreement the state on screen belongs to. Without it, switching
  // agreements would show the previous one's notices until the new read lands.
  const activeIdRef = useRef<string | null>(agreementId);

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    activeIdRef.current = agreementId;
    if (agreementId === null) {
      setNotices([]);
      setStatus('success');
      return;
    }
    let cancelled = false;
    agreementsService
      .getBreachNotices(agreementId)
      .then((result) => {
        if (cancelled || activeIdRef.current !== agreementId) return;
        setNotices(result);
        setStatus('success');
      })
      .catch(() => {
        if (cancelled || activeIdRef.current !== agreementId) return;
        // The list is secondary to the agreement itself: an empty list plus an
        // error status lets the screen stay silent rather than claim there are
        // no notices when it simply could not read them.
        setNotices([]);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [agreementId, attempt]);

  return { notices, status, reload };
}
