# Integramécum

Integramécum es una aplicación operativa para Farmacia Hospitalaria. Unifica el catálogo local de Orion/TSV con nomenclátor, CIMA, BIFIMED, monitor de suministro y automatización de jobs para ofrecer una visión diaria por Código Nacional (CN).

La aplicación está pensada para uso interno hospitalario por perfiles de Farmacia e IT: Farmacia obtiene un catálogo consultable y trazable, e IT dispone de una base mantenible, desplegable y automatizable.

## Estado actual

La aplicación ya está consolidada como app Next.js App Router con:

- Catálogo integrado por CN.
- Detalle de medicamento por CN.
- Importación manual de catálogo Orion en `.tsv`.
- Monitor de problemas de suministro en `/suministro`.
- Área de automatización independiente en `/automatizacion`.
- Actualización manual y automática del nomenclátor.
- Caché local de CIMA.
- Caché local de BIFIMED.
- Jobs HTTP con locks, trazabilidad e histórico.
- Notificaciones diarias por email para incidencias de suministro.
- Autenticación local con Auth.js/NextAuth y roles `ADMIN` / `LECTURA`.

> Nota operativa: las cachés locales de CIMA y BIFIMED pueden no estar plenamente pobladas hasta ejecutar sus jobs/backfills correspondientes.

## Stack técnico

- Next.js 15 con App Router.
- React 19.
- TypeScript.
- Prisma.
- PostgreSQL como base de datos objetivo actual.
- Prisma Client generado en `generated/postgres-client`.
- Auth.js/NextAuth con credenciales locales.
- Vitest.

`generated/` está ignorado en Git; cada entorno debe regenerar el cliente Prisma durante la instalación o despliegue.

## Instalación rápida para desarrollo

Requisitos recomendados:

- Node.js 20.x.
- npm 10.x o compatible.
- PostgreSQL accesible desde el entorno local.

Pasos habituales:

```bash
npm ci
npx prisma generate
npm run typecheck
npm run test
npm run build
```

Para desarrollo local:

```bash
npm run dev
```

La base de datos debe estar configurada mediante `DATABASE_URL` apuntando a PostgreSQL antes de ejecutar Prisma o arrancar la aplicación.

## Variables de entorno principales

No se deben commitear secretos reales. Configurar cada entorno con valores propios:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión PostgreSQL usada por Prisma. |
| `AUTH_SECRET` | Secreto de Auth.js/NextAuth para sesiones y firma. |
| `AUTH_URL` | URL pública o interna de la aplicación en el entorno. |
| `CRON_SECRET` | Secreto compartido para proteger endpoints programados generales `/api/jobs/*`. |
| `ADMIN_API_KEY` | API key temporal para operaciones internas sensibles de importación/sincronización; se envía con `X-Admin-API-Key`. |
| `NOMENCLATOR_ZIP_URL` | URL del ZIP oficial del nomenclátor, si se usa descarga automática. |
| `NOMENCLATOR_XML_PATH` | Ruta local de fallback para importar XML del nomenclátor. |
| `NOMENCLATOR_TEMP_DIR` | Directorio temporal para descarga/extracción del nomenclátor. |
| `CIMA_REST_BASE_URL` | Base URL de CIMA REST; tiene valor por defecto si no se configura. |
| `BIFIMED_BASE_URL` | Base URL de BIFIMED; tiene valor por defecto si no se configura. |
| `MAIL_FROM` | Remitente de notificaciones de suministro. |
| `RESEND_API_KEY` | API key del proveedor de correo, si se activan emails. |

## Comandos útiles

```bash
npm ci
npx prisma generate
npm run typecheck
npm run test
npm run build
```

También existen scripts específicos, como `npm run import:nomenclator`, para operaciones de carga manual del nomenclátor cuando proceda.

## Módulos principales

### Importaciones Orion/TSV

Ruta: `/importaciones`

Permite cargar un `.tsv` exportado desde Orion Logis, parsear y validar el contenido, mostrar warnings/errores, guardar la importación y consultar el histórico.

La importación de TSV actualiza la base operativa local y alimenta el universo de medicamentos vigilados.

### Catálogo integrado

