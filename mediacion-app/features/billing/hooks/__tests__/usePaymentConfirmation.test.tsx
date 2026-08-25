import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { MockSubscription } from '@/types/billing';

const mockGetCurrentSubscription = jest.fn();
jest.mock('@/services/billing.service', () => ({
  billingService: {
    getCurrentSubscription: () => mockGetCurrentSubscription(),
  },
}));

// eslint-disable-next-line import/first
import { usePaymentConfirmation } from '../usePaymentConfirmation';

function subscription(estado: MockSubscription['estado']): MockSubscription {
  return { id: 'sub-1', planId: 'plan-particular', estado, fechaInicio: null, fechaFin: null };
}

function Probe() {
  const { status, subscription: current } = usePaymentConfirmation();
  return <Text>{`${status}|${current?.estado ?? 'none'}`}</Text>;
}

/** One poll plus the wait that follows it. */
async function advanceOnePoll() {
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
}

function state(): string {
  return screen.getByText(/confirming|confirmed|stillPending/).props.children as string;
}

describe('usePaymentConfirmation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetCurrentSubscription.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('confirms as soon as the subscription comes back active', async () => {
    // The webhook may already have landed before the user finished being
    // redirected, so the first read has to be able to end this immediately —
    // no artificial three-second wait for a plan that is already on.
    mockGetCurrentSubscription.mockResolvedValue(subscription('activa'));
    await act(async () => {
      render(<Probe />);
    });

    expect(state()).toBe('confirmed|activa');
    expect(mockGetCurrentSubscription).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting while the subscription is still pendiente_pago', async () => {
    // The default of `POST /suscripciones`: the row exists, the webhook has
    // not arrived. That is the normal middle of this flow, not a failure.
    mockGetCurrentSubscription.mockResolvedValue(subscription('pendiente_pago'));
    await act(async () => {
      render(<Probe />);
    });

    expect(state()).toBe('confirming|pendiente_pago');

    await advanceOnePoll();
    expect(mockGetCurrentSubscription).toHaveBeenCalledTimes(2);
    expect(state()).toBe('confirming|pendiente_pago');
  });

  it('waits through "no subscription yet" too', async () => {
    // Before the webhook writes anything, `/vigente` answers 404 and the
    // backed service maps that to null. Treating it as "you have no plan"
    // would tell someone who just paid that they had not.
    mockGetCurrentSubscription.mockResolvedValue(null);
    await act(async () => {
      render(<Probe />);
    });

    expect(state()).toBe('confirming|none');
  });

  it('confirms on a later poll once the webhook lands', async () => {
    mockGetCurrentSubscription
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(subscription('pendiente_pago'))
      .mockResolvedValue(subscription('activa'));
    await act(async () => {
      render(<Probe />);
    });

    await advanceOnePoll();
    await advanceOnePoll();

    expect(state()).toBe('confirmed|activa');
  });

  it('does not treat a failed read as a failed payment', async () => {
    // The money is already gone. A dropped request says nothing about it, so
    // the loop swallows the failure and asks again.
    mockGetCurrentSubscription
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(subscription('activa'));
    await act(async () => {
      render(<Probe />);
    });

    expect(state()).toBe('confirming|none');

    await advanceOnePoll();
    expect(state()).toBe('confirmed|activa');
  });

  it('gives up after the minute it promised, without calling it an error', async () => {
    mockGetCurrentSubscription.mockResolvedValue(subscription('pendiente_pago'));
    await act(async () => {
      render(<Probe />);
    });

    // 60 s of budget at 3 s a poll.
    for (let i = 0; i < 20; i += 1) {
      await advanceOnePoll();
    }

    expect(state()).toBe('stillPending|pendiente_pago');

    // And it really stopped: no further reads after the budget ran out.
    const callsAtDeadline = mockGetCurrentSubscription.mock.calls.length;
    await advanceOnePoll();
    expect(mockGetCurrentSubscription).toHaveBeenCalledTimes(callsAtDeadline);
  });

  it('stops polling when the screen goes away', async () => {
    mockGetCurrentSubscription.mockResolvedValue(subscription('pendiente_pago'));
    await act(async () => {
      render(<Probe />);
    });

    const callsBefore = mockGetCurrentSubscription.mock.calls.length;
    // Unmounted in its own act: the teardown has to be flushed before the
    // clock moves, or the pending sleep resolves into a loop that has not been
    // told to stop yet and the test measures nothing.
    await act(async () => {
      screen.unmount();
    });
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockGetCurrentSubscription).toHaveBeenCalledTimes(callsBefore);
  });
});
