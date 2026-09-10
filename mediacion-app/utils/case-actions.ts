import type { Semaforo } from '../services/api/case-mapper';
import type { EstadoCaso } from '../types/case';

/**
 * Los estados desde los que la máquina de estados de DB admite pasar a
 * `terminado` — `validate_caso_estado_transition()`, en su versión vigente
 * (`20260906100000_pendiente_suscripciones_writable.sql:22-42`).
 *
 * **Se replica acá porque la alternativa es ofrecer un botón que falla.** El
 * servidor sólo valida que el `estado` pedido sea `terminado`
 * (`casos.service.ts:39-49`); quién puede llegar ahí desde dónde lo decide el
 * trigger, y si no coincide devuelve un `409` genérico que no le explica nada a
 * la persona. Es la misma razón por la que existen las tres utils de
 * elegibilidad que ya tenemos.
 *
 * Ausentes a propósito: `acordado`, `cerrado`, `terminado`, `vencido` y
 * `expirado`. En el trigger son absorbentes salvo `acordado → cerrado`, así que
 * desde ninguno de ellos se puede terminar.
 */
const estadosTerminables: EstadoCaso[] = [
  'nuevo',
  'pendiente_suscripciones',
  'activo',
  'en_negociacion',
];

/**
 * RN-08 — *"Cualquiera de las partes puede declarar expresamente el fin de una
 * negociación"*. Cualquiera, no sólo quien lo creó: el requisito no distingue, y
 * el servidor tampoco (sólo exige ser miembro del caso).
 *
 * **Incluye `nuevo`**, donde todavía no hay contraparte. Terminar un caso que
 * nadie llegó a aceptar es legítimo —se creó por error, o ya no hace falta— y el
 * trigger lo admite.
 */
export function canTerminateCase(estado: EstadoCaso): boolean {
  return estadosTerminables.includes(estado);
}

/**
 * RN-10 — *"una parte puede fijar un plazo puntual (ej. respuesta para el día
 * siguiente)"*.
 *
 * Más restrictivo que el servidor, que sólo exige ser miembro. Un plazo de
 * respuesta necesita a alguien que pueda responder:
 *
 * - **`nuevo`** no tiene contraparte todavía. Un plazo ahí no le corre a nadie.
 * - **`pendiente_suscripciones`** es el gate C-01: la otra parte está impedida
 *   de actuar hasta que haya suscripción. Ponerle un reloj a alguien que no
 *   puede moverse es presión sobre algo que no está en sus manos.
 * - Los estados terminales no tienen respuesta pendiente.
 */
export function canSetCaseDeadline(estado: EstadoCaso): boolean {
  return estado === 'activo' || estado === 'en_negociacion';
}

/**
 * Espejo de `estadosCasoNegociables` en `negociacion.service.ts` del
 * backend (`POST /casos/:id/negociaciones`). Igual que las otras utils de
 * elegibilidad: el servidor sólo exige ser miembro, así que ofrecer el botón
 * fuera de estos estados sería un `409 caso_no_negociable` sin explicación.
 *
 * **`pendiente_suscripciones` afuera a propósito** — es el gate C-01: la otra
 * parte está impedida de actuar hasta que haya suscripción, así que abrirle
 * una materia nueva no le sirve a nadie todavía.
 */
const estadosCasoNegociables: EstadoCaso[] = ['nuevo', 'activo', 'en_negociacion', 'acordado'];

export function canAddMateria(estado: EstadoCaso): boolean {
  return estadosCasoNegociables.includes(estado);
}

/**
 * Las opciones de plazo que ofrecemos, en horas.
 *
 * **Son duraciones y no una fecha de calendario, y es una decisión, no una
 * limitación.** El ejemplo que da el propio RN-10 es una duración
 * (*"respuesta para el día siguiente"*), el design system no tiene date picker,
 * y un campo de fecha a mano arrastra zonas horarias y formatos por locale para
 * expresar algo que el usuario piensa como "mañana" o "en una semana".
 *
 * Además se alinean con los umbrales del semáforo que el servidor calcula
 * (`apps/api/src/casos/semaforo.ts`: ≤24 h rojo, ≤72 h amarillo), así que la
 * elección tiene una consecuencia visible y predecible.
 *
 * El día que exista un calendario, se agrega sin tocar el contrato: lo que
 * viaja al servidor es un instante ISO igual.
 */
export const deadlinePresetHours = [24, 72, 168] as const;

export type DeadlinePresetHours = (typeof deadlinePresetHours)[number];

/**
 * El instante que se le manda al servidor para un preset.
 *
 * `now` se inyecta para que los tests no dependan del reloj. El servidor exige
 * que el plazo sea **estrictamente futuro** (`casos.service.ts:77-82`), y
 * cualquiera de estos presets lo es.
 */
export function toDeadlineIso(hours: DeadlinePresetHours, now: Date = new Date()): string {
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

/**
 * El semáforo que el servidor calcularía para un plazo dado.
 *
 * **Espejo de `apps/api/src/casos/semaforo.ts`, y la autoridad es aquél.** El
 * camino real nunca usa esta función: `semaforo` viaja en el payload del caso.
 * Existe sólo para que el mock se comporte como el servidor —mismo criterio que
 * el resto de los mocks de este repo— y para que elegir un preset tenga en la
 * demo la misma consecuencia visible que va a tener en producción.
 *
 * Los umbrales son `<=` en los dos casos, igual que allá: un plazo de
 * exactamente 24 h es rojo, no amarillo.
 */
export function toSemaforoFromDeadline(plazo: string | null, now: Date): Semaforo | null {
  if (plazo === null) {
    return null;
  }
  const remainingMs = Date.parse(plazo) - now.getTime();
  // Un plazo ilegible es "no sé", nunca `verde`: toda comparación contra NaN es
  // falsa, así que caer por defecto pintaría de sano un caso vencido.
  if (Number.isNaN(remainingMs)) {
    return null;
  }
  if (remainingMs <= 24 * 60 * 60 * 1000) {
    return 'rojo';
  }
  if (remainingMs <= 72 * 60 * 60 * 1000) {
    return 'amarillo';
  }
  return 'verde';
}
