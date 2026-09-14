import type { EstadoCaso } from '../../types/case';
import {
  canAddMateria,
  canSetCaseDeadline,
  canTerminateCase,
  deadlinePresetHours,
  toDeadlineIso,
} from '../case-actions';

describe('canTerminateCase', () => {
  it('allows exactly the states the DB trigger allows', () => {
    // `validate_caso_estado_transition()` — cualquier otro origen levanta
    // excepción y el usuario recibe un 409 que no le explica nada.
    expect(canTerminateCase('nuevo')).toBe(true);
    expect(canTerminateCase('pendiente_suscripciones')).toBe(true);
    expect(canTerminateCase('activo')).toBe(true);
    expect(canTerminateCase('en_negociacion')).toBe(true);
  });

  it('refuses every absorbing state', () => {
    // `acordado` sólo puede ir a `cerrado`; el resto no sale a ningún lado.
    for (const estado of ['acordado', 'cerrado', 'terminado', 'vencido', 'expirado'] as EstadoCaso[]) {
      expect(canTerminateCase(estado)).toBe(false);
    }
  });
});

describe('canSetCaseDeadline', () => {
  it('only where there is a counterparty that can actually answer', () => {
    expect(canSetCaseDeadline('activo')).toBe(true);
    expect(canSetCaseDeadline('en_negociacion')).toBe(true);
  });

  it('refuses nuevo — there is nobody the clock would run against', () => {
    expect(canSetCaseDeadline('nuevo')).toBe(false);
  });

  it('refuses pendiente_suscripciones — the other party is blocked, not slow', () => {
    // Ponerle un reloj a alguien que el gate C-01 tiene impedido de actuar es
    // presión sobre algo que no está en sus manos.
    expect(canSetCaseDeadline('pendiente_suscripciones')).toBe(false);
  });

  it('refuses every terminal state', () => {
    for (const estado of ['acordado', 'cerrado', 'terminado', 'vencido', 'expirado'] as EstadoCaso[]) {
      expect(canSetCaseDeadline(estado)).toBe(false);
    }
  });
});

describe('canAddMateria', () => {
  it('allows exactly the states the server accepts for POST /casos/:id/negociaciones', () => {
    for (const estado of ['nuevo', 'activo', 'en_negociacion', 'acordado'] as EstadoCaso[]) {
      expect(canAddMateria(estado)).toBe(true);
    }
  });

  it('excludes pendiente_suscripciones on purpose — the gate C-01, the other party cannot act yet', () => {
    expect(canAddMateria('pendiente_suscripciones')).toBe(false);
  });

  it('excludes every terminal estado', () => {
    for (const estado of ['cerrado', 'terminado', 'vencido', 'expirado'] as EstadoCaso[]) {
      expect(canAddMateria(estado)).toBe(false);
    }
  });
});

describe('toDeadlineIso', () => {
  const now = new Date('2026-09-09T12:00:00.000Z');

  it('turns each preset into an instant that many hours ahead', () => {
    expect(toDeadlineIso(24, now)).toBe('2026-09-10T12:00:00.000Z');
    expect(toDeadlineIso(72, now)).toBe('2026-09-12T12:00:00.000Z');
    expect(toDeadlineIso(168, now)).toBe('2026-09-16T12:00:00.000Z');
  });

  it('every preset lands strictly in the future, which is what the server demands', () => {
    // `assertValidPlazo` rechaza `plazo <= now`, así que un preset de 0 sería
    // un 400 garantizado.
    for (const hours of deadlinePresetHours) {
      expect(Date.parse(toDeadlineIso(hours, now))).toBeGreaterThan(now.getTime());
    }
  });

  it('the presets straddle the semáforo thresholds the server computes', () => {
    // 24 h cae en rojo y 72 h en amarillo (`apps/api/src/casos/semaforo.ts`:
    // `<=` en los dos umbrales), así que elegir tiene una consecuencia visible.
    // Si alguien cambia los presets, esto avisa antes que el usuario.
    expect(deadlinePresetHours).toEqual([24, 72, 168]);
  });
});
