import { toNegotiation, type ApiNegociacion } from '../negotiation-mapper';

function row(overrides: Partial<ApiNegociacion> = {}): ApiNegociacion {
  return {
    id: 'neg-1',
    caso_id: 'caso-1',
    subject_type: 'tenencia',
    metodo: 'mediacion',
    estado: 'activa',
    ronda_actual: 2,
    acuerdo_vigente: { id: 'acu-1', estado: 'firmado', version: 1 },
    created_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toNegotiation', () => {
  it('maps the three server-side aliases to the domain names', () => {
    expect(toNegotiation(row())).toEqual({
      id: 'neg-1',
      caseId: 'caso-1',
      subjectType: 'tenencia',
      metodo: 'mediacion',
      estado: 'activa',
      roundNumber: 2,
      currentAgreement: { id: 'acu-1', estado: 'firmado', version: 1 },
      createdAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('keeps subject_type null as null — the legacy model, never "otro"', () => {
    expect(toNegotiation(row({ subject_type: null })).subjectType).toBeNull();
  });

  it('keeps acuerdo_vigente null as null — never an empty object', () => {
    // "No agreement" and "an agreement in draft" draw different buttons; an
    // empty object would read as the second.
    expect(toNegotiation(row({ acuerdo_vigente: null })).currentAgreement).toBeNull();
  });

  it('does not carry anything the wire did not send', () => {
    expect(toNegotiation(row())).not.toHaveProperty('materia');
    expect(toNegotiation(row())).not.toHaveProperty('round');
  });
});
