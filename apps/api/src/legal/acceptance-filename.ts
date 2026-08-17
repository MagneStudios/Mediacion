const unsafeFilenameChars = /[^A-Za-z0-9:.-]/g;
const alphanumeric = /[A-Za-z0-9]/;

function toFilenamePart(value: string | undefined, fallback: string): string {
  const safe = value?.replace(unsafeFilenameChars, "");
  return safe && alphanumeric.test(safe) ? safe : fallback;
}

export function buildAcceptancesFilename(
  desde: string | undefined,
  hasta: string | undefined,
  extension: string,
): string {
  return `aceptaciones-${toFilenamePart(desde, "inicio")}-${toFilenamePart(hasta, "hoy")}.${extension}`;
}
