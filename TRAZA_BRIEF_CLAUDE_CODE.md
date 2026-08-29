# Traza — Brief de construcción para Claude Code

> Este documento es la fuente de verdad para arrancar el MVP. Léelo completo
> antes de escribir código. Si algo no está aquí, no lo asumas — pregunta.

## 1. Qué es Traza

SaaS B2B (web + PWA) para digitalizar viajes de materia prima / carga a
granel. Se captura evidencia en origen (foto de un documento con OCR, o
captura nativa si no hay papel), se arma el "viaje" contra el padrón de la
empresa, se cierra la entrega con una foto tomada en el destino, y lo que
cuadra queda listo para facturar — lo que no, pasa a revisión humana.

**Wedge de mercado:** acarreo de construcción (agregados: grava, arena) con
vale de báscula.
**Plataforma:** el mismo core sirve para pipas (agua, combustibles, gas) y
otras materias primas, cambiando solo tipo de documento, unidad y reglas —
no se construye un producto aparte por vertical.

**Posicionamiento:** no se vende "OCR inteligente". El OCR es el tubo que lee
el papel cuando existe. Lo que se vende es menos doble captura, evidencia,
visibilidad del turno y cobro más rápido.

## 2. Glosario (usar estos nombres en código y UI)

| Término | Significado |
|---|---|
| **Viaje** (`Trip`) | Unidad de negocio central: carga en origen + evidencia de entrega. Estados: `EN_TRANSITO → ENTREGADO → CONCILIADO`, con rama a `EXCEPCION`. |
| **Vale** | En construcción, casi siempre ticket de báscula. No es universal — ver §5. |
| **Documento de carga** | Lo que prueba la salida: vale, remisión, albarán, packing list, carta porte, ticket de medidor. El OCR lee este papel, no un formato mágico único. |
| **Padrón** | Catálogos maestros por empresa: unidades (camiones), productos, orígenes, destinos, clientes, tolerancias. El contenido lo decide cada cliente, no el sistema. |
| **Tenant** | Cada empresa dentro del SaaS. Mismo esquema de datos, valores aislados — un tenant nunca ve datos de otro. |
| **Excepción** | El viaje no pasó las reglas automáticas. Un humano libera o rechaza. No es un dictamen legal de fraude. |
| **Prefactura** | Viajes conciliados, listos para cobrar. |

## 3. Stack sugerido

Mismo stack que ya se usa en otro proyecto interno, para no fragmentar
herramientas — ajustar solo si hay una razón concreta para no reutilizarlo:

- **Backend:** Node.js + PostgreSQL + Prisma + Socket.io (para ver el turno
  en vivo en el dashboard)
- **Frontend:** React + Vite, PWA con soporte offline (el chofer puede estar
  sin señal en la cantera o en obra)
- **Storage de evidencia:** cualquier bucket compatible S3 — la foto original
  es inmutable, se guarda con su hash

## 4. Modelo de datos

Ya existe un primer schema de Prisma trabajado en una sesión anterior — úsalo
como punto de partida, no lo reescribas desde cero:

- `Tenant`, `User` (roles: `ADMIN`, `OPS`, `CHOFER`, `RECIBIDOR`)
- Padrón: `PadronUnidad`, `PadronProducto`, `PadronUbicacion`, `PadronCliente`
  — todos con `tenantId` y aislados por tenant
- `Trip`: folio de origen (nullable — puede no haber documento), unidad,
  producto, bruto/tara/neto, origen, **destino (siempre obligatorio)**,
  cliente opcional, estado, hora de origen, hora de entrega, cómo se validó
  la entrega
- `Evidencia`: tipo (`ORIGEN_DOCUMENTO` | `ORIGEN_CAPTURA_NATIVA` |
  `ENTREGA_FOTO`), url inmutable, hash (para detectar duplicados), GPS,
  hora del dispositivo, JSON crudo del OCR con confianza por campo
- `Excepcion`: tipo, detalle, estado (`ABIERTA` | `LIBERADA` | `RECHAZADA`),
  quién la resolvió

Campos lógicos del viaje (nombres de negocio pueden variar por vertical:
"obra" vs "tanque" vs "obra de agua", pero las casillas son las mismas):
folio/refs, fecha-hora origen, identificador de unidad, producto, cantidad +
unidad de medida, bruto/tara/neto si aplica, origen y destino, cliente/pedido
si existen, estado, excepciones, evidencias.

## 5. Reglas de negocio ya confirmadas — construir exactamente así

Estas 4 reglas ya se decidieron y no deben re-discutirse ni "mejorarse" sin
preguntar primero:

1. **La entrega siempre es una foto tomada en el destino.** No hay un "visto"
   como paso separado — la foto ES el evento de entrega.
2. **Esa foto se valida de dos formas:**
   - **Automática:** el folio/destino que trae la foto (leído por OCR, p. ej.
     el sello del mismo ticket) coincide con el vale de origen.
   - **Manual:** un humano (`OPS` o `RECIBIDOR`) confirma la entrega a mano
     cuando no hay match automático.
   Se guarda cuál de las dos fue en `Trip.validacionEntrega`.
3. **El destino siempre es obligatorio.** Nunca se concilia ni se factura un
   viaje solo con evidencia de origen.
