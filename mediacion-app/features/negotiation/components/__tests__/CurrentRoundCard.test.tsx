import { render, screen } from '@testing-library/react-native';

import { CurrentRoundCard } from '../CurrentRoundCard';

describe('CurrentRoundCard', () => {
  it('renders the round label as a header and the status label', async () => {
    await render(<CurrentRoundCard roundLabel="Ronda 2" statusLabel="En curso" statusVisual="info" />);
    expect(screen.getByRole('header').props.children).toBe('Ronda 2');
    expect(screen.getByText('En curso')).toBeTruthy();
  });

  it('has no press action of its own (display only)', async () => {
    await render(<CurrentRoundCard roundLabel="Ronda 2" statusLabel="En curso" statusVisual="info" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
