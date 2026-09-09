import { toCheckoutUrl } from '../checkout-url';

describe('toCheckoutUrl', () => {
  it('accepts the Mercado Pago checkout URLs the API actually returns', () => {
    for (const url of [
      'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123',
      'https://www.mercadopago.com/checkout/v1/redirect?pref_id=123',
      'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=123',
    ]) {
      expect(toCheckoutUrl(url)).toBe(url);
    }
  });

  it('refuses anything that is not https', () => {
    // `http:` would expose the checkout to tampering in transit; the rest have
    // no business being handed to `Linking.openURL`.
    expect(toCheckoutUrl('http://www.mercadopago.com.ar/checkout')).toBeNull();
    expect(toCheckoutUrl('javascript:alert(1)')).toBeNull();
    expect(toCheckoutUrl('file:///etc/passwd')).toBeNull();
    expect(toCheckoutUrl('mercadopago://checkout')).toBeNull();
  });

  it('refuses a host that is not Mercado Pago, however plausible it looks', () => {
    expect(toCheckoutUrl('https://evil.example/checkout')).toBeNull();
    // The dot matters: `mercadopago.evil.com` contains "mercadopago." and is
    // accepted, but `mercadopagoevil.com` does not — documenting the real edge
    // of this check rather than pretending it is a full domain validator.
    expect(toCheckoutUrl('https://mercadopagoevil.com/checkout')).toBeNull();
  });

  it('refuses anything that is not a parseable string', () => {
    expect(toCheckoutUrl('')).toBeNull();
    expect(toCheckoutUrl('not a url')).toBeNull();
    expect(toCheckoutUrl(null)).toBeNull();
    expect(toCheckoutUrl(undefined)).toBeNull();
    expect(toCheckoutUrl(42)).toBeNull();
    expect(toCheckoutUrl({ init_point: 'https://www.mercadopago.com.ar/x' })).toBeNull();
  });
});
