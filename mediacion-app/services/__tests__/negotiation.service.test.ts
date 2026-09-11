import { codeCasoNoNegociable, codeNegociacionMateriaAlreadyExists, codeNegociacionNotAcordada } from '../api/api-error';
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

describe('negotiation.service (mock) — alta de negociaciones', () => {
  it('crea una negociacion nueva heredando el metodo del caso, nunca del llamador', async () => {
    const created = await negotiationService.createNegotiation('case-1', 'bienes');

    expect(created.caseId).toBe('case-1');
    expect(created.subjectType).toBe('bienes');
    expect(created.metodo).toBe('mediacion');
    expect(created.estado).toBe('borrador');
    // `negociaciones.round INT NOT NULL DEFAULT 1` — el alta no crea una
    // fila en `rondas`, así que ya vale 1 sin que exista ninguna ronda.
    expect(created.roundNumber).toBe(1);
    expect(created.currentAgreement).toBeNull();

    const list = await negotiationService.listNegotiations('case-1');
    expect(list.some((negotiation) => negotiation.id === created.id)).toBe(true);
  });

  it('agregar una materia nueva no toca la ronda ni el estado de la legacy', async () => {
    const [legacyBefore] = await negotiationService.listNegotiations('case-1');

    await negotiationService.createNegotiation('case-1', 'alimentos');

    const after = await negotiationService.listNegotiations('case-1');
    const legacyAfter = after.find((negotiation) => negotiation.subjectType === null);
    const materia = after.find((negotiation) => negotiation.subjectType === 'alimentos');

    expect(legacyAfter).toEqual(legacyBefore);
    expect(materia?.roundNumber).toBe(1);
    expect(materia?.estado).toBe('borrador');
  });

  it('la materia repetida es 409 negociacion_materia_already_exists', async () => {
    await negotiationService.createNegotiation('case-1', 'tenencia');
    await expect(negotiationService.createNegotiation('case-1', 'tenencia')).rejects.toThrow(
      codeNegociacionMateriaAlreadyExists,
    );
  });

  it('un caso fuera de nuevo|activo|en_negociacion|acordado es 409 caso_no_negociable', async () => {
    // case-4 del mock esta expirado.
    await expect(negotiationService.createNegotiation('case-4', 'tenencia')).rejects.toThrow(codeCasoNoNegociable);
  });
});
