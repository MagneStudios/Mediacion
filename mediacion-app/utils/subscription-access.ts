import type { EstadoSuscripcion, MockSubscription } from '../types/billing';

/**
 * The slice of the Pactum spec's §5.3 access matrix that A5 needs.
 *
 * | Estado | ¿Puede contratar abogado? |
 * |---|---|
 * | `activa` | sí |
 * | `vencida` (`past_due`) | sí — hay 7 días de gracia y el cobro se reintenta |
 * | `pendiente_pago` | no |
 * | `pausada` | no |
 * | `cancelada` | no |
 *
 * **Esto es UX, no seguridad.** La garantía tiene que estar en el servidor: el
 * endpoint de solicitud valida la suscripción antes de crear la preference
 * (spec §7.4). Ocultar o deshabilitar el botón sólo evita que alguien pague
 * por un camino que igual le van a rechazar.
 *
 * El resto de la matriz —crear, operar lo existente— llega con A4, y va a
 * vivir acá al lado. Se agrega cuando haya una pantalla que la use, no antes.
 */
export function canRequestLawyer(subscription: MockSubscription | null): boolean {
  if (!subscription) {
    return false;
  }
  const estado: EstadoSuscripcion = subscription.estado;
  switch (estado) {
    case 'activa':
    case 'vencida':
      return true;
    case 'pendiente_pago':
    case 'pausada':
    case 'cancelada':
      return false;
    default: {
      // Un sexto valor del enum rompe `tsc` acá en vez de decidir en silencio
      // si alguien puede o no gastar cuarenta mil pesos.
      const exhaustive: never = estado;
      return exhaustive;
    }
  }
}
