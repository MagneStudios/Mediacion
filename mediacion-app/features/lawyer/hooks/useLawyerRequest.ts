import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

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
 *
 * Relee en foco (mismo patrón que `useAgreement`): contra backend real el pago
 * lo confirma el webhook de Mercado Pago mientras la persona está fuera de la
 * app, y el único modo de reflejar ese estado al volver del checkout es releer.
 */
export function useLawyerRequest(casoId: string) {
  const [status, setStatus] = useState<UseLawyerRequestStatus>('loading');
  const [request, setRequest] = useState<LawyerRequest | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const read = useCallback(() => lawyerService.getRequest(casoId), [casoId]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    read()
      .then((result) => {
        if (cancelled) return;
        setRequest(result);
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
  }, [read]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnceRef.current) return;
      let cancelled = false;
      read()
        .then((result) => {
          if (!cancelled) setRequest(result);
        })
        .catch(() => {
          // Un refresh en foco es best-effort: se conserva el último estado.
        });
      return () => {
        cancelled = true;
      };
    }, [read]),
  );

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
