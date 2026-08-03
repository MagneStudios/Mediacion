import { fireEvent, render, screen } from '@testing-library/react-native';

import { ProfileMenuItem } from '../ProfileMenuItem';

describe('ProfileMenuItem', () => {
  it('renders the dashboard (desktop) variant by default — compact omitted', async () => {
    await render(<ProfileMenuItem icon="pencil" label="Editar perfil" description="Actualizá tus datos" onPress={jest.fn()} />);
    expect(screen.getByText('Editar perfil')).toBeTruthy();
    expect(screen.getByText('Actualizá tus datos')).toBeTruthy();
  });

  it('renders the compact (mobile) variant when compact is true', async () => {
    await render(<ProfileMenuItem icon="pencil" label="Editar perfil" description="Actualizá tus datos" onPress={jest.fn()} compact />);
    expect(screen.getByText('Editar perfil')).toBeTruthy();
    expect(screen.getByText('Actualizá tus datos')).toBeTruthy();
  });

  it('calls onPress on the dashboard variant', async () => {
    const onPress = jest.fn();
    await render(<ProfileMenuItem icon="pencil" label="Editar perfil" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Editar perfil' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onPress on the compact variant', async () => {
    const onPress = jest.fn();
    await render(<ProfileMenuItem icon="pencil" label="Editar perfil" onPress={onPress} compact />);
    await fireEvent.press(screen.getByRole('button', { name: 'Editar perfil' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders exactly one button role — no nested Pressable-in-Pressable — on the dashboard variant', async () => {
    await render(<ProfileMenuItem icon="pencil" label="Editar perfil" description="Actualizá tus datos" onPress={jest.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('renders exactly one button role — no nested Pressable-in-Pressable — on the compact variant', async () => {
    await render(<ProfileMenuItem icon="pencil" label="Editar perfil" description="Actualizá tus datos" onPress={jest.fn()} compact />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('falls back to the label as the accessible name when accessibilityLabel is not provided', async () => {
    await render(<ProfileMenuItem icon="bell" label="Notificaciones" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeTruthy();
  });

  it('prefers an explicit accessibilityLabel over the visible label', async () => {
    await render(
      <ProfileMenuItem icon="bell" label="Notificaciones" accessibilityLabel="Ir a notificaciones" onPress={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Ir a notificaciones' })).toBeTruthy();
  });
});
