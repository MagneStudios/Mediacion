import { useTranslation } from 'react-i18next';

import { ConfirmationDialog } from '@/design-system';
import i18n from '@/i18n';
import { formatEventDate } from '@/utils/format-legal-date';
import type { QuotaLimit, QuotaResource } from '@/utils/quota-limit';

export type QuotaLimitDialogProps = {
  /** `null` closes it. The parsed failure is the whole state this needs. */
  limit: QuotaLimit | null;
  onDismiss: () => void;
  onUpgrade: () => void;
};

/**
 * Only the period-based counters reset on a date. `casos` is a stock limit —
 * how many can exist at once — so telling that user "el contador se renueva
 * el 14 de septiembre" would promise something that never happens: their
 * limit frees up when they close a case, not when a month turns.
 */
function isPeriodBased(resource: QuotaResource): boolean {
  return resource !== 'casos';
}

/**
 * What the user sees when the plan says no.
 *
 * Reached from two different server errors that mean the same thing to the
 * person in front of the screen: the `403 plan_limit_exceeded` that is live
 * today and the `402 quota_exceeded` of the Pactum spec, which does not exist
 * on the API yet (`docs/plan-frontend-monetizacion.md` §1.4, §1.5).
 *
 * **There is no retry.** That is the point of having this instead of the
 * generic error state: a limit does not clear by pressing the button again,
 * and offering it reads as a broken system rather than a full plan — the same
 * reasoning the public legal forms already applied to `429`.
 *
 * It degrades on purpose. Today's live error carries no numbers, so the copy
 * falls back to a sentence that is true without them; the day BE sends
 * `usado`/`limite`/`period_end`, the same dialog gets specific with no change
 * here. It never invents a number it was not given.
 */
export function QuotaLimitDialog({ limit, onDismiss, onUpgrade }: QuotaLimitDialogProps) {
  const { t } = useTranslation();

  // Unmounted rather than hidden. `ConfirmationDialog` wraps RN's `Modal` with
  // `animationType="fade"`, which keeps the element mounted until its exit
  // animation ends — and the animation never ends if the screen gets frozen by
  // a navigation in the same breath, which is exactly what the upgrade button
  // does. Toggling `visible` left the dialog painted on top of Mi plan, and
  // then unclosable, because the screen behind it had stopped re-rendering.
  // Returning null makes closing a synchronous unmount with nothing to wait
  // for. Found in the browser; RNTL unmounts the Modal either way and cannot
  // see the difference.
  if (limit === null) {
    return null;
  }

  const resource = limit.resource;
  const hasCounts = limit.used !== null && limit.limit !== null;

  const body = hasCounts
    ? t(`billing.quotaLimit.body.${resource}`, { used: limit.used, limit: limit.limit })
    : t('billing.quotaLimit.bodyUnknown');

  const resets =
    limit.periodEnd && isPeriodBased(resource)
      ? ` ${t('billing.quotaLimit.resetsOn', {
          date: formatEventDate(limit.periodEnd, i18n.language),
        })}`
      : '';

  return (
    <ConfirmationDialog
      visible
      title={t(`billing.quotaLimit.title.${resource}`)}
      icon="alert-circle"
      confirmLabel={t('billing.quotaLimit.upgradeAction')}
      confirmVariant="primary"
      onConfirm={onUpgrade}
      cancelLabel={t('billing.quotaLimit.dismissAction')}
      onCancel={onDismiss}
    >
      {`${body}${resets}`}
    </ConfirmationDialog>
  );
}
