/**
 * El `init_point` que devuelve `POST /suscripciones/:id/pago` es una URL que
 * nuestro servidor obtuvo de Mercado Pago y nos entrega para que el dispositivo
 * la abra.
 *
 * No es entrada del usuario, pero **es el único lugar donde un valor que llega
 * por la red se convierte en algo que el dispositivo abre**, así que recibe el
 * mismo trato que el handoff de WhatsApp (`utils/whatsapp-handoff.ts`): se
 * valida acá, y lo que no pasa devuelve `null` en vez de abrirse.
 *
 * **La comprobación de host es por `mercadopago.` y no por una lista cerrada de
 * dominios a propósito.** Mercado Pago sirve el checkout desde varios TLD por
 * país (`.com.ar`, `.com`, y los de sandbox), y una lista cerrada mal adivinada
 * mata el checkout en producción por un motivo que nadie va a poder deducir
 * mirando la pantalla. Esto rechaza un host ajeno —que es de lo que se trata—
 * sin apostar a qué dominio exacto usa MP hoy.
 */
export function toCheckoutUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  // Sólo https: un `http:` expondría el checkout a manipulación en tránsito, y
  // cualquier otro esquema (`javascript:`, `file:`, un deep link a otra app)
  // no tiene nada que hacer acá.
  if (parsed.protocol !== 'https:') {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!host.includes('mercadopago.')) {
    return null;
  }
  return parsed.toString();
}
