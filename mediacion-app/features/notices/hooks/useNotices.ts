import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { noticesService } from '../../../services/notices.service';
import type { NoticeFilter, NoticeListItem } from '../../../types/notice';

export type FetchStatus = 'loading' | 'error' | 'success';
export type MutationStatus = 'idle' | 'pending' | 'error';

/**
 * Notice list for the given filter, plus mark-read/mark-all mutations.
 * Mirrors useAgreement()'s fetch/focus-refresh shape. A focus refresh only
 * ever re-reads the same live mock store (never re-seeds it), so it can
 * never revert a locally-changed read state.
 */
export function useNotices(filter: NoticeFilter) {
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [notices, setNotices] = useState<NoticeListItem[]>([]);
  const [attempt, setAttempt] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markErrorId, setMarkErrorId] = useState<string | null>(null);
  const [markAllStatus, setMarkAllStatus] = useState<MutationStatus>('idle');

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const fetchSilently = useCallback(() => {
    let cancelled = false;
    noticesService.listNotices(filter).then((result) => {
      if (cancelled) return;
      setNotices(result);
      setStatus('success');
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    hasLoadedOnceRef.current = false;
    noticesService
      .listNotices(filter)
      .then((result) => {
        if (cancelled) return;
        setNotices(result);
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
  }, [filter, attempt]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) return;
      return fetchSilently();
    }, [fetchSilently]),
  );

  /**
   * Marks one notice read. Returns the updated notice on success, or null
   * on failure — in which case `markErrorId` is set so the caller can show
   * a recoverable, retryable error instead of navigating (the notice stays
   * unread). Guards duplicate activation: a second call for the same id
   * while the first is still in flight is a no-op.
   */
  const markOneRead = useCallback(
    async (noticeId: string) => {
      if (markingId === noticeId) return null;
      setMarkingId(noticeId);
      setMarkErrorId((current) => (current === noticeId ? null : current));
      try {
        const updated = await noticesService.markNoticeRead(noticeId);
        setMarkingId(null);
        fetchSilently();
        return updated;
      } catch {
        setMarkingId(null);
        setMarkErrorId(noticeId);
        return null;
      }
    },
    [markingId, fetchSilently],
  );

  const markAllRead = useCallback(async () => {
    if (markAllStatus === 'pending') return;
    setMarkAllStatus('pending');
    try {
      await noticesService.markAllNoticesRead();
      setMarkAllStatus('idle');
      fetchSilently();
    } catch {
      setMarkAllStatus('error');
    }
  }, [markAllStatus, fetchSilently]);

  return {
    status,
    notices,
    reload,
    markingId,
    markErrorId,
    markOneRead,
    markAllStatus,
    markAllRead,
  };
}
