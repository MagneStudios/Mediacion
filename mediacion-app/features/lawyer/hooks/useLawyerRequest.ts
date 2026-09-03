import { useCallback, useEffect, useState } from 'react';

import { lawyerService } from '../../../services/lawyer.service';
import type { LawyerRequest } from '../../../types/lawyer';

export type UseLawyerRequestStatus = 'loading' | 'error' | 'success';

/**
 * La solicitud de abogado vigente de un caso, si la hay.
 *
 * Mismo contrato que `useCurrentSubscription`: `request: null` en estado
 * `success` es un resultado tranquilo —este caso nunca pidió abogado— y no se
 * confunde con `error`. La distinción importa porque las dos cosas se dibujan
 * distinto: sin solicitud va el botón de contratar; con error, nada.
 */
export function useLawyerRequest(casoId: string) {
  const [status, setStatus] = useState<UseLawyerRequestStatus>('loading');
  const [request, setRequest] = useState<LawyerRequest | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    lawyerService
      .getRequest(casoId)
      .then((result) => {
        if (cancelled) return;
        setRequest(result);
        setStatus('success');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [casoId]);

  /**
   * Para que quien crea o paga una solicitud publique el resultado que ya
   * tiene en la mano, en vez de volver a pedirlo. Evita el parpadeo de un
   * refetch que sabemos qué va a devolver.
   */
  const publish = useCallback((next: LawyerRequest) => {
    setRequest(next);
    setStatus('success');
  }, []);

  return { status, request, publish };
}
