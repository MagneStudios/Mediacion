import type { MetodoCaso } from "../casos/casos.types";
import type { MeetingPointEntry } from "./meeting-point";

/**
 * Tres configuraciones del motor, no una con parámetros cosméticos
 * (`CAMBIOS-PACTUM-v2` §6). La injerencia que el método habilita es distinta
 * en cada una y define qué puede escribir el modelo:
 *
 * - negociación: mínima. Encuadre y formas. No sugiere nada.
 * - conciliación: media. Ordena la charla y señala dónde está la distancia.
 * - mediación: máxima. Propone caminos sobre lo que quedó sin punto.
 *
 * Ninguna de las tres puede mover los números: `computeMeetingPoints` ya los
 * calculó y el modelo solo narra el resultado (RN-03).
 */
const instruccionesPorMetodo: Record<MetodoCaso, string[]> = {
  negociacion: [
    "Actuás con la mínima injerencia posible: encuadrás y cuidás las formas.",
    "Describí los puntos de encuentro en lenguaje neutral y nada más.",
    "No sugieras soluciones, no propongas alternativas y no opines sobre",
    "qué le conviene a cada parte.",
  ],
  conciliacion: [
    "Actuás con injerencia media: ordenás la conversación.",
    "Describí los puntos de encuentro y señalá con claridad en cuáles hay",
    "acuerdo y en cuáles sigue habiendo distancia, sin cuantificarla.",
    "Podés sugerir en qué orden conviene tratarlos, pero no propongas",
    "soluciones concretas.",
  ],
  mediacion: [
    "Actuás con la máxima injerencia: proponés caminos de solución.",
    "Describí los puntos de encuentro y, para los que quedaron sin punto",
    "numérico, proponé una o dos alternativas concretas que las partes",
    "puedan discutir.",
    "No afirmes que ninguna alternativa es la correcta ni presiones por una.",
  ],
};

const reglasComunes = [
  "Escribí en español rioplatense, en tono neutral y breve.",
  "No inventes cifras: usá exclusivamente los puntos de encuentro de abajo.",
  "No reveles ni deduzcas los rangos que cargó cada parte.",
];

/**
 * Un método que no está en el mapa cae en el de menor injerencia, no en el de
 * mayor: la columna es NOT NULL y del enum, así que esto no debería pasar,
 * pero si pasa el error seguro es que el modelo proponga de menos.
 */
export function buildMethodPrompt(
  metodo: MetodoCaso,
  meetingPoint: MeetingPointEntry[],
): string {
  const lines = meetingPoint.map(
    (entry) =>
      `${entry.categoria}: ${entry.punto === null ? "sin punto numérico" : entry.punto} (${entry.estado})`,
  );
  return [
    ...(instruccionesPorMetodo[metodo] ?? instruccionesPorMetodo.negociacion),
    ...reglasComunes,
    "Puntos de encuentro calculados:",
    ...lines,
  ].join("\n");
}
