import { buildHandoffUrl, isSafeHandoffCode, toWaMePhone } from '../whatsapp-handoff';

describe('toWaMePhone', () => {
  it('deja sólo dígitos: wa.me no acepta +, espacios ni guiones', () => {
    expect(toWaMePhone('+54 9 11 5555-4444')).toBe('5491155554444');
  });

  it('saca el cero de discado nacional', () => {
    expect(toWaMePhone('011 5555 4444')).toBe('1155554444');
  });

  it.each([null, undefined, '', '   ', 'no es un numero'])(
    'devuelve null para %p en vez de un destino a medias',
    (input) => {
      // Un wa.me con destino inválido abre WhatsApp en una pantalla de error,
      // que se parece bastante a que la app esté rota.
      expect(toWaMePhone(input as string | null | undefined)).toBeNull();
    },
  );

  it('rechaza lo que queda fuera del rango de E.164', () => {
    expect(toWaMePhone('1234567')).toBeNull();
    expect(toWaMePhone('1234567890123456')).toBeNull();
  });
});

describe('isSafeHandoffCode', () => {
  it('acepta el id de una solicitud', () => {
    expect(isSafeHandoffCode('lawreq-0001')).toBe(true);
  });

  it.each([
    ['un nombre con espacios', 'Juan Perez'],
    ['el objeto del caso', 'disputa por medianera'],
    ['un email', 'parte@ejemplo.com'],
    ['cadena vacia', ''],
  ])('rechaza %s', (_label, value) => {
    expect(isSafeHandoffCode(value)).toBe(false);
  });
});

describe('buildHandoffUrl', () => {
  const code = 'lawreq-0007';
  const message = `Hola: pagué la asistencia legal. Mi número de solicitud es ${code}.`;

  it('arma el deep link con el mensaje escapado', () => {
    const url = buildHandoffUrl({ phone: '+54 9 11 5555-4444', message, code });
    expect(url).toBe(`https://wa.me/5491155554444?text=${encodeURIComponent(message)}`);
  });

  it('no deja pasar datos de la negociación en la URL (spec §7.5)', () => {
    // La restricción es explícita: "nunca datos sensibles de la negociación en
    // la URL de wa.me, sólo un identificador corto". Acá se prueba el borde
    // que la hace cumplir: si alguien intenta usar como código algo que no lo
    // es, no sale link.
    const url = buildHandoffUrl({
      phone: '+5491155554444',
      message: 'Hola, mi caso es disputa por medianera con Juan Perez',
      code: 'disputa por medianera con Juan Perez',
    });
    expect(url).toBeNull();
  });

  it('devuelve null sin número del estudio — el dato que todavía falta', () => {
    expect(buildHandoffUrl({ phone: null, message, code })).toBeNull();
  });

  it('devuelve null si el mensaje no lleva el código', () => {
    // Sin el código el estudio no puede cruzar el mensaje con la solicitud
    // pagada: es un "hola" sin referencia.
    expect(
      buildHandoffUrl({ phone: '+5491155554444', message: 'Hola, quiero coordinar', code }),
    ).toBeNull();
  });
});
