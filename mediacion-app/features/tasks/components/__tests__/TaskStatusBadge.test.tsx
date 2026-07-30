import { render, screen } from '@testing-library/react-native';

import { TaskStatusBadge } from '../TaskStatusBadge';

describe('TaskStatusBadge', () => {
  it('renders the label for pendiente', async () => {
    await render(<TaskStatusBadge status="pendiente" label="Pending" />);
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('renders the label for en_progreso', async () => {
    await render(<TaskStatusBadge status="en_progreso" label="In progress" />);
    expect(screen.getByText('In progress')).toBeTruthy();
  });

  it('renders the label for completada', async () => {
    await render(<TaskStatusBadge status="completada" label="Completed" />);
    expect(screen.getByText('Completed')).toBeTruthy();
  });
});
