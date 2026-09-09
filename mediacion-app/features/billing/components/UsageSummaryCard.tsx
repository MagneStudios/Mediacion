import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../../design-system';
import { semanticColors } from '../../../design-system/tokens/colors';
import { radii } from '../../../design-system/tokens/radii';
import { spacing } from '../../../design-system/tokens/spacing';
import { typography } from '../../../design-system/tokens/typography';
import i18n from '../../../i18n';
import type { SubscriptionUsage, UsageCounter } from '../../../types/billing';
import { formatEventDate } from '../../../utils/format-legal-date';

export type UsageSummaryCardProps = {
  usage: SubscriptionUsage;
};

/**
 * One countable, with its bar.
 *
 * **No bar when the limit is `null`.** A progress bar needs a denominator, and
 * an unlimited plan has none — drawing an empty track would invite the reader
 * to estimate how much is left of something that does not run out. The count
 * still shows, because "usaste 4 este mes" is useful on its own.
 */
function CounterRow({ label, counter }: { label: string; counter: UsageCounter }) {
  const { t } = useTranslation();
  const { used, limit } = counter;

  if (limit === null) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{t('billing.usage.unlimited', { used })}</Text>
      </View>
    );
  }

  const exhausted = used >= limit;
  // Clamped because the server is the authority on whether the quota was
  // exceeded, not this component: `consume_quota` rolls back the increment it
  // rejects, but a counter can legitimately sit *at* the limit, and a bar
  // wider than its track would render as an overflow bug rather than as a
  // full plan. `limit` of 0 would divide by zero, and reads as "none allowed",
  // which is a full bar.
  const ratio = limit === 0 ? 1 : Math.min(used / limit, 1);

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, exhausted ? styles.rowValueExhausted : null]}>
          {t('billing.usage.count', { used, limit })}
        </Text>
      </View>
      {/*
        `accessible` is what actually exposes this as one node with a role — a
        bare `accessibilityRole` on a View leaves it as decoration that assistive
        tech walks straight past, so the count would be the only thing announced.

        The value goes through the `aria-*` props rather than
        `accessibilityValue`: React Native aliases them to `accessibilityValue`
        on native, but only these reach the DOM as `aria-valuenow`/`-valuemax`
        on web. With `accessibilityValue` the bar rendered as a progressbar with
        no value at all — checked in the browser, and invisible to the RNTL test,
        which reads props and never the DOM.

        The clamped `now` is the same one the fill uses: the bar must not claim
        more progress than its own track.
      */}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        style={styles.track}
      >
        <View
          style={[
            styles.fill,
            { width: `${ratio * 100}%` },
            exhausted ? styles.fillExhausted : null,
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Cuánto consumió el titular de su plan en este período de facturación
 * (`GET /suscripciones/uso`, vivo desde el 03/09).
 *
 * Es el lado de *flujo* del modelo —lo creado desde que abrió el período— y por
 * eso vive separado de las tarjetas de plan, que muestran los límites de
 * *stock*: cuántos pueden existir a la vez. Los dos conviven en el producto y
 * ninguno fue retirado (`docs/plan-frontend-monetizacion.md` §1.4).
 *
 * **La fila de clientes no se dibuja cuando no aplica.** `clients: null`
 * significa "no sos titular de un estudio", que no es lo mismo que un contador
 * en cero — mostrarlo en cero le prometería a una cuenta personal una
 * capacidad que no tiene.
 */
export function UsageSummaryCard({ usage }: UsageSummaryCardProps) {
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {t('billing.usage.title')}
      </Text>

      <CounterRow label={t('billing.usage.negotiations')} counter={usage.negotiations} />
      {usage.clients ? (
        <CounterRow label={t('billing.usage.clients')} counter={usage.clients} />
      ) : null}

      {/*
        Sólo si la fecha se pudo leer. Un `periodEnd` ilegible no se muestra
        como "Invalid Date": la promesa de cuándo se renueva el contador es
        justo lo que no conviene decir mal.
      */}
      {usage.periodEnd ? (
        <Text style={styles.footer}>
          {t('billing.usage.renews', { date: formatEventDate(usage.periodEnd, i18n.language) })}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.eyebrow,
    color: semanticColors.text.tertiary,
  },
  row: {
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowLabel: {
    ...typography.body,
    color: semanticColors.text.secondary,
  },
  rowValue: {
    ...typography.body,
    color: semanticColors.text.primary,
  },
  rowValueExhausted: {
    color: semanticColors.status.warningFg,
  },
  track: {
    height: 6,
    borderRadius: radii.sm,
    backgroundColor: semanticColors.surface.sunken,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.sm,
    backgroundColor: semanticColors.action.primaryBg,
  },
  fillExhausted: {
    backgroundColor: semanticColors.status.warningFg,
  },
  footer: {
    ...typography.caption,
    color: semanticColors.text.tertiary,
  },
});
