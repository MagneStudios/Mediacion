import {
  maxRecheckDelayMs,
  minRecheckDelayMs,
  scheduleValidFromRecheck,
} from '../valid-from-recheck';

describe('scheduleValidFromRecheck', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-31T23:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('arms nothing for a non-finite validFrom — Date.parse(null) must not become an immediate re-check loop', () => {
    const onDue = jest.fn();

    const cancel = scheduleValidFromRecheck(Number.NaN, onDue);

    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(maxRecheckDelayMs * 2);
    expect(onDue).not.toHaveBeenCalled();
    expect(cancel).not.toThrow();
  });

  it('floors an already-past validFrom to the minimum delay instead of firing at delay 0', () => {
    // A client clock running ahead of the server: the read still returns the
    // document as scheduled, but locally its validFrom is already behind.
    const onDue = jest.fn();
    scheduleValidFromRecheck(Date.now() - 60 * 1000, onDue);

    jest.advanceTimersByTime(minRecheckDelayMs - 1);
    expect(onDue).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onDue).toHaveBeenCalledTimes(1);
  });

  it('fires once the target passes, not on a fixed interval', () => {
    const onDue = jest.fn();
    scheduleValidFromRecheck(Date.now() + 60 * 60 * 1000, onDue);

    jest.advanceTimersByTime(60 * 60 * 1000 - 1);
    expect(onDue).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onDue).toHaveBeenCalledTimes(1);

    // Nothing re-arms after firing: this is a one-shot, never a setInterval.
    jest.advanceTimersByTime(maxRecheckDelayMs * 2);
    expect(onDue).toHaveBeenCalledTimes(1);
  });

  it('clamps a far-off validFrom to 24h hops and re-arms until it is actually reached', () => {
    // 60 days out: past the ~24.8-day signed-32-bit setTimeout limit, so an
    // unclamped timer would overflow and fire immediately.
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    const onDue = jest.fn();
    scheduleValidFromRecheck(Date.now() + sixtyDaysMs, onDue);

    jest.advanceTimersByTime(maxRecheckDelayMs);
    expect(onDue).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(sixtyDaysMs - maxRecheckDelayMs);
    expect(onDue).toHaveBeenCalledTimes(1);
  });

  it('the returned cancel disarms the pending timer, including a re-armed hop', () => {
    const onDue = jest.fn();
    const cancel = scheduleValidFromRecheck(
      Date.now() + 2 * maxRecheckDelayMs,
      onDue,
    );

    jest.advanceTimersByTime(maxRecheckDelayMs);
    cancel();

    jest.advanceTimersByTime(10 * maxRecheckDelayMs);
    expect(onDue).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
