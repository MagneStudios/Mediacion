/**
 * Moderación de lenguaje ofensivo (placeholder de baja fidelidad, FE-only).
 *
 * El requisito de producto (`CAMBIOS-PACTUM-v2` §7) pide detectar lenguaje
 * ofensivo antes de que el texto se muestre a la otra parte, avisar para que
 * se reformule y registrar el evento para trazabilidad. Esa detección real y
 * la tabla de trazabilidad son responsabilidad de Backend/DB
 * (`docs/pedidos-post-auditoria-14-09.md` §1.2 / §2.3) y hoy no existen.
 *
 * Mientras tanto, este módulo define los tipos del *resultado* de la
 * moderación y la heurística local mínima que los produce. La firma de
 * `useLanguageModeration` / `ModerationResult` es la que va a consumir el
 * servicio real cuando exista: reemplazar el cuerpo de `runCheck` por
 * `moderationService.analyze(text)` sin tocar quién lo llama.
 */

export type ModerationSeverity = 'low' | 'medium' | 'high';

export type ModerationFinding = {
  term: string;
  severity: ModerationSeverity;
};

export type ModerationResult = {
  flagged: boolean;
  findings: ModerationFinding[];
};
