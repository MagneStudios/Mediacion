import { render, screen } from '@testing-library/react-native';

import { CaseSummaryBar } from '../CaseSummaryBar';

describe('CaseSummaryBar', () => {
  it('renders exactly the numbers it is given — no derived/invented metric of its own', async () => {
    await render(<CaseSummaryBar total={4} totalLabel="Casos" pendingResponse={1} pendingResponseLabel="Esperan tu respuesta" />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Casos')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('Esperan tu respuesta')).toBeTruthy();
  });

  it('renders zero pending responses correctly (not hidden, not blank)', async () => {
    await render(<CaseSummaryBar total={2} totalLabel="Casos" pendingResponse={0} pendingResponseLabel="Esperan tu respuesta" />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});
