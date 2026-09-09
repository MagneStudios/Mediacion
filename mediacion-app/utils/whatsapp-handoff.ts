/**
 * Handoff al estudio por WhatsApp — spec de monetización §7.5, y la respuesta
 * del cliente del 01/09/2026 punto 2.
 *
 * El spec planteaba dos caminos para avisarle al estudio cuando alguien paga:
 * la WhatsApp Business Cloud API (Meta) o Twilio, con número verificado y
 * plantillas pre-aprobadas; o el **fallback v1**, un `wa.me` con el mensaje
 * precargado que el usuario mismo dispara. El cliente eligió el fallback, así
 * que para v1 no hace falta contratar nada.
 *
 * **La restricción que manda acá:** *"Nunca exponer datos sensibles de la
 * negociación en la URL de `wa.me` — solo un identificador corto."* La URL
 * viaja por el sistema operativo, por WhatsApp y por cualquier historial que
 * haya en el medio; el objeto de la disputa no puede ir ahí. Por eso este
 * módulo **no acepta texto libre**: arma el mensaje él mismo a partir de una
 * plantilla y un código validado (ver `buildHandoffUrl`).
 */

/**
 * `wa.me` quiere el número internacional completo **en dígitos y nada más**:
 * sin `+`, sin espacios, sin guiones ni paréntesis, y sin el 0 ni el 15 que se
 * usan al discar dentro de Argentina.
 *
 * Devuelve `null` en vez de un número a medias: un `wa.me` con un destino
 * inválido abre WhatsApp en una pantalla de error, que se parece bastante a
 * que la app esté rota.
 */
export function toWaMePhone(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const digits = raw.replace(/\D/g, '');
  // El E.164 admite de 8 a 15 dígitos contando el código de país. Más corto
  // que eso no es un número internacional, es un interno mal cargado.
  if (digits.length < 8 || digits.length > 15) {
    return null;
  }
  // Un cero a la izquierda es discado nacional; `wa.me` lo rechaza.
  return digits.replace(/^0+/, '') || null;
}

/**
 * El identificador que se deja viajar en el mensaje. Deliberadamente estrecho:
 * el id de la solicitud (`lawreq-0001`) entra, el nombre de la contraparte o
 * el objeto del caso no.
 *
 * Es la mitad ejecutable de la restricción del spec. La otra mitad es que la
 * plantilla del mensaje vive en i18n y no recibe ningún otro dato.
 */
export function isSafeHandoffCode(code: string): boolean {
  return /^[A-Za-z0-9-]{1,32}$/.test(code);
}

export type HandoffUrlInput = {
  /** Número del estudio, tal como venga: se normaliza acá. */
  phone: string | null | undefined;
  /** Plantilla ya traducida, con el código adentro. Nada más. */
  message: string;
  /** El identificador corto, para validarlo antes de dejarlo salir. */
  code: string;
};

/**
 * Arma el deep link, o `null` si no se puede armar uno seguro.
 *
 * `null` no es un error a esconder: significa "todavía no hay número del
 * estudio" (dato de Administración, pendiente) o "alguien intentó meter algo
 * que no es un código corto". Las dos cosas las representa la pantalla.
 */
export function buildHandoffUrl({ phone, message, code }: HandoffUrlInput): string | null {
  const destination = toWaMePhone(phone);
  if (destination === null || !isSafeHandoffCode(code)) {
    return null;
  }
  if (!message.includes(code)) {
    // La plantilla tiene que llevar el código: es lo único que le permite al
    // estudio cruzar el mensaje con la solicitud pagada. Sin eso el handoff
    // es un "hola" sin referencia.
    return null;
  }
  return `https://wa.me/${destination}?text=${encodeURIComponent(message)}`;
}
