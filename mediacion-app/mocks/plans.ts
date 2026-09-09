import type { Plan } from '../types/plan';

/**
 * Mirrors the real seed data 1:1 — `20260721191707_seed_catalog.sql`, then
 * `20260810120000_cambios_reunion_07_08.sql`'s `estudio` update, then
 * `20260821120000_monetizacion_fase1.sql:283-296`, which is what added
 * `particular` and `corporativo` and filled the two period quotas.
 *
 * Two things this mirrors on purpose, because both are real and both are
 * currently unresolved product decisions:
 *
 * 1. **The two coexisting "unlimited" encodings** documented in `types/plan.ts`:
 *    `plus` still uses the pre-R-10 `-1` sentinel for `limiteCasos` (its row was
 *    never touched by the reunión migration), while `estudio` uses the `null`
 *    convention that migration introduced. Both period quotas use `null`.
 *
 * 2. **Six plans, three of them from a pricing model that no longer exists.**
 *    DB's decision on 21/08 was "aditivo puro": the legacy rows stayed. There is
 *    no `activo` column and `GET /planes` takes no filter, so Mi plan lists all
 *    six — and `corporativo`, which is meant to read "a consultar", is
 *    indistinguishable from the free `base` because its `precio` is also
 *    `0.00`. Those are §1.2 and §1.3 of `docs/plan-frontend-monetizacion.md`,
 *    both open on the DB/Producto side. Keeping the mock honest is what makes
 *    them visible here instead of only against a live database.
 */
export const mockPlans: Plan[] = [
  { id: 'plan-base', nombre: 'base', limiteCarpetas: 3, limiteCasos: 2, limiteIteracionesIa: 5, precio: 0, moneda: 'ARS', maxNegotiationsPerPeriod: null, maxClientsPerPeriod: null },
  { id: 'plan-simple', nombre: 'simple', limiteCarpetas: 10, limiteCasos: 5, limiteIteracionesIa: 15, precio: 9.99, moneda: 'ARS', maxNegotiationsPerPeriod: null, maxClientsPerPeriod: null },
  { id: 'plan-plus', nombre: 'plus', limiteCarpetas: -1, limiteCasos: -1, limiteIteracionesIa: -1, precio: 19.99, moneda: 'ARS', maxNegotiationsPerPeriod: null, maxClientsPerPeriod: null },
  { id: 'plan-estudio', nombre: 'estudio', limiteCarpetas: 0, limiteCasos: null, limiteIteracionesIa: 0, precio: 25.0, moneda: 'ARS', maxNegotiationsPerPeriod: 3, maxClientsPerPeriod: 20 },
  { id: 'plan-particular', nombre: 'particular', limiteCarpetas: 1, limiteCasos: null, limiteIteracionesIa: 5, precio: 19.9, moneda: 'ARS', maxNegotiationsPerPeriod: 3, maxClientsPerPeriod: null },
  { id: 'plan-corporativo', nombre: 'corporativo', limiteCarpetas: -1, limiteCasos: null, limiteIteracionesIa: -1, precio: 0, moneda: 'ARS', maxNegotiationsPerPeriod: null, maxClientsPerPeriod: null },
];
