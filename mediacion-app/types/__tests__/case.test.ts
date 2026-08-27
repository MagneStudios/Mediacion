import { metodosEnOrden } from '../case';

/**
 * C-04 (cambios cliente 27/08). The order is a client requirement with a
 * stated criterion — ascending third-party involvement — not an arbitrary
 * arrangement someone is free to tidy up alphabetically later. It was
 * already correct in both screens before this ticket; what was missing was
 * anything that would notice if it stopped being correct.
 */
describe('metodosEnOrden', () => {
  it('presents the methods by ascending third-party involvement', () => {
    expect(metodosEnOrden).toEqual(['negociacion', 'conciliacion', 'mediacion']);
  });
});
