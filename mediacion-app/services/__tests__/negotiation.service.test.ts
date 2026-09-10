import { codeNegociacionNotAcordada } from '../api/api-error';
import { negotiationService } from '../negotiation.service';

/**
 * El mock de `renegotiate` contra el fixture de case-3, que arranca con un
 * acuerdo firmado. Es el único caso del mock que puede renegociarse sin
 * recorrer la negociación entera, y el que la demo usa.
 */
describe('negotiation.service (mock) — negociaciones por materia', () => {
  it('lista una negociacion sin materia por caso, con su acuerdo vigente', async () => {
    const [negotiation, ...rest] = await negotiationService.listNegotiations('case-3');

    expect(rest).toHaveLength(0);
    expect(negotiation.id).toBe('negotiation-case-3');
    // El mock es el modelo viejo, y eso es verdad: sin materia, nunca 'otro'.
    expect(negotiation.subjectType).toBeNull();
    expect(negotiation.estado).toBe('acordada');
    expect(negotiation.currentAgreement).toEqual({ id: 'agreement-case-3-1', estado: 'firmado', version: 1 });
  });

  it('un caso que no existe no tiene negociaciones', async () => {
    await expect(negotiationService.listNegotiations('case-que-no-existe')).resolves.toEqual([]);
  });

  it('renegociar deja un borrador v2 en su lugar, abre la ronda siguiente y reabre el caso', async () => {
    const before = await negotiationService.listNegotiations('case-3');

    const result = await negotiationService.renegotiate('negotiation-case-3');
    const [after] = await negotiationService.listNegotiations('case-3');

    expect(result.negotiationId).toBe('negotiation-case-3');
    expect(result.agreementId).not.toBe('agreement-case-3-1');
    expect(after.currentAgreement).toEqual({ id: result.agreementId, estado: 'borrador', version: 2 });
    expect(after.roundNumber).toBe(before[0].roundNumber + 1);
    expect(after.estado).toBe('activa');
  });

  it('renegociar dos veces seguidas es 409: el vigente ya es un borrador', async () => {
    await expect(negotiationService.renegotiate('negotiation-case-3')).rejects.toThrow(codeNegociacionNotAcordada);
  });

  it('un id que no es de este mock tambien es negociacion_not_acordada, no un crash', async () => {
    await expect(negotiationService.renegotiate('lo-que-sea')).rejects.toThrow(codeNegociacionNotAcordada);
  });
});
