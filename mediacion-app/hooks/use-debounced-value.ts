import { useEffect, useState } from 'react';

/**
 * Devuelve `value` retrasado `delayMs`. Sirve para no correr una heurística /
 * llamada cara en cada pulsación de tecla — se dispara solo cuando el valor
 * deja de cambiar por `delayMs`.
 *
 * `delayMs` se lee en cada render; si cambia, el timer se reinicia. El timer
 * pendiente se limpia al desmontar.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
