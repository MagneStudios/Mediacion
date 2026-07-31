import { render, screen } from '@testing-library/react-native';

import { WaitingForPartyState } from '../WaitingForPartyState';

describe('WaitingForPartyState', () => {
  it('renders both title and description as visible text (not color/icon-only)', async () => {
    await render(<WaitingForPartyState title="Esperando a la otra parte" description="Ya respondiste." />);
    expect(screen.getByText('Esperando a la otra parte')).toBeTruthy();
    expect(screen.getByText('Ya respondiste.')).toBeTruthy();
  });

  it('exposes a combined accessible label for screen readers', async () => {
    await render(<WaitingForPartyState title="Title" description="Description" />);
    expect(screen.getByLabelText('Title. Description')).toBeTruthy();
  });
});
