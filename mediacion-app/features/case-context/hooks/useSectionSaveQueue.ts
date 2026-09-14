import { useCallback, useRef } from 'react';

import { useCaseContextDraft } from './useCaseContextDraft';
import type { CaseContext, CaseContextSectionId } from '../../../types/case-context';

/**
 * Serializes saveSection calls for one section screen.
 *
 * Each SectionFields component calls onChange on every add/edit/delete,
 * which fires a fire-and-forget save; the Confirm button also saves before
 * navigating back. Two independent saveSection calls in flight at once can
 * resolve out of order and silently overwrite each other — worst case, the
 * Confirm call carries a stale pre-edit snapshot and reverts the user's last
 * change without any visible error.
 *
 * queueSave chains every save after the previous one settles, so saves
 * always apply in the order they were requested. flush() just waits for the
 * queue to drain instead of resending a local snapshot that may already be
 * stale by the time Confirm is pressed.
 */
export function useSectionSaveQueue() {
  const { saveSection } = useCaseContextDraft();
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const queueSave = useCallback(
    <K extends CaseContextSectionId>(caseId: string, sectionId: K, entries: CaseContext[K]) => {
      const next = queueRef.current.then(() => saveSection(caseId, sectionId, entries));
      // Keep the chain alive even if a save fails, so later saves still queue correctly;
      // callers that need to observe the failure should inspect the promise `queueSave` returns.
      queueRef.current = next.catch(() => undefined);
      return next;
    },
    [saveSection],
  );

  const flush = useCallback(() => queueRef.current, []);

  return { queueSave, flush };
}
