const combiningMarks = /[̀-ͯ]/g;
const nonWordRun = /[^\p{L}\p{N}]+/gu;

/**
 * Sin acentos y en minúsculas, para que la lista de `configuracion` no tenga
 * que enumerar "pelotudo", "Pelotudo" y "pelotúdo" por separado.
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(combiningMarks, "")
    .toLowerCase()
    .replace(nonWordRun, " ")
    .trim();
}

/**
 * Compara por palabra entera, nunca por subcadena: el problema clásico de
 * filtrar texto libre es bloquear una palabra inocente porque contiene otra
 * adentro. Un término de la lista con espacios ("hijo de") también se busca
 * como secuencia de palabras completas.
 */
export function findOffensiveTerms(
  value: string,
  terminos: readonly string[],
): string[] {
  const words = normalize(value).split(" ").filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const haystack = ` ${words.join(" ")} `;
  const found = new Set<string>();
  for (const termino of terminos) {
    const needle = normalize(termino);
    if (needle.length === 0) {
      continue;
    }
    if (haystack.includes(` ${needle} `)) {
      found.add(termino);
    }
  }
  return [...found];
}
