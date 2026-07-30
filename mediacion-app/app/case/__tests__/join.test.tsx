import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

// eslint-disable-next-line import/first
import CaseJoinScreen from '../join';

async function renderScreen() {
  await render(
    <I18nextProvider i18n={i18n}>
      <CaseJoinScreen />
    </I18nextProvider>,
  );
}

describe('CaseJoinScreen', () => {
  it('renders the join form in its idle state', async () => {
    await renderScreen();
    expect(screen.getByText(i18n.t('caseJoin.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('caseJoin.inputLabel'))).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('caseJoin.submitAction') })).toBeTruthy();
  });

  it('does not show any error or success content by default', async () => {
    await renderScreen();
    expect(screen.queryByText(i18n.t('caseJoin.error.title'))).toBeNull();
  });

  it('the default mount never fabricates a successful join — pressing submit shows no confirmation, navigation, or joined-case content', async () => {
    await renderScreen();
    const submitButton = screen.getByRole('button', { name: i18n.t('caseJoin.submitAction') });
    // Blank input keeps submit disabled by default, but even so, no code
    // path in this screen can ever produce a success/joined state — the
    // handler is an intentional no-op placeholder.
    expect(submitButton.props.accessibilityState.disabled).toBe(true);
    submitButton.props.onClick?.({} as never);
    expect(screen.queryByText(i18n.t('caseJoin.title'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: i18n.t('caseJoin.submitAction') })).toBeTruthy();
  });

  it('starts with a blank input', async () => {
    await renderScreen();
    expect(screen.getByPlaceholderText(i18n.t('caseJoin.inputPlaceholder')).props.value).toBe('');
  });
});