Rutas:

- `/catalogo`
- `/catalogo/[cn]`

Permite buscar por CN, nombre, principio activo, laboratorio y ATC; cruzar información de nomenclátor, CIMA, BIFIMED y Orion; y abrir la ficha de detalle de cada CN.

### Suministro

Ruta: `/suministro`

Módulo estabilizado para consultar roturas activas, revisar eventos recientes, ver resumen del último monitor, exportar incidencias y consultar alternativas equivalentes.

### Automatización

Ruta: `/automatizacion`

Módulo separado de `/suministro` para revisar histórico de jobs, locks activos, ejecuciones recientes, suscripciones de email y últimos envíos de notificaciones.

### Dashboard

Ruta: `/`

Muestra una visión general del estado operativo: productos incluidos, roturas activas, métricas por estado hospitalario, antigüedad media de incidencias y productos con más tiempo en rotura.

## Autenticación y permisos

La autenticación es local, con usuarios almacenados en PostgreSQL y gestionados por Auth.js/NextAuth.

Roles disponibles:

- `LECTURA`: consulta dashboard, catálogo, detalle, suministro y automatización; también puede importar y guardar ficheros `.tsv` de Orion.
- `ADMIN`: incluye lo anterior y puede ejecutar acciones administrativas como jobs manuales y gestión de suscripciones.

Rutas públicas necesarias:

- `/login`
- `/registro`
- `/api/auth/*`
- `/api/jobs/*` únicamente para llamadas protegidas por secreto de cron.

## Reglas funcionales estables

- La unidad principal del catálogo es el CN.
- “Incluido en hospital” = Sí si el CN aparece en Orion/TSV.
- El estado hospitalario debe mostrarse tal cual viene de Orion.
- El código Orion no se muestra en el listado del catálogo; solo se muestra en la ficha del medicamento.
- La caché local se usa para CIMA/BIFIMED para evitar depender de llamadas en tiempo real por cada fila de tabla.
- Los datos externos pueden requerir carga progresiva mediante jobs/backfills.

## Estructura del proyecto

```txt
app/                 Rutas App Router, pantallas y Server Actions
app/api/jobs/        Endpoints HTTP protegidos para jobs programados
components/          Componentes compartidos
lib/                 Lógica de negocio, integraciones, auth, jobs y utilidades
prisma/              Schema Prisma para PostgreSQL
scripts/             Scripts de importación/backfill y utilidades manuales
tests/               Tests del parser, importadores y lógica de dominio
types/               Extensiones de tipos
auth.ts              Configuración central de Auth.js/NextAuth
middleware.ts        Protección de rutas
generated/           Prisma Client generado localmente, ignorado en Git
```

## Jobs y automatizaciones

Los jobs HTTP están bajo `/api/jobs/*`. Las sincronizaciones sensibles de CIMA y BIFIMED (`/api/jobs/cima-cache` y `/api/jobs/bifimed-cache`) requieren `ADMIN_API_KEY` y la cabecera `X-Admin-API-Key`. El resto de jobs programados mantiene `CRON_SECRET` con `x-cron-secret` o `Authorization: Bearer <CRON_SECRET>`.

Ver detalle en [docs/scheduled-jobs.md](docs/scheduled-jobs.md) y el checklist operativo en [CHECKLIST_AUTOMATIZACIONES_HOSPITAL.md](CHECKLIST_AUTOMATIZACIONES_HOSPITAL.md).

## Trabajo con GitHub/Codex

- `main` se considera rama protegida.
- Trabajar en ramas cortas y descriptivas.
- Abrir PRs pequeñas y revisables contra `main`.
- Mantener CI en verde antes de fusionar.
- Evitar mezclar cambios funcionales con cambios de documentación.
- No commitear secretos, volcados de base de datos ni artefactos generados como `generated/`.

## Documentación relacionada

- [Arquitectura](docs/architecture.md)
- [Jobs programados](docs/scheduled-jobs.md)
- [Despliegue hospitalario](DEPLOY_HOSPITAL.md)
- [Checklist de automatizaciones hospitalarias](CHECKLIST_AUTOMATIZACIONES_HOSPITAL.md)
