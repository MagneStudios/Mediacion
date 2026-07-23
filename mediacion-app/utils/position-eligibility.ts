import type { EstadoCaso } from '../types/case';

export type PositionEligibility = 'ineligible' | 'read_only' | 'editable';

/**
 * Single source of truth for what a case's `estado` allows for private
 * position management — consumed by both the UI (to show/hide actions) and
 * the mock service layer (to enforce independently of UI gating).
 *
 * - `nuevo` (no counterparty linked yet): no position entry at all.
 * - `activo` / `en_negociacion`: full create/edit/delete.
 * - `acordado`: own positions are viewable but frozen (read-only).
 * - Any other state is uncertain territory for this phase — defaults to
 *   read-only rather than silently allowing edits the product hasn't
 *   defined rules for yet.
 */
export function getPositionEligibility(estado: EstadoCaso): PositionEligibility {
  if (estado === 'nuevo') return 'ineligible';
  if (estado === 'activo' || estado === 'en_negociacion') return 'editable';
  if (estado === 'acordado') return 'read_only';
  // 'cerrado' | 'terminado' | 'vencido' — not explicitly specified; default
  // to read-only rather than assume they behave like 'acordado' or 'nuevo'.
  return 'read_only';
}
