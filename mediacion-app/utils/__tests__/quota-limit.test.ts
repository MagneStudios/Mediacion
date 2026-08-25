import { ApiError } from '../../services/api/api-error';
import { getQuotaLimit } from '../quota-limit';

describe('getQuotaLimit', () => {
  it('ignores anything that is not a limit failure', () => {
    // These keep their retryable error state: retrying them can work.
    expect(getQuotaLimit(new ApiError('caso_not_found', 'x', 404))).toBeNull();
    expect(getQuotaLimit(new ApiError('network_unavailable', 'x', 0))).toBeNull();
    expect(getQuotaLimit(new ApiError('internal_error', 'x', 500))).toBeNull();
    expect(getQuotaLimit(new Error('boom'))).toBeNull();
    expect(getQuotaLimit(null)).toBeNull();
  });

  it('recognises the live 403 that carries no numbers at all', () => {
    // This is today's real error: `PlanLimitService` sends only code and
    // message. The dialog has to be useful with exactly this much.
    expect(getQuotaLimit(new ApiError('plan_limit_exceeded', 'Plan case limit reached', 403))).toEqual(
      { resource: 'casos', used: null, limit: null, periodEnd: null },
    );
  });

  it('reads the full detail of the 402 the spec defines', () => {
    const error = new ApiError('quota_exceeded', 'x', 402, {
      code: 'quota_exceeded',
      recurso: 'negociaciones',
      usado: 3,
      limite: 3,
      period_end: '2026-09-14T00:00:00.000Z',
    });

    expect(getQuotaLimit(error)).toEqual({
      resource: 'negociaciones',
      used: 3,
      limit: 3,
      periodEnd: '2026-09-14T00:00:00.000Z',
    });
  });

  it('falls back to the negotiations resource when the 402 omits it', () => {
    const error = new ApiError('quota_exceeded', 'x', 402, { usado: 3, limite: 3 });
    expect(getQuotaLimit(error)?.resource).toBe('negociaciones');
  });

  it('tells the clients quota apart from the negotiations one', () => {
    // A estudio hitting its 20 client sign-ups is a different sentence from a
    // particular hitting 3 negotiations; collapsing them would show the wrong
    // copy to the account that pays the most.
    const error = new ApiError('quota_exceeded', 'x', 402, { recurso: 'clientes', usado: 20, limite: 20 });
    expect(getQuotaLimit(error)?.resource).toBe('clientes');
  });

  it('drops counts that are not usable rather than rendering them', () => {
    // "Usaste 2.5 de 3" or a negative reads as a broken product. Losing the
    // numbers costs a vaguer sentence; showing them costs credibility.
    const error = new ApiError('quota_exceeded', 'x', 402, {
      usado: 2.5,
      limite: -1,
      period_end: 'no es una fecha',
    });

    expect(getQuotaLimit(error)).toEqual({
      resource: 'negociaciones',
      used: null,
      limit: null,
      periodEnd: null,
    });
  });

  it('drops an unknown resource instead of trusting it into the copy key', () => {
    // The resource picks an i18n key; an unrecognised value would render a raw
    // key on screen.
    const error = new ApiError('quota_exceeded', 'x', 402, { recurso: 'carpetas' });
    expect(getQuotaLimit(error)?.resource).toBe('negociaciones');
  });
});
