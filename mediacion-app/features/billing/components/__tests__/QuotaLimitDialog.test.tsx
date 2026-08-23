import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { QuotaLimit } from '@/utils/quota-limit';

jest.mock('@/hooks/use-responsive-layout', () => ({
  useResponsiveLayout: () => ({ horizontalPadding: 16, isWide: false }),
}));

// eslint-disable-next-line import/first
import { QuotaLimitDialog } from '../QuotaLimitDialog';

async function renderDialog(limit: QuotaLimit | null) {
  return render(
    <I18nextProvider i18n={i18n}>
      <QuotaLimitDialog limit={limit} onDismiss={jest.fn()} onUpgrade={jest.fn()} />
    </I18nextProvider>,
  );
}

describe('QuotaLimitDialog', () => {
  it('renders nothing at all when there is no limit to report', async () => {
    // Not "renders a hidden modal": nothing. `ConfirmationDialog` wraps RN's
    // `Modal` with a fade-out that only unmounts when its animation ends, and
    // the animation does not end if the screen is frozen by the navigation the
    // upgrade button triggers — which left the dialog stuck on top of the next
    // screen, unclosable. Unmounting outright is what makes closing final.
    await renderDialog(null);
    expect(screen.toJSON()).toBeNull();
  });

  it('omits the reset date for a stock limit, which does not reset on a date', async () => {
    // `casos` is "how many can exist at once". Telling that user the counter
    // renews on the 14th would promise something that never happens: their
    // limit frees up when they close a case, not when a month turns.
    await renderDialog({
      resource: 'casos',
      used: 2,
      limit: 2,
      periodEnd: '2026-09-14T12:00:00.000Z',
    });

    expect(screen.getByText(i18n.t('billing.quotaLimit.title.casos'))).toBeTruthy();
    expect(
      screen.queryByText(new RegExp(i18n.t('billing.quotaLimit.resetsOn', { date: '.*' }))),
    ).toBeNull();
  });

  it('never invents a number it was not given', async () => {
    // Today's live 403 carries no counts. The dialog has to stay true without
    // them rather than render "0 de 0".
    await renderDialog({
      resource: 'negociaciones',
      used: null,
      limit: null,
      periodEnd: null,
    });

    expect(screen.getByText(i18n.t('billing.quotaLimit.bodyUnknown'))).toBeTruthy();
  });

  it('falls back to the countless copy when only half the counts arrived', async () => {
    // A limit with no usage reads as broken arithmetic on screen.
    await renderDialog({
      resource: 'negociaciones',
      used: null,
      limit: 3,
      periodEnd: null,
    });

    expect(screen.getByText(i18n.t('billing.quotaLimit.bodyUnknown'))).toBeTruthy();
  });
});
