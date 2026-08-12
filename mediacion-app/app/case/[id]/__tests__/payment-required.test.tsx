import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => ({ id: 'caso-123' }),
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16 }),
}));

// eslint-disable-next-line import/first
import PaymentRequiredScreen from '../payment-required';

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <PaymentRequiredScreen />
    </I18nextProvider>,
  );
}

describe('PaymentRequiredScreen (R-07)', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
  });

  it('explains why access is gated', async () => {
    await renderScreen();
    expect(screen.getByText(i18n.t('billing.paymentRequired.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('billing.paymentRequired.body'))).toBeTruthy();
  });

  it('navigates to the plans screen', async () => {
    await renderScreen();
    fireEvent.press(screen.getByText(i18n.t('billing.paymentRequired.viewPlansAction')));
    expect(mockPush).toHaveBeenCalledWith('/profile/plan');
  });

  it('labels the demo bypass explicitly as demo-only, never a real unlock', async () => {
    await renderScreen();
    expect(screen.getByText(i18n.t('billing.paymentRequired.demoBypass.description'))).toBeTruthy();
  });

  it('the demo bypass replaces into the case for the same caseId', async () => {
    await renderScreen();
    fireEvent.press(screen.getByText(i18n.t('billing.paymentRequired.demoBypass.action')));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/case/[id]', params: { id: 'caso-123' } });
  });
});
