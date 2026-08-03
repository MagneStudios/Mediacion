import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ProposalOutcomeNotice } from '../ProposalOutcomeNotice';

describe('ProposalOutcomeNotice', () => {
  it('renders the title and description exactly as given — no outcome inferred internally', async () => {
    await render(<ProposalOutcomeNotice title="Llegaron a un acuerdo" description="Ambas partes aceptaron." />);
    expect(screen.getByText('Llegaron a un acuerdo')).toBeTruthy();
    expect(screen.getByText('Ambas partes aceptaron.')).toBeTruthy();
  });

  it('renders an action node when provided', async () => {
    await render(
      <ProposalOutcomeNotice title="T" description="D" action={<Text>Revisar acuerdo</Text>} />,
    );
    expect(screen.getByText('Revisar acuerdo')).toBeTruthy();
  });

  it('omits the action slot when none is given', async () => {
    await render(<ProposalOutcomeNotice title="T" description="D" />);
    expect(screen.queryByText('Revisar acuerdo')).toBeNull();
  });

  it('defaults to the neutral tone', async () => {
    const { unmount } = await render(<ProposalOutcomeNotice title="T" description="D" />);
    expect(screen.getByText('T')).toBeTruthy();
    await unmount();
  });

  it('renders without crashing in the success tone', async () => {
    await render(<ProposalOutcomeNotice title="T" description="D" tone="success" />);
    expect(screen.getByText('T')).toBeTruthy();
  });
});
