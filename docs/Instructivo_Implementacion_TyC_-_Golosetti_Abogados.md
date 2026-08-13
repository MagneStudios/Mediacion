**GOLOSETTI ABOGADOS DE STARTUPS**

# Instructivo: cómo implementar tus Términos y Condiciones

*Guía práctica para el equipo de producto, desarrollo y operaciones*

## Leé esto antes que nada

Los Términos y Condiciones que te entregamos no te protegen por el solo hecho de existir. Un documento impecable mal implementado es, en la práctica, un documento que no podés hacer valer.

Lo que decide si sirven o no en un conflicto son tres cosas: dónde están publicados, cómo el usuario los aceptó y qué prueba guardaste de esa aceptación. Este instructivo es el paso a paso de esas tres cosas.

## 1. Dónde publicarlos

El texto tiene que estar disponible en tu sitio o app, en cualquier momento, sin que el usuario tenga que pedirlo, registrarse ni escribirle a nadie.

### Qué hacer

1. Creá una URL propia y permanente. Por ejemplo: `tusitio.com/terminos-y-condiciones`. Una página web, no un PDF para descargar.
2. Poné el link en el pie de página (footer) de todas las páginas del sitio, incluida la home y el checkout.
3. Sumá el link también en el punto exacto donde el usuario contrata: registro, alta de cuenta, carrito, botón de pago. No alcanza con que esté solo en el footer.
4. Si tenés app móvil, el link va dentro de la app (menú de ajustes o perfil) y en la ficha de la tienda (App Store / Google Play).
5. Que la página sea accesible desde el celular y se pueda leer sin zoom. Más del 70% de tus usuarios entra desde ahí.

## 2. Cómo obtener la aceptación

No alcanza con que los Términos estén publicados y linkeados: hay que poder demostrar que el usuario los aceptó activamente antes de contratar.

### El estándar mínimo: checkbox no tildado por defecto

- Casilla vacía que el usuario tiene que tildar. Nunca pre-tildada.
- El botón de registro o de pago no se habilita hasta que la casilla esté tildada.
- El texto de la casilla incluye el link al documento, abriéndose en una pestaña nueva (para que el usuario no pierda lo que estaba cargando).

### Texto sugerido para la casilla

> ☐ Leí y acepto los Términos y Condiciones y la Política de Privacidad.

Si además vas a mandar comunicaciones comerciales, sumá una casilla aparte y opcional (no puede ser obligatoria para contratar):

> ☐ Quiero recibir novedades y promociones por email. (Opcional)

## 3. Cómo guardar la prueba de la aceptación

Si no podés demostrar quién aceptó, cuándo y qué versión exacta del documento estaba vigente en ese momento, tener los Términos publicados sirve de poco.

### Qué tiene que registrar tu sistema, en cada aceptación

- Identificador del usuario (ID interno, email o el dato con el que lo tengas identificado).
- Fecha y hora exactas de la aceptación, con zona horaria.
- Dirección IP desde la que se aceptó.
- Versión del documento aceptado (por ejemplo "v2.1 - 15/03/2026").
- Qué se aceptó: Términos, Privacidad, marketing. Cada uno como un registro distinto.
- Navegador y dispositivo (user agent). Es un dato secundario, pero suma.

### Además

- Guardá una copia congelada de cada versión del documento, con su fecha de vigencia. No sirve tener solo la versión actual: si el conflicto es de hace dos años, necesitás el texto de hace dos años.
- Conservá estos registros al menos 5 años desde que termina la relación con el usuario. Es el criterio prudente para cubrir los plazos de prescripción.
- Que el log sea exportable en un formato legible (CSV, PDF). Si hay un reclamo te lo vas a necesitar.

### Cómo pedírselo a tu equipo técnico

Necesitamos una tabla de aceptaciones (por ejemplo, "user_agreements") con: user_id, tipo de documento, versión del documento, timestamp con zona horaria, IP y user agent. Un registro nuevo por cada aceptación, sin sobrescribir los anteriores. Y un repositorio con el texto completo de cada versión publicada, con fecha de inicio y fin de vigencia.

## 4. Versionado y cambios

Tus Términos van a cambiar: cambia el producto, cambia el modelo de negocio. Lo importante es que el cambio quede documentado y comunicado.

### Reglas

6. Mostrá la fecha de última actualización arriba de todo en la página, bien visible.
7. Numerá las versiones (v1.0, v1.1, v2.0) y guardá las anteriores, aunque no las publiques.
8. Avisá los cambios con anticipación razonable —como mínimo 10 días— por email a todos los usuarios activos y con un aviso dentro del producto.
9. Si el cambio es sustancial, pedí una nueva aceptación expresa.
10. Nunca apliques un cambio con efecto retroactivo a operaciones ya cerradas.

Regla simple para decidir si es sustancial: si el usuario, sabiendo el cambio de antemano, podría haber decidido no contratar, es sustancial. Pedí aceptación nueva.

## 5. Si vendés a consumidores en Argentina

