import { render, screen } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';

import i18n from '@/i18n';

import { DesktopTopbar } from '../DesktopTopbar';

let mockProfileResult: {
  status: 'loading' | 'success';
  profile: { nombre: string; apellido: string; rol: 'parte' } | null;
} = { status: 'loading', profile: null };

jest.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: () => mockProfileResult,
}));

function renderTopbar() {
  return render(
    <I18nextProvider i18n={i18n}>
      <DesktopTopbar />
    </I18nextProvider>,
  );
}

describe('DesktopTopbar', () => {
  beforeEach(() => {
    mockProfileResult = { status: 'loading', profile: null };
  });

  it('renders only shared utility chrome while the real profile is loading', async () => {
    await renderTopbar();

    expect(screen.getByText('Mediación')).toBeTruthy();
    expect(screen.queryByText(/Julieta/)).toBeNull();
  });

  it('renders the real profile name and initials when available', async () => {
    mockProfileResult = {
      status: 'success',
      profile: { nombre: 'Julieta', apellido: 'Fernández', rol: 'parte' },
    };
    await renderTopbar();

    expect(screen.getByText('Julieta Fernández')).toBeTruthy();
    expect(screen.getByText('JF')).toBeTruthy();
    expect(screen.getByText(i18n.t('profile.role.parte'))).toBeTruthy();
  });
});