4. **El GPS es obligatorio en la foto de entrega.** Si la foto llega sin
   coordenadas, el viaje cae en excepción `GPS_FALTANTE` en vez de avanzar a
   `ENTREGADO`. La validación de "¿la foto se tomó en el destino correcto?"
   compara esas coordenadas contra `PadronUbicacion.lat/lng` con un radio de
   tolerancia configurable por ubicación (`radioValidacionM`, default 300m).

Otras reglas automáticas que ya están definidas:

- **Duplicado:** mismo folio o mismo hash de imagen → excepción.
- **Cantidad imposible:** neto mayor a la capacidad de la unidad registrada
  en el padrón → excepción.
- **Timeout sin entrega:** pasó la ventana esperada sin foto de destino →
  excepción.

El OCR **extrae**, las reglas **concilian**. El sistema nunca inventa
cantidad si no hay documento ni segunda medición.

Ya existe una máquina de estados de referencia (TypeScript, sin dependencia
de base de datos, con 9 pruebas cubriendo estos casos) de una sesión previa
— reutilízala como base para el servicio de dominio en vez de reescribir la
lógica desde cero.

## 6. ¿Siempre hay documento de origen? No.

| Origen | Documento típico |
|---|---|
| Cantera/planta con báscula | Sí — vale de pesaje |
| Fábrica, almacén, puerto | Casi siempre — remisión / albarán / packing list |
| México formal | A menudo carta porte, además o en lugar del vale |
| Terminal de líquidos | Ticket de medidor / llenado (no siempre báscula) |
| Acarreo informal / chico | A veces nada — bitácora, WhatsApp |

Si no hay papel, no hay nada que el OCR pueda leer: se usa captura nativa
(formulario con producto/cantidad/destino) + foto de la unidad como respaldo.
Es otro modo de captura, no "OCR mágico".

## 7. Alcance del MVP (wedge agregados)

**Sí entra:**
- Documento de báscula + cierre de entrega según las reglas de §5
- Modo offline (PWA)
- Padrón configurable por tenant
- Motor de excepciones (duplicado, cantidad imposible, timeout, GPS
  faltante, destino no coincide)
- Dashboard de turno en vivo
- Export (Excel / CSV / PDF) de prefactura
- Calibración de OCR por plantilla de documento

**Fuera del día 1 — no construir todavía:**
- Pago automático
- Detector de fraude como producto (las excepciones existen, pero no hay
  "score de fraude")
- Flotilla GPS completa (solo se usa el GPS del momento de la foto)
- Peritaje legal
- Integración con ERP
- OCR genérico "mundial" — se calibra por plantilla, empresa por empresa
- Sustituir medidores fiscales
- Piloto multi-vertical regulado (combustibles/gas)

## 8. Multi-tenant y modelo de negocio

Cada empresa (tenant) tiene su propio padrón; un tenant nunca ve los datos de
otro. Quien decide el contenido del padrón es siempre el cliente. Precio
sugerido: por viaje o por unidad/mes — no por página de OCR, porque el valor
es el viaje conciliado, no la extracción.

KPI que le importan al comprador: días a facturación, % de viajes con
evidencia completa, minutos a corte de turno.

## 9. Orden de expansión (no es MVP, solo contexto)

1. Agregados (wedge actual)
2. Agua o aceites poco regulados
3. Combustibles / gas — alto compliance, no reemplaza medidor fiscal ni
   permisos regulatorios

## 10. Decisiones aún abiertas

No asumir respuesta — preguntar si se vuelven bloqueantes:
- Planta vs. transportista tercero (quién es el dueño del viaje) — no es MVP
- Cuándo activar el modo "sin documento" por tenant — el modelo de datos ya
  lo soporta, falta el criterio de negocio
- Segundo vertical concreto (¿agua, sí o no?) — no bloquea el MVP

## 11. Cómo debe comportarse el agente que construye esto

- Hablar de "viaje" y "documento de carga", no solo de "vale", salvo cuando
  se hable específicamente del wedge de construcción.
- Separar claramente extracción OCR vs. motor de reglas — son capas
  distintas, no las mezcles en un mismo servicio.
- No asumir que toda materia prima tiene ticket — el modo de captura nativa
  es un flujo de primera clase, no un caso especial.
- Multi-tenant desde el primer commit: todo query que toque `Trip` o padrón
  debe ir filtrado por `tenantId`.
- Las reglas de §5 son literales, no una guía — no simplificarlas quitando
  la obligatoriedad del destino o del GPS "para llegar más rápido al MVP".

## 12. Primer paso sugerido

1. Levantar el proyecto (Node + Prisma + PostgreSQL) y correr la primera
   migración a partir del schema existente.
2. Endpoint de captura de origen (`POST /trips`): recibe foto o formulario
   nativo, corre validación de cantidad imposible y de duplicado.
3. Endpoint de entrega (`POST /trips/:id/entrega`): recibe foto + GPS, aplica
   las reglas de §5, decide `ENTREGADO` o `EXCEPCION`.
4. Endpoint/job de conciliación (`POST /trips/:id/conciliar`): revisa que no
   haya excepciones abiertas antes de mover a `CONCILIADO`.
5. Dashboard mínimo: lista de viajes del turno por estado + bandeja de
   excepciones para liberar/rechazar.