Si tu cliente final es un consumidor (una persona que compra para uso personal, no para revender ni para su negocio), además de los Términos tenés obligaciones puntuales de la normativa de defensa del consumidor. Revisá con nosotros cuáles te aplican según tu modelo, pero estas son las más frecuentes:

- **Botón de arrepentimiento.** Visible en la primera pantalla del sitio, accesible sin registrarse ni loguearse, que permita revocar la compra dentro de los 10 días corridos. No puede estar escondido en el footer ni dentro de la cuenta del usuario.
- **Botón de baja.** Si vendés servicios de suscripción o de ejecución continuada, el usuario tiene que poder darse de baja online, por el mismo medio por el que contrató, sin llamar por teléfono ni pedir autorización.
- **Datos completos de la empresa.** Razón social, CUIT y domicilio, visibles en el sitio. No alcanza con el nombre de fantasía.
- **Canal de contacto real.** Email o formulario que alguien efectivamente responda, con un plazo de respuesta declarado.
- **Link a la Ventanilla Única Federal de Defensa del Consumidor.** Se muestra junto con los datos de contacto: <https://www.argentina.gob.ar/justicia/derechofacil/leysimple/ventanilla-unica-federal-de-reclamos-de-defensa-del-consumidor>
- Precios en pesos, finales, con impuestos incluidos, y con el total desglosado antes de confirmar la compra.
- **Coherencia con la publicidad.** Todo lo que prometés en la landing, en los anuncios o en redes te obliga, aunque los Términos digan otra cosa. Si la landing dice "cancelás cuando quieras", los Términos no pueden imponer permanencia mínima.
- **Registro de bases de datos personales** ante la autoridad de protección de datos, si tratás datos de personas. Pedinos tus datos de registro ya que está incluido en tus servicios.

> **Atención con el punto de la coherencia**
>
> Es el que más problemas genera y el que menos se controla. Marketing escribe la landing, el equipo legal escribe los Términos, y nadie los lee juntos. Antes de publicar cualquier campaña, chequeá que lo que promete coincida con lo que dicen tus Términos. Si no coincide, gana la promesa de la publicidad.

## 6. Checklist de implementación

Recorré esta lista con tu equipo antes de dar por cerrada la implementación.

| Punto a verificar | ¿Quién lo hace? |
| --- | --- |
| ☐ Los Términos están en una URL propia y permanente del sitio (no un PDF). | Desarrollo |
| ☐ El link está en el footer de todas las páginas. | Desarrollo |
| ☐ El link está en el registro, el checkout y el alta de cuenta. | Desarrollo |
| ☐ Hay un checkbox NO pre-tildado antes de registrarse o pagar. | Desarrollo |
| ☐ Hay checkboxes separados para Términos y Privacidad, y marketing. | Desarrollo |
| ☐ El botón de confirmar no se habilita sin la casilla tildada. | Desarrollo |
| ☐ El sistema guarda usuario, fecha/hora, IP, versión y user agent de cada aceptación. | Desarrollo |
| ☐ Se conserva una copia congelada de cada versión del documento. | Desarrollo |
| ☐ La fecha de última actualización está visible arriba de la página. | Producto |
| ☐ Está definido el circuito para avisar cambios y pedir nueva aceptación. | Producto |
| ☐ Botón de arrepentimiento visible en la primera pantalla (si aplica). | Producto |
| ☐ Botón de baja online disponible (si vendés suscripciones). | Producto |
| ☐ Razón social, CUIT y domicilio publicados en el sitio. | Administración |
| ☐ Canal de contacto operativo, con alguien que efectivamente responda. | Operaciones |
| ☐ La landing, los anuncios y las redes no prometen nada distinto a los Términos. | Marketing |
| ☐ Se probó todo el flujo desde el celular, de punta a punta. | Producto |

## 7. Cuándo volver a consultarnos

No hace falta que nos escribas por cada ajuste menor. Sí conviene que nos escribas cuando pasa alguna de estas cosas:

- Cambiás el modelo de negocio o la forma de cobrar (de pago único a suscripción, sumás comisiones, cambiás la moneda).
- Empezás a vender fuera de Argentina, especialmente a la Unión Europea, Estados Unidos o Brasil.
- Empezás a tratar datos sensibles (salud, biométricos, financieros) o datos de menores de edad.
- Sumás funcionalidades con inteligencia artificial que procesen contenido o datos de los usuarios.
- Te convertís en intermediario entre terceros: marketplace, plataforma de pagos, API pública.
- Estás por levantar una ronda. En el due diligence te van a pedir los Términos, la Política de Privacidad y la prueba de las aceptaciones. Es mejor llegar con eso ordenado que resolverlo contrarreloj.
- Pasaron 12 meses desde la última revisión.

---

**Golosetti Abogados de Startups**

*Este instructivo es material orientativo de implementación y no reemplaza el asesoramiento legal sobre tu caso concreto. Ante cualquier duda de las que aparecen acá, escribinos antes de publicar.*
