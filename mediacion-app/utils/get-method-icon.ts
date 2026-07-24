import type { IconName } from '../design-system/components/Icon';
import type { MetodoCaso } from '../types/case';

/**
 * Single source of truth for the icon representing each resolution method —
 * previously only lived inline in the case-creation method picker; the
 * cases dashboard card reuses it now too, so both surfaces agree.
 */
export function getMethodIcon(metodo: MetodoCaso): IconName {
  return metodo === 'mediacion' ? 'scale' : metodo === 'conciliacion' ? 'shield-check' : 'messages-square';
}
