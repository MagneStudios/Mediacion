import { I18nextProvider } from 'react-i18next';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import i18n from '@/i18n';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

const mockJoinCase = jest.fn();
jest.mock('@/services/cases.service', () => ({
  casesService: { joinCase: (...args: unknown[]) => mockJoinCase(...args) },
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

function input() {
  return screen.getByPlaceholderText(i18n.t('caseJoin.inputPlaceholder'));
}

function submit() {
  return screen.getByRole('button', { name: i18n.t('caseJoin.submitAction') });
}

describe('CaseJoinScreen', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockJoinCase.mockReset();
  });

  it('renders the join form in its idle state', async () => {
    await renderScreen();
    expect(screen.getByText(i18n.t('caseJoin.title'))).toBeTruthy();
    expect(screen.getByText(i18n.t('caseJoin.inputLabel'))).toBeTruthy();
    expect(submit()).toBeTruthy();
  });

  it('starts with a blank input, no error, and submit disabled', async () => {
    await renderScreen();
    expect(input().props.value).toBe('');
    expect(screen.queryByText(i18n.t('caseJoin.error.title'))).toBeNull();
    expect(submit().props.accessibilityState.disabled).toBe(true);
  });

  it('redeems the code and navigates to the joined case', async () => {
    mockJoinCase.mockResolvedValue({ id: 'caso-123', estado: 'activo', requiresPayment: false });
    await renderScreen();

    await fireEvent.changeText(input(), 'TOKEN-ABC');
    await fireEvent.press(submit());

    await waitFor(() => expect(mockJoinCase).toHaveBeenCalledWith('TOKEN-ABC'));
    // replace, not push: the token is spent, so returning to this screen could
    // only fail.
    expect(mockReplace).toHaveBeenCalledWith('/case/caso-123');
  });

  it('R-07: navigates to the payment-required gate instead of the case when the invitation put the payment on the joining party', async () => {
    mockJoinCase.mockResolvedValue({ id: 'caso-123', estado: 'activo', requiresPayment: true });
    await renderScreen();

    await fireEvent.changeText(input(), 'TOKEN-ABC');
    await fireEvent.press(submit());

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/case/caso-123/payment-required'));
  });

  it('shows the error state when redemption is rejected, and never navigates', async () => {
    mockJoinCase.mockRejectedValue(new Error('invitation_not_found'));
    await renderScreen();

    await fireEvent.changeText(input(), 'WRONG');
    await fireEvent.press(submit());

    await waitFor(() => expect(screen.getByText(i18n.t('caseJoin.error.title'))).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the expired state, not the generic error, when the token is a known-expired invitation', async () => {
    mockJoinCase.mockRejectedValue(new Error('invitation_expired'));
    await renderScreen();

    await fireEvent.changeText(input(), 'EXPIRA-DEMO');
    await fireEvent.press(submit());

    await waitFor(() => expect(screen.getByText(i18n.t('caseJoin.expired.title'))).toBeTruthy());
    expect(screen.queryByText(i18n.t('caseJoin.error.title'))).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  describe('C-01: el gate de suscripciones', () => {
    it('se muestra como lo que es, no como un codigo invalido', async () => {
      // El 409 del gate caia en el error generico, que dice "revisa el enlace
      // o codigo" — sobre un codigo que esta perfecto. Es la causa de que al
      // cliente "no le funcione la aceptacion".
      mockJoinCase.mockRejectedValue(new Error('caso_bloqueado_suscripciones'));
      await renderScreen();

      await fireEvent.changeText(input(), 'TOKEN-OK');
      await fireEvent.press(submit());

      await waitFor(() =>
        expect(screen.getByText(i18n.t('caseJoin.subscriptionRequired.title'))).toBeTruthy(),
      );
      expect(screen.queryByText(i18n.t('caseJoin.error.title'))).toBeNull();
      expect(screen.queryByText(i18n.t('caseJoin.expired.title'))).toBeNull();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('ofrece ir a planes en vez de reintentar', async () => {
      // Reenviar el mismo codigo valido vuelve a chocar contra el mismo gate:
      // la accion util es suscribirse, no reintentar.
      mockJoinCase.mockRejectedValue(new Error('caso_bloqueado_suscripciones'));
      await renderScreen();

      await fireEvent.changeText(input(), 'TOKEN-OK');
      await fireEvent.press(submit());

      const action = await screen.findByText(i18n.t('caseJoin.subscriptionRequired.action'));
      await fireEvent.press(action);

      expect(mockPush).toHaveBeenCalledWith('/profile/plan');
      expect(mockJoinCase).toHaveBeenCalledTimes(1);
    });

    it('no borra el aviso cuando se edita el codigo', async () => {
      // A diferencia del error generico y del vencido: el codigo no es el
      // problema, asi que limpiar el aviso mientras se lo edita esconde la
      // unica explicacion de por que no pudo entrar.
      mockJoinCase.mockRejectedValue(new Error('caso_bloqueado_suscripciones'));
      await renderScreen();

      await fireEvent.changeText(input(), 'TOKEN-OK');
      await fireEvent.press(submit());
      await screen.findByText(i18n.t('caseJoin.subscriptionRequired.title'));

      await fireEvent.changeText(input(), 'TOKEN-OK-EDITADO');
      expect(screen.getByText(i18n.t('caseJoin.subscriptionRequired.title'))).toBeTruthy();
    });
  });

  it('clears a previous error as soon as the code is edited', async () => {
    mockJoinCase.mockRejectedValue(new Error('invitation_not_found'));
    await renderScreen();

    await fireEvent.changeText(input(), 'WRONG');
    await fireEvent.press(submit());
    await waitFor(() => expect(screen.getByText(i18n.t('caseJoin.error.title'))).toBeTruthy());

    await fireEvent.changeText(input(), 'WRONG-CORRECTED');
    expect(screen.queryByText(i18n.t('caseJoin.error.title'))).toBeNull();
  });

  it('clears a previous expired state as soon as the code is edited', async () => {
    mockJoinCase.mockRejectedValue(new Error('invitation_expired'));
    await renderScreen();

    await fireEvent.changeText(input(), 'EXPIRA-DEMO');
    await fireEvent.press(submit());
    await waitFor(() => expect(screen.getByText(i18n.t('caseJoin.expired.title'))).toBeTruthy());

    await fireEvent.changeText(input(), 'EXPIRA-DEMO-CORRECTED');
    expect(screen.queryByText(i18n.t('caseJoin.expired.title'))).toBeNull();
  });

  // Double submission is not asserted here on purpose. Holding the screen in
  // `submitting` needs a promise that stays pending across two presses, and
  // `fireEvent.press` wraps the handler in `act`, which then never drains — the
  // test hangs rather than failing honestly. The behaviour is already covered
  // where it belongs: JoinCaseForm.test.tsx asserts that `status="submitting"`
  // disables the submit action and makes the input non-editable, so a second
  // press cannot reach this screen's handler at all. The guard in handleSubmit
  // is defence in depth behind that.

  it('never calls the service with a blank code', async () => {
    await renderScreen();
    await fireEvent.press(submit());
    expect(mockJoinCase).not.toHaveBeenCalled();
  });
});
