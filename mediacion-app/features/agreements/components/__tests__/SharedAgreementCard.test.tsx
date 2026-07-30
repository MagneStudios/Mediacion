import { render, screen } from '@testing-library/react-native';

import { SharedAgreementCard } from '../SharedAgreementCard';

describe('SharedAgreementCard', () => {
  const baseProps = {
    title: 'Cuota de alimentos acordada',
    summary: 'Un esquema de aportes mensuales con actualización periódica.',
    terms: [
      { id: 't-1', title: 'Aporte mensual fijo', description: 'Monto fijo con fecha de pago acordada.' },
      { id: 't-2', title: 'Actualización anual', description: 'Se actualiza según un índice de referencia.' },
    ],
    rationale: 'Da previsibilidad a ambas partes durante todo el año.',
    rationaleLabel: 'Fundamentación',
    statusLabel: 'Firmado',
    statusVisual: 'success' as const,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    function titleEl(): any {
      return screen.getByText('Cuota de alimentos acordada');
    }

    it('renders the title with header semantics', async () => {
      await render(<SharedAgreementCard {...baseProps} />);
      expect(titleEl().props.accessibilityRole).toBe('header');
    });

    it('allows the title to wrap across two lines at narrow widths', async () => {
      await render(<SharedAgreementCard {...baseProps} />);
      expect(titleEl().props.numberOfLines).toBe(2);
    });

    it('renders the summary text', async () => {
      await render(<SharedAgreementCard {...baseProps} />);
      expect(screen.getByText('Un esquema de aportes mensuales con actualización periódica.')).toBeTruthy();
    });

    it('renders every agreement term', async () => {
      await render(<SharedAgreementCard {...baseProps} />);
      expect(screen.getByText('Aporte mensual fijo')).toBeTruthy();
      expect(screen.getByText('Monto fijo con fecha de pago acordada.')).toBeTruthy();
      expect(screen.getByText('Actualización anual')).toBeTruthy();
      expect(screen.getByText('Se actualiza según un índice de referencia.')).toBeTruthy();
    });

    it('renders the rationale when provided', async () => {
      await render(<SharedAgreementCard {...baseProps} />);
      expect(screen.getByText('Fundamentación')).toBeTruthy();
      expect(screen.getByText('Da previsibilidad a ambas partes durante todo el año.')).toBeTruthy();
    });

    it('omits the rationale section when rationale is absent', async () => {
      await render(<SharedAgreementCard {...baseProps} rationale={undefined} />);
      expect(screen.queryByText('Fundamentación')).toBeNull();
    });

    it('renders the status pill with the correct label', async () => {
      await render(<SharedAgreementCard {...baseProps} />);
      expect(screen.getByText('Firmado')).toBeTruthy();
    });
  });

  describe('layout — narrow-width title wrapping', () => {
    function titleStyle(): Record<string, unknown> {
      return screen.getByText('Cuota de alimentos acordada').props.style;
    }

    it('uses flexShrink without flexGrow so the header can wrap on narrow widths', async () => {
      await render(<SharedAgreementCard {...baseProps} />);
      const style = titleStyle();
      expect(style.flexShrink).toBe(1);
      expect(style.flexGrow).toBeUndefined();
      expect(style.flex).toBeUndefined();
    });

    it('allows the title to take two lines if needed', async () => {
      await render(<SharedAgreementCard {...baseProps} />);
      expect(titleStyle().numberOfLines).toBeUndefined();
      // numberOfLines is a Text prop, not in the style object — check the element prop directly
      const titleEl = screen.getByText('Cuota de alimentos acordada');
      expect(titleEl.props.numberOfLines).toBe(2);
    });

    it('status pill is a sibling of the title in the header row', async () => {
      await render(<SharedAgreementCard {...baseProps} />);
      expect(screen.getByText('Cuota de alimentos acordada')).toBeTruthy();
      expect(screen.getByText('Firmado')).toBeTruthy();
    });
  });

  describe('empty / edge states', () => {
    it('renders an empty terms list without crashing', async () => {
      await render(<SharedAgreementCard {...baseProps} terms={[]} />);
      expect(screen.getByText('Cuota de alimentos acordada')).toBeTruthy();
      expect(screen.getByText('Un esquema de aportes mensuales con actualización periódica.')).toBeTruthy();
    });

    it('renders with a neutral status visual', async () => {
      await render(
        <SharedAgreementCard {...baseProps} statusLabel="Borrador" statusVisual="neutral" />,
      );
      expect(screen.getByText('Borrador')).toBeTruthy();
    });

    it('renders with a warning status visual', async () => {
      await render(
        <SharedAgreementCard {...baseProps} statusLabel="Con aviso" statusVisual="warning" />,
      );
      expect(screen.getByText('Con aviso')).toBeTruthy();
    });
  });
});
