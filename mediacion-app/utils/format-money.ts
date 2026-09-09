/**
 * Formatea un monto guardado en **unidades mínimas enteras**.
 *
 * El spec de monetización §12 lo exige: "todos los montos se manejan en
 * enteros de unidad mínima, nunca en `float`". Así que ARS 50.000 viaja como
 * `5000000` y se divide acá, en el borde de la presentación, una sola vez.
 *
 * La moneda **viene con el dato**, no está hardcodeada. Es la diferencia con
 * `formatPlanPrice` de `utils/format-plan-limit.ts`, que fija `currency:
 * 'USD'` para todos los precios de la app y es el punto #24 abierto del
 * instructivo de TyC (`docs/plan-frontend-monetizacion.md` §1.6). Cuando eso
 * se resuelva, esta función es la que debería quedar.
 */
const minorUnitsPerUnit = 100;

export function formatMinorAmount(
  amountMinor: number,
  currency: 'ARS' | 'USD',
  language: string,
): string {
  const locale = language === 'en' ? 'en-US' : 'es-AR';
  const amount = amountMinor / minorUnitsPerUnit;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      // Los precios de este producto son redondos; los centavos sólo agregan
      // ruido a un número que ya es grande.
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}
