import { I18nextProvider } from 'react-i18next';
import { render, screen } from '@testing-library/react-native';

import i18n from '@/i18n';
import type { SubscriptionUsage } from '@/types/billing';

// eslint-disable-next-line import/first
import { UsageSummaryCard } from '../UsageSummaryCard';

const t = i18n.t.bind(i18n);

function usage(overrides: Partial<SubscriptionUsage> = {}): SubscriptionUsage {
  return {
    periodStart: '2026-08-17T12:00:00.000Z',
    periodEnd: '2026-09-16T12:00:00.000Z',
    negotiations: { used: 2, limit: 3 },
    clients: null,
    ...overrides,
  };
}

async function renderCard(value: SubscriptionUsage) {
  return render(
    <I18nextProvider i18n={i18n}>
      <UsageSummaryCard usage={value} />
    </I18nextProvider>,
  );
}

describe('UsageSummaryCard', () => {
  it('shows the count against the limit', async () => {
    await renderCard(usage());
    expect(screen.getByText(t('billing.usage.count', { used: 2, limit: 3 }))).toBeTruthy();
  });

  it('does not draw the clients row when the counter does not apply', async () => {
    // `clients: null` is "you are not the titular of an estudio", which is not
    // a counter at zero — rendering it at zero would promise a personal account
    // a capacity it does not have.
    await renderCard(usage({ clients: null }));
    expect(screen.queryByText(t('billing.usage.clients'))).toBeNull();
  });

  it('draws the clients row when it does apply', async () => {
    await renderCard(usage({ clients: { used: 7, limit: 20 } }));
    expect(screen.getByText(t('billing.usage.clients'))).toBeTruthy();
    expect(screen.getByText(t('billing.usage.count', { used: 7, limit: 20 }))).toBeTruthy();
  });

  it('reports an unlimited counter as a count, with no progress bar', async () => {
    // A bar needs a denominator. An unlimited plan has none, and an empty track
    // would invite the reader to estimate how much is left of something that
    // does not run out.
    await renderCard(usage({ negotiations: { used: 4, limit: null } }));

    expect(screen.getByText(t('billing.usage.unlimited', { used: 4 }))).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('never reports progress past the limit', async () => {
    // The server is the authority on whether the quota was exceeded, and
    // `consume_quota` rolls back the increment it rejects. A counter can still
    // sit at its limit, and a fill wider than its track would read as a layout
    // bug rather than as a full plan.
    await renderCard(usage({ negotiations: { used: 9, limit: 3 } }));

    const bar = screen.getByRole('progressbar');
    expect(bar.props['aria-valuenow']).toBe(3);
    expect(bar.props['aria-valuemax']).toBe(3);
  });

  it('omits the renewal line when the date cannot be read', async () => {
    // "Se renueva el Invalid Date" is worse than saying nothing: the one thing
    // this line exists to promise is when the counter comes back.
    await renderCard(usage({ periodEnd: null }));

    expect(screen.queryByText(/renueva|resets/i)).toBeNull();
  });
});
