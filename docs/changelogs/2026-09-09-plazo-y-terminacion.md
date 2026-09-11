# Changelog — Proyecto Mediación

## 2026-09-09 (2) — RN-08 y RN-10: fin autónomo y plazo de respuesta

**Origen:** §6.1 de `docs/auditoria-desbloqueos-09-09-2026.md`. Toca sólo `mediacion-app` y `docs/`.

---

**Dos endpoints construidos que nadie consumía, y el contrato decía que nadie los había pedido.**

`docs/integration-contract.md` los listaba como *"No hay UI que los use ni pedido de Producto para que la haya"*. Son **RN-08** y **RN-10** de la documentación técnica fundacional, con rol **Parte** — no panel:

- **RN-10** — *"una parte puede fijar un plazo puntual (ej. respuesta para el día siguiente)"*
- **RN-08** — *"cualquiera de las partes puede declarar expresamente el fin de una negociación; la terminación queda registrada con su marca temporal"*

Hasta hoy el semáforo del dashboard era **decoración de sólo lectura**: la app leía `plazo` y `semaforo` y no tenía forma de escribirlos.

---

**El plazo se elige por duración, no por fecha, y es una decisión.**

Tres presets: 24 horas, 3 días, 1 semana. El ejemplo que da el propio RN-10 es una duración, el design system no tiene date picker, y un campo de fecha a mano arrastra zonas horarias y formatos por locale para expresar algo que la persona piensa como "mañana".

Además se alinean con los umbrales que el servidor usa para el semáforo (≤24 h rojo, ≤72 h amarillo), así que elegir tiene una consecuencia visible y predecible. **El día que exista un calendario se suma sin tocar el contrato:** lo que viaja al servidor es un instante ISO igual.

---

**La elegibilidad replica la máquina de estados de DB, y eso no es duplicación gratuita.**

El servidor sólo valida que el `estado` pedido sea `terminado`; **quién puede llegar ahí desde dónde lo decide el trigger**, y si no coincide devuelve un `409` genérico que no le explica nada a la persona. Así que `utils/case-actions.ts` lo replica, con el mismo criterio que las tres utils de elegibilidad que ya existían.

- **Terminar** se ofrece desde `nuevo`, `pendiente_suscripciones`, `activo` y `en_negociacion`. Incluye `nuevo` —terminar un caso que nadie llegó a aceptar es legítimo— y **no** los absorbentes.
- **El plazo es más restrictivo que el servidor**, a propósito. Un plazo de respuesta necesita a alguien que pueda responder: `nuevo` no tiene contraparte, y en `pendiente_suscripciones` el gate C-01 la tiene impedida de actuar. **Ponerle un reloj a alguien que no puede moverse es presión sobre algo que no está en sus manos.**

El mock aplica la misma regla en vez de confiar en que la UI escondió el botón.

---

### Y tres bugs de copy que este cambio destapó

**El importante: un caso terminado decía "Firmado".**

`toStatusLabelKey` mapeaba `terminado` junto a `acordado` y `cerrado` sobre la clave `signed`. Nadie lo notó porque **el estado era inalcanzable**: ninguna pantalla podía escribirlo. En cuanto se pudo terminar un caso, uno abandonado **sin acuerdo** habría dicho "Firmado" en el dashboard — que en un producto legal no es un matiz de copy. `terminated` es ahora su propia clave; `cerrado` se queda con `signed` porque es el cierre que sigue a un acuerdo.

**Dos claves de i18n que se renderizaban crudas.** El mapa `cases.nextAction.*` no tenía `terminated` — ni `awaitingSubscriptions`, que faltaba **desde el 04/09**, cuando agregamos el estado del gate C-01. Las dos salían en pantalla como `cases.nextAction.<clave>`.

Ninguna de las dos las agarra el compilador: son lookups armados con template string. **Las encontró el navegador, no CI.** Así que va un guard —`case-status-copy.test.ts`— que exige chip y línea de contexto para cada miembro de `CaseStatusLabelKey` en los dos idiomas, atado al tipo con `satisfies` para que sumar un miembro sin tocar el copy deje de compilar.

**Y un caso terminado mostraba "PRÓXIMA ACCIÓN".** Es un desenlace, no un próximo paso: ahora dice "Resultado", igual que un caso firmado.

---

### QA

- `npx tsc --noEmit` — sin errores nuevos. Siguen los 4 preexistentes en `dev`.
- `npx jest` — **139/139 suites, 1241/1241 tests** (31 nuevos).
- `npx expo lint` — limpio · paridad de i18n verificada.
- **En el navegador**, que es donde aparecieron los tres bugs de copy: el plazo pasando de 36 h a 24 h al elegir el preset; el diálogo de terminación con su aviso de irreversibilidad; el caso terminado con chip **"Negociación terminada"**, encabezado **"RESULTADO"** y su línea propia; y **cero claves de i18n crudas** en la página.

**Lo que no se pudo verificar:** el camino contra backend real. Los dos endpoints existen y están cubiertos por tests del cliente HTTP —incluido el `400` cuando el servidor rechaza un plazo no futuro— pero nadie los ejercitó contra la API.

---

### Lo que sigue abierto

El date picker. Los presets cubren el ejemplo del requisito, pero RN-10 dice *"plazo configurable"* y una fecha arbitraria necesita un componente que el design system no tiene. Queda como decisión de Producto: si alcanza con duraciones, no hace falta.
