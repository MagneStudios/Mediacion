import {
  toCaseCode,
  toCaseDetail,
  toCaseSummary,
  toCounterpartyName,
  toSlaHours,
  toStatusLabelKey,
  toVisualStatus,
  type ApiCaseDetail,
  type ApiCaseSummary,
} from '../case-mapper';

const now = new Date('2026-07-24T12:00:00.000Z');

function apiSummary(overrides: Partial<ApiCaseSummary> = {}): ApiCaseSummary {
  return {
    id: 'a1b2c3d4-0000-0000-0000-000000000000',
    nombre: 'Divorcio',
    estado: 'activo',
    metodo: 'mediacion',
    created_at: '2026-07-01T00:00:00.000Z',
    plazo: null,
    sla_tipo: null,
    ronda_actual: 1,
    semaforo: null,
    contraparte: null,
    ...overrides,
  };
}

describe('toVisualStatus', () => {
  it.each([
    ['verde', 'success'],
    ['amarillo', 'warning'],
    ['rojo', 'error'],
  ] as const)('maps %s to %s', (semaforo, expected) => {
    expect(toVisualStatus(semaforo)).toBe(expected);
  });

  it('maps an absent semaforo to neutral, never to success', () => {
    expect(toVisualStatus(null)).toBe('neutral');
  });
});

describe('toSlaHours', () => {
  it('floors the hours remaining until the plazo', () => {
    expect(toSlaHours('2026-07-25T02:30:00.000Z', now)).toBe(14);
  });

  it('returns null when there is no plazo', () => {
    expect(toSlaHours(null, now)).toBeNull();
  });

  it('clamps an overdue plazo to zero instead of going negative', () => {
    expect(toSlaHours('2026-07-20T12:00:00.000Z', now)).toBe(0);
  });

  it('returns null for an unparseable plazo rather than NaN', () => {
    expect(toSlaHours('not-a-date', now)).toBeNull();
  });
});

describe('toStatusLabelKey', () => {
  it('reports awaitingCounterparty while nobody has joined, whatever the estado', () => {
    expect(toStatusLabelKey('en_negociacion', false)).toBe('awaitingCounterparty');
  });

  it('reports proposalReady once negotiating with a counterparty', () => {
    expect(toStatusLabelKey('en_negociacion', true)).toBe('proposalReady');
  });

  it.each(['acordado', 'cerrado', 'terminado'] as const)(
    'reports signed for %s',
    (estado) => {
      expect(toStatusLabelKey(estado, true)).toBe('signed');
    },
  );

  it('falls back to inReview for an active case', () => {
    expect(toStatusLabelKey('activo', true)).toBe('inReview');
  });
});

describe('toCounterpartyName', () => {
  it('joins nombre and apellido', () => {
    expect(
      toCounterpartyName({
        usuario_id: 'u2',
        rol_en_caso: 'parte_b',
        nombre: 'Ana',
        apellido: 'Perez',
      }),
    ).toBe('Ana Perez');
  });

  it('is null while the other party has not joined', () => {
    expect(toCounterpartyName(null)).toBeNull();
  });
});

describe('toCaseSummary', () => {
  it('maps the api row onto the shape the dashboard renders', () => {
    const summary = toCaseSummary(
      apiSummary({
        plazo: '2026-07-25T12:00:00.000Z',
        semaforo: 'rojo',
        ronda_actual: 3,
        contraparte: {
          usuario_id: 'u2',
          rol_en_caso: 'parte_b',
          nombre: 'Ana',
          apellido: 'Perez',
        },
      }),
      now,
    );

    expect(summary).toEqual({
      id: 'a1b2c3d4-0000-0000-0000-000000000000',
      title: 'Divorcio',
      counterpartyName: 'Ana Perez',
      estado: 'activo',
      metodo: 'mediacion',
      roundNumber: 3,
      visualStatus: 'error',
      statusLabelKey: 'inReview',
      slaHours: 24,
    });
  });
});

describe('toCaseCode', () => {
  it('derives a stable code from the id, so every client shows the same one', () => {
    const code = toCaseCode('a1b2c3d4-0000-0000-0000-000000000000', '2026-07-01T00:00:00.000Z');

    expect(code).toBe('CASO-2026-A1B2');
    expect(toCaseCode('a1b2c3d4-0000-0000-0000-000000000000', '2026-07-01T00:00:00.000Z')).toBe(
      code,
    );
  });

  it('degrades to a placeholder year when created_at is unusable', () => {
    expect(toCaseCode('a1b2c3d4', 'not-a-date')).toBe('CASO-0000-A1B2');
  });
});

describe('toCaseDetail', () => {
  it('adds the case code and maps a null descripcion to undefined', () => {
    const detail = toCaseDetail(
      { ...apiSummary(), descripcion: null, creador_id: 'u1', updated_at: 'x' } as ApiCaseDetail,
      now,
    );

    expect(detail.caseCode).toBe('CASO-2026-A1B2');
    expect(detail.descripcion).toBeUndefined();
  });
});
