import { useMemo } from 'react';

import { matchProfanity } from '../heuristics/es-profanity-list';
import type { ModerationResult } from '../../../types/moderation';
import { useDebouncedValue } from '../../../hooks/use-debounced-value';

export type LanguageModerationStatus = 'idle' | 'checking';

export type UseLanguageModeration = {
  result: ModerationResult;
  status: LanguageModerationStatus;
};

const DEBOUNCE_MS = 400;

/**
 * Aviso de moderación de lenguaje ofensivo (placeholder FE-only).
 *
 * Toma el texto en crudo, lo debouncea (~400ms) y corre la heurística local
 * `matchProfanity`. Expone `{ result, status }` para que la UI muestre
 * `InlineWarning` cuando `result.flagged` — y **nunca** bloquea el submit.
 *
 * Cuando Backend exponga el endpoint real, el único cambio es el cuerpo de
 * `runCheck` (llamar `moderationService.analyze(text)` en vez de
 * `matchProfanity`); la firma de este hook y lo que consume la pantalla no
 * cambian.
 */
export function useLanguageModeration(text: string): UseLanguageModeration {
  const debounced = useDebouncedValue(text, DEBOUNCE_MS);
  const checking = debounced !== text;

  const result = useMemo<ModerationResult>(() => {
    const findings = matchProfanity(debounced);
    return { flagged: findings.length > 0, findings };
  }, [debounced]);

  return { result, status: checking ? 'checking' : 'idle' };
}
