import type { Plan } from '../types/plan';

/**
 * Mirrors the real seed data 1:1 (`supabase/migrations/20260721191707_seed_catalog.sql`
 * + `20260810120000_cambios_reunion_07_08.sql`'s `estudio` update), including
 * the two coexisting "unlimited" encodings documented in `types/plan.ts`:
 * `plus` still uses the pre-R-10 `-1` sentinel for `limiteCasos` (its row was
 * never touched by the reunión migration), while `estudio` uses the new
 * `null` convention the migration introduced.
 */
export const mockPlans: Plan[] = [
  { id: 'plan-base', nombre: 'base', limiteCarpetas: 3, limiteCasos: 2, limiteIteracionesIa: 5, precio: 0 },
  { id: 'plan-simple', nombre: 'simple', limiteCarpetas: 10, limiteCasos: 5, limiteIteracionesIa: 15, precio: 9.99 },
  { id: 'plan-plus', nombre: 'plus', limiteCarpetas: -1, limiteCasos: -1, limiteIteracionesIa: -1, precio: 19.99 },
  { id: 'plan-estudio', nombre: 'estudio', limiteCarpetas: 0, limiteCasos: null, limiteIteracionesIa: 0, precio: 25.0 },
];
