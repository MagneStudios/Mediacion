import {
  toNegotiation,
  toNegotiationRound,
  toSharedProposal,
  type ApiNegociacion,
  type ApiPropuestaDetail,
} from '../negotiation-mapper';

function propuestaRow(overrides: Partial<ApiPropuestaDetail> = {}): ApiPropuestaDetail {
  return {
    id: 'prop-1',
    caso_id: 'caso-1',
    ronda_id: 'ronda-1',
    contenido: { meetingPoint: [], narrative: 'texto' },
    fundamentacion: null,
    estado: 'pendiente',
    modelo_ia: null,
    fecha: '2026-09-01T00:00:00.000Z',
    ronda_numero: 1,
    ronda_estado: 'activa',
    own_decision: null,
    negociacion_id: 'neg-tenencia',
    ...overrides,
  };
}

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

describe('toNegotiationRound / toSharedProposal — negociacion_id', () => {
  it('carries negociacion_id through as negotiationId on the round', () => {
    expect(toNegotiationRound(propuestaRow()).negotiationId).toBe('neg-tenencia');
  });

  it('carries negociacion_id through as negotiationId on the proposal', () => {
    expect(toSharedProposal(propuestaRow(), 1).negotiationId).toBe('neg-tenencia');
  });
});
