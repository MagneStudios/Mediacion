import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ResponsiveAppShell } from '../ResponsiveAppShell';

let mockShowDesktopSidebar = false;

function mockDesktopSidebar() {
  return <Text>desktop-sidebar</Text>;
}

function mockDesktopTopbar() {
  return <Text>desktop-topbar</Text>;
}

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ showDesktopSidebar: mockShowDesktopSidebar }),
}));

jest.mock('../DesktopSidebar', () => ({
  DesktopSidebar: mockDesktopSidebar,
}));

jest.mock('../DesktopTopbar', () => ({
  DesktopTopbar: mockDesktopTopbar,
}));

describe('ResponsiveAppShell', () => {
  beforeEach(() => {
    mockShowDesktopSidebar = false;
  });

  it('keeps the mobile shell transparent and does not render desktop chrome', async () => {
    await render(
      <ResponsiveAppShell>
        <Text>route-content</Text>
      </ResponsiveAppShell>,
    );

    expect(screen.getByText('route-content')).toBeTruthy();
    expect(screen.queryByText('desktop-sidebar')).toBeNull();
    expect(screen.queryByText('desktop-topbar')).toBeNull();
  });

  it('renders the shared sidebar and topbar for wide authenticated web routes', async () => {
    mockShowDesktopSidebar = true;
    await render(
      <ResponsiveAppShell>
        <Text>route-content</Text>
      </ResponsiveAppShell>,
    );

    expect(screen.getByText('desktop-sidebar')).toBeTruthy();
    expect(screen.getByText('desktop-topbar')).toBeTruthy();
    expect(screen.getByText('route-content')).toBeTruthy();
  });
});
