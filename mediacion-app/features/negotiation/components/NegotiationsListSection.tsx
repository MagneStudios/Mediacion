import { Fragment } from 'react';

import type { EstadoCaso } from '../../../types/case';
import { AgreementSummaryCard } from '../../agreements/components/AgreementSummaryCard';
import { NegotiationSummaryCard } from './NegotiationSummaryCard';

/**
 * Una negociación del caso: su tarjeta de estado y, si ya produjo uno, su
 * acuerdo.
 *
 * **Hoy siempre hay exactamente una** — `rondas` cuelga del caso, `casos.
 * ronda_actual` es un contador escalar, y `acuerdos` tiene `UNIQUE (caso_id)`
 * declarado con el comentario *"un caso solo puede tener un acuerdo"*. Por eso
 * la entrada se identifica por `caseId` y no por un id propio: **no existe un
 * identificador de negociación**, y fabricar uno para que el tipo se vea más
 * definitivo sería inventar un dato que después viaja a params de ruta.
 *
 * Cuando DB entregue el modelo (`docs/pedidos-frontend-acuerdos-modulares.md`
 * §2.3), esta entrada gana `id` y `materia`, y la pantalla que la consume no
 * se toca.
 */
export type NegotiationListEntry = {
  caseId: string;
  /**
   * Si esta negociación tiene un acuerdo que mostrar. Hoy se deriva del estado
   * del caso, que es el único dato disponible; con N materias va a ser una
   * propiedad de cada negociación.
   */
  hasAgreement: boolean;
};

export type NegotiationsListSectionProps = {
  caseId: string;
  estado: EstadoCaso;
};

/**
 * Las negociaciones del caso, en lista.
 *
 * Existe para que el detalle del caso deje de cablear "la negociación" y "el
 * acuerdo" en singular. Es una costura, no una feature: **con una entrada se
 * ve exactamente igual que antes**, y el día que el backend devuelva tres el
 * `.map()` ya está.
 *
 * El gate `estado === 'acordado'` vivía suelto en `CaseDetailScreen` y es una
 * de las cosas que se rompen con materias —una sola aceptación pone el caso
 * entero en `acordado`, así que firmar tenencia apagaría alimentos—. Acá al
 * menos queda en un solo lugar, marcado, en vez de repartido por la pantalla.
 */
export function NegotiationsListSection({ caseId, estado }: NegotiationsListSectionProps) {
  const negotiations: NegotiationListEntry[] = [
    // La única que el modelo actual puede describir. No es un placeholder: es
    // literalmente la negociación del caso, la misma que se venía dibujando.
    { caseId, hasAgreement: estado === 'acordado' },
  ];

  return (
    <>
      {negotiations.map((negotiation) => (
        <Fragment key={negotiation.caseId}>
          <NegotiationSummaryCard caseId={negotiation.caseId} />
          {negotiation.hasAgreement ? <AgreementSummaryCard caseId={negotiation.caseId} /> : null}
        </Fragment>
      ))}
    </>
  );
}
