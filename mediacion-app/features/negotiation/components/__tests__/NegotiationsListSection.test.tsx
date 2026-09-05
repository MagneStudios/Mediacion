import { render, screen } from '@testing-library/react-native';

jest.mock('../NegotiationSummaryCard', () => {
  const { Text } = require('react-native');
  return {
    NegotiationSummaryCard: ({ caseId }: { caseId: string }) => (
      <Text>{`negotiation:${caseId}`}</Text>
    ),
  };
});

jest.mock('../../../agreements/components/AgreementSummaryCard', () => {
  const { Text } = require('react-native');
  return {
    AgreementSummaryCard: ({ caseId }: { caseId: string }) => (
      <Text>{`agreement:${caseId}`}</Text>
    ),
  };
});

// eslint-disable-next-line import/first
import { NegotiationsListSection } from '../NegotiationsListSection';

describe('NegotiationsListSection', () => {
  it('dibuja la negociacion del caso', async () => {
    await render(<NegotiationsListSection caseId="case-1" estado="en_negociacion" />);
    expect(screen.getByText('negotiation:case-1')).toBeTruthy();
  });

  it('no muestra acuerdo mientras el caso no llego a acordado', async () => {
    // Sin esto, cada caso sin acuerdo mostraria una tarjeta "Acuerdo: no
    // disponible" que hoy no se dibuja.
    await render(<NegotiationsListSection caseId="case-1" estado="en_negociacion" />);
    expect(screen.queryByText('agreement:case-1')).toBeNull();
  });

  it('muestra el acuerdo cuando el caso esta acordado', async () => {
    await render(<NegotiationsListSection caseId="case-1" estado="acordado" />);
    expect(screen.getByText('agreement:case-1')).toBeTruthy();
  });

  it('no dibuja acuerdo en pendiente_suscripciones', async () => {
    // C-01: el caso ni siquiera pudo activarse, asi que no hay nada firmado.
    await render(<NegotiationsListSection caseId="case-1" estado="pendiente_suscripciones" />);
    expect(screen.getByText('negotiation:case-1')).toBeTruthy();
    expect(screen.queryByText('agreement:case-1')).toBeNull();
  });
});
