/**
 * Escalamiento a abogado — el producto transaccional de pago único del spec
 * de monetización Pactum (§7). Espeja `lawyer_requests` de
 * `20260821120000_monetizacion_fase1.sql`, con la misma convención que
 * `types/billing.ts`: los valores de enum se copian del schema real, no se
 * inventan paralelos.
 */

/** Matches `estado_solicitud_abogado` exactly. */
export type EstadoSolicitudAbogado =
  | 'pendiente_pago'
  | 'pagada'
  | 'notificada'
  | 'asignada'
  | 'cerrada'
  | 'reembolsada'
  | 'fallida';

/**
 * El precio, en unidades mínimas enteras — nunca `float` (spec §12: "todos los
 * montos se manejan en enteros de unidad mínima"). ARS 50.000 son 5.000.000.
 */
export type LawyerFee = {
  currency: 'ARS' | 'USD';
  amountMinor: number;
};

/**
 * Lo que se le muestra al usuario antes de cobrarle.
 *
 * **`scope` y `responseHours` son nullable a propósito, y hoy son null.** El
 * alcance del servicio de ARS 50.000 —¿es una consulta puntual, el patrocinio
 * del caso entero, cuántas horas, en cuánto responden?— es la decisión #1 de
 * las pendientes del spec y la tiene que definir **Solmi & Asociados**. El
 * spec la marca como *bloqueante para publicar*: "no se puede cobrar sin decir
 * qué se entrega".
 *
 * Así que el tipo admite "todavía no está definido" y la pantalla lo muestra,
 * en vez de que alguien invente un alcance para que el modal se vea completo.
 * Es el mismo criterio que los `[COMPLETAR]` visibles de los textos legales:
 * el bloqueo se ve.
 */
export type LawyerServiceOffer = {
  fee: LawyerFee;
  /** Qué incluye, en viñetas. `null` = pendiente de Solmi. */
  scope: string[] | null;
  /** Plazo de respuesta declarado, en horas. `null` = pendiente de Solmi. */
  responseHours: number | null;
};

/**
 * Lo que hace falta para el handoff por WhatsApp del spec §7.5, una vez que el
 * pago está confirmado.
 *
 * **Este pedazo del contrato con BE sí se puede congelar hoy**, aunque el
 * resto de la ficha del endpoint siga abierta: `docs/plan-frontend-monetizacion.md`
 * §4.4 la dejó sin cerrar porque el alcance del servicio (decisión #1, Solmi)
 * cambia qué muestra la pantalla — pero el número del estudio y el código de
 * la solicitud no dependen de eso.
 */
export type LawyerHandoff = {
  /**
   * Número del estudio. **`null` = todavía no llegó** — es un dato de
   * Administración, no una decisión de producto, y la pantalla lo representa
   * como bloqueo visible en vez de esconder el botón.
   *
   * Viaja en el payload porque es donde BE prefiere tenerlo; el
   * `EXPO_PUBLIC_ESTUDIO_WHATSAPP` de `config/env.ts` es el fallback mientras
   * el endpoint no exista.
   */
  estudioWhatsapp: string | null;
  /**
   * El identificador corto que va en el mensaje precargado, y **lo único** de
   * la negociación que puede viajar en la URL de `wa.me` (§7.5). Ver
   * `utils/whatsapp-handoff.ts`.
   */
  codigo: string;
};

export type LawyerRequest = {
  id: string;
  casoId: string;
  estado: EstadoSolicitudAbogado;
  fee: LawyerFee;
  createdAt: string;
  /** Disponible recién con el pago confirmado; `null` mientras esté `pendiente_pago`. */
  handoff: LawyerHandoff | null;
};
