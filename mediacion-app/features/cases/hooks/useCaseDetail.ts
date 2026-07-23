import { useCallback, useEffect, useState } from 'react';

import { casesService } from '../../../services/cases.service';
import type { AiProposal, CaseDetail } from '../../../types/case';

export type CaseDetailStatus = 'loading' | 'error' | 'success';
export type AiProposalStatus = 'idle' | 'pending' | 'done';

export function useCaseDetail(caseId: string) {
  const [status, setStatus] = useState<CaseDetailStatus>('loading');
  const [detail, setDetail] = useState<CaseDetail | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  const [aiStatus, setAiStatus] = useState<AiProposalStatus>('idle');
  const [proposal, setProposal] = useState<AiProposal | undefined>(undefined);
  const [accepted, setAccepted] = useState(false);

  const reload = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    casesService
      .getCaseDetail(caseId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setStatus('error');
          return;
        }
        setDetail(result);
        setStatus('success');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, attempt]);

  const generateAiProposal = useCallback(() => {
    setAiStatus('pending');
    casesService.generateAiProposal(caseId).then((result) => {
      setProposal(result);
      setAiStatus('done');
    });
  }, [caseId]);

  const acceptAiProposal = useCallback(() => {
    setAccepted(true);
  }, []);

  return {
    status,
    detail,
    reload,
    aiStatus,
    proposal,
    accepted,
    generateAiProposal,
    acceptAiProposal,
  };
}
