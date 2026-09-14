import type { ModerationFinding, ModerationSeverity } from '../../../types/moderation';

/**
 * Placeholder de baja fidelidad — NO es detección real de lenguaje ofensivo.
 * Lista corta y cerrada de términos en español, matching por palabra completa
 * (límite de palabra, mayúsculas/minúsculas insensibles). Fácil de bypassear y
 * con falsos positivos/negativos; su único propósito es demostrar el flujo
 * tipear → advertir → reformular en el FE hasta que Backend exponga el
 * servicio real (`docs/pedidos-post-auditoria-14-09.md` §2.3).
 */
const PROFANITY_TERMS: ReadonlyArray<{ term: string; severity: ModerationSeverity }> = [
  { term: 'idiota', severity: 'low' },
  { term: 'estupido', severity: 'low' },
  { term: 'estúpido', severity: 'low' },
  { term: 'imbecil', severity: 'low' },
  { term: 'imbécil', severity: 'low' },
  { term: 'gil', severity: 'low' },
  { term: 'forro', severity: 'low' },
  { term: 'pendejo', severity: 'medium' },
  { term: 'boludo', severity: 'medium' },
  { term: 'pelotudo', severity: 'medium' },
  { term: 'mierda', severity: 'medium' },
  { term: 'cabron', severity: 'medium' },
  { term: 'cabrón', severity: 'medium' },
  { term: 'hijo de puta', severity: 'high' },
  { term: 'hija de puta', severity: 'high' },
  { term: 'puta', severity: 'high' },
];

const NORMALIZED = PROFANITY_TERMS.map((entry) => ({
  ...entry,
  pattern: new RegExp(`(?:^|[^\\p{L}])${escapeRegExp(entry.term)}(?:$|[^\\p{L}])`, 'iu'),
}));

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Devuelve los términos de la lista que aparecen en `text` como palabra
 * completa. Vacío si no hay coincidencias. Nunca lanza.
 */
export function matchProfanity(text: string): ModerationFinding[] {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  const findings: ModerationFinding[] = [];
  for (const { term, severity, pattern } of NORMALIZED) {
    if (pattern.test(trimmed)) {
      findings.push({ term, severity });
    }
  }
  return findings;
}
