# Arquitectura de Integramécum

Integramécum es una aplicación interna para Farmacia Hospitalaria basada en Next.js App Router, TypeScript, Prisma y PostgreSQL. Su objetivo operativo es construir un catálogo por Código Nacional (CN) a partir de Orion/TSV y enriquecerlo con nomenclátor, CIMA, BIFIMED y monitorización de suministro.

## Principios de arquitectura

- La unidad principal del catálogo es el CN.
- PostgreSQL es la base de datos objetivo actual.
- Prisma centraliza el acceso relacional y genera el cliente en `generated/postgres-client`.
- La lógica crítica vive en servidor: Server Actions, endpoints API y módulos de `lib/`.
- Las integraciones externas se cachean localmente para no hacer depender listados de llamadas en tiempo real.
- Los jobs programados usan endpoints HTTP protegidos, locks, trazabilidad e histórico.
- `/suministro` y `/automatizacion` son módulos separados.

## Estructura del repositorio

```txt
app/                 Rutas App Router, páginas, layouts y Server Actions
app/api/jobs/        Endpoints HTTP para jobs programados
components/          Componentes UI compartidos
lib/                 Dominio, integraciones, persistencia, auth y jobs
prisma/              Schema Prisma para PostgreSQL
scripts/             Scripts manuales de importación/backfill/mantenimiento
tests/               Tests automatizados de parsers y lógica de negocio
types/               Tipos auxiliares y extensiones
generated/           Prisma Client generado localmente; ignorado en Git
```

### `app/`

Contiene la interfaz y las acciones de servidor:

- `/`: dashboard operativo.
- `/importaciones`: carga manual de TSV de Orion.
- `/catalogo`: catálogo integrado por CN.
- `/catalogo/[cn]`: ficha de medicamento.
- `/suministro`: monitor de suministro estabilizado.
- `/automatizacion`: revisión de jobs, locks, suscripciones y envíos.
- `/login`, `/registro`, `/usuarios`: autenticación y gestión de usuarios según rol.

### `app/api/jobs/`

Expone jobs programables por HTTP. Todos requieren secreto de cron y ejecutan lógica de servidor con trazabilidad:

- `supply-monitor`
- `nomenclator`
- `cima-cache`
- `bifimed-cache`
- `supply-daily-email-digest`

### `lib/`

Agrupa la lógica de dominio y las integraciones:

- Importadores Orion/TSV y utilidades de cabeceras.
- Consultas de catálogo integrado.
- Integración CIMA y caché local.
- Integración BIFIMED y caché local.
- Actualización/importación de nomenclátor.
- Monitor de suministro y alternativas.
- Automatización de jobs, locks e histórico.
- Autorización, correo y acceso Prisma.

### `prisma/`

Define el modelo relacional. El datasource actual es PostgreSQL y el cliente Prisma se genera en `generated/postgres-client`.

Conceptos funcionales representados en el modelo:

- Importaciones y filas crudas.
- Snapshot y maestro de medicamentos.
- Catálogo TSV Orion y medicamentos vigilados.
- Caché CIMA.
- Caché BIFIMED.
- Nomenclátor.
- Alertas y eventos de suministro.
- Jobs programados, locks y runs.
- Suscripciones y envíos de email.
- Usuarios, roles y estado de aprobación.

### `scripts/`

Contiene utilidades manuales para cargas o backfills. Deben ejecutarse con variables de entorno válidas y acceso a PostgreSQL.

### `tests/`

Contiene pruebas automatizadas de parsers, importadores y lógica de negocio. El comando principal es `npm run test`.

## Módulos funcionales

### Importaciones Orion/TSV

El módulo de importaciones permite cargar exportaciones `.tsv` de Orion Logis. El parser valida filas, separa avisos/errores y persiste importaciones con trazabilidad.

Reglas relevantes:

- El CN extraído del catálogo Orion/TSV alimenta el catálogo operativo.
- “Incluido en hospital” se calcula como Sí cuando el CN aparece en Orion/TSV.
- El estado hospitalario se conserva y muestra tal cual viene de Orion.
- El código Orion no se muestra en el listado de catálogo, pero sí en la ficha de detalle.

También existe lógica histórica/preparada para importaciones tipo XLS/XLSX con validación estricta de códigos `XXXXXX.CNA`; esa regla sigue siendo la referencia para filas medicamentosas cuando se trabaje con ese formato.

### Catálogo por CN

El catálogo cruza fuentes locales por CN:

- Orion/TSV para inclusión hospitalaria y estado hospitalario.
- Nomenclátor para datos oficiales estructurados.
- CIMA para ficha oficial, estado de comercialización, ATC, laboratorio y enlaces documentales.
- BIFIMED para financiación e indicaciones cacheadas.
- Suministro para incidencias activas y eventos recientes.

### Suministro

El módulo `/suministro` consulta medicamentos vigilados, estados de suministro y eventos. Está estabilizado y no debe mezclarse con el panel de automatización.

### Automatización

El módulo `/automatizacion` permite revisar ejecuciones de jobs, locks activos, suscripciones de email y envíos de digest. Es la zona operativa para IT/Farmacia cuando se supervisan tareas programadas.

### Nomenclátor

El job de nomenclátor puede descargar un ZIP oficial si se configura `NOMENCLATOR_ZIP_URL`, extraer el XML y actualizar la tabla local. También mantiene un fallback mediante `NOMENCLATOR_XML_PATH` cuando se trabaje con XML local.

### CIMA cache

La caché CIMA guarda información oficial por CN para acelerar consultas y evitar llamadas en tiempo real por cada fila de catálogo. Puede requerir ejecución progresiva del job de caché para poblar todos los CN.

### BIFIMED cache

La caché BIFIMED guarda información de financiación, condiciones e indicaciones por CN. Igual que CIMA, puede no estar completa hasta ejecutar jobs/backfills.

### Autenticación

La autenticación es local con Auth.js/NextAuth y usuarios en base de datos. Los roles principales son:

- `ADMIN`: permisos completos, incluida ejecución de acciones administrativas.
- `LECTURA`: acceso de consulta y carga operativa según flujos habilitados.

## Jobs, locks e histórico

Los jobs programados se implementan como endpoints HTTP protegidos. La infraestructura común:

- Valida `CRON_SECRET`.
- Registra cada ejecución.
- Usa locks para evitar solapamientos.
- Guarda estado, resumen y errores.
- Permite idempotencia mediante `x-idempotency-key` cuando el cliente lo envía.

La documentación específica está en [scheduled-jobs.md](scheduled-jobs.md).

## Limitaciones actuales

- Las cachés CIMA y BIFIMED pueden requerir carga progresiva; no debe asumirse que estén completas en un entorno recién desplegado.
- Los datos externos dependen de disponibilidad y formato de fuentes oficiales.
- No se deben inventar datos CIMA/BIFIMED cuando una caché esté vacía.
- Las variables de entorno y credenciales son responsabilidad de cada entorno de despliegue.
- El cliente Prisma generado no se versiona; debe regenerarse con `npx prisma generate`.
