import { render } from '@testing-library/react-native';

let mockSearchParams: { token?: string } = {};
const mockRedirectProps = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams,
  // A real <Redirect> needs a navigation container mounted around it; this
  // screen's only job is choosing what href to redirect to, so the test
  // captures that decision instead of exercising expo-router's own
  // navigation, already covered elsewhere.
  Redirect: (props: unknown) => {
    mockRedirectProps(props);
    return null;
  },
}));

// eslint-disable-next-line import/first
import InvitationDeepLinkScreen from '../[token]';

describe('InvitationDeepLinkScreen', () => {
  beforeEach(() => {
    mockRedirectProps.mockReset();
    mockSearchParams = {};
  });

  it('reconstructs the full mediacionapp:// link and forwards it as /case/join?token=', async () => {
    mockSearchParams = { token: 'mock-abc123' };
    await render(<InvitationDeepLinkScreen />);

    expect(mockRedirectProps).toHaveBeenCalledWith({
      href: {
        pathname: '/case/join',
        params: { token: 'mediacionapp://invitacion/mock-abc123' },
      },
    });
  });

  it('forwards an empty token rather than throwing when the segment is missing', async () => {
    await render(<InvitationDeepLinkScreen />);

    expect(mockRedirectProps).toHaveBeenCalledWith({
      href: { pathname: '/case/join', params: { token: '' } },
    });
  });
});
