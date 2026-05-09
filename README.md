# Integramécum

Aplicación operativa para Farmacia Hospitalaria que unifica catálogo local Orion/TSV, nomenclátor, CIMA, BIFIMED, monitor de suministro y automatización de jobs.

## Estado actual

La aplicación ya está operativa en entorno local con:

- catálogo integrado por CN
- detalle de producto
- importación manual de catálogo Orion en `.tsv`
- monitor de problemas de suministro
- actualización manual y automática del nomenclátor
- caché local de CIMA
- caché local de BIFIMED
- panel de automatización con histórico de ejecuciones
- notificaciones diarias por email
- autenticación local con roles

## Stack

- Next.js 15
- React 19
- TypeScript
- Prisma
- SQLite en local
- NextAuth/Auth.js con credenciales locales
- Vitest

## Módulos principales

### 1. Importaciones Orion

Ruta: `/importaciones`

Permite:

- cargar un fichero `.tsv` exportado desde Orion Logis
- parsear y validar el contenido
- mostrar warnings y errores
- previsualizar los artículos válidos
- guardar la importación en base de datos
- consultar el histórico de importaciones

La importación de TSV actualiza la base operativa local y alimenta el universo de medicamentos vigilados.

### 2. Catálogo integrado

Rutas:

- `/catalogo`
- `/catalogo/[cn]`

Permite:

- buscar por CN, nombre, principio activo, laboratorio y ATC
- cruzar información de nomenclátor, CIMA, BIFIMED y Orion
- ver si un CN está incluido en el hospital
- ver el estado hospitalario real según Orion
- abrir la ficha de detalle de cada CN

### 3. Suministro

Ruta: `/suministro`

Permite:

- consultar roturas activas
- revisar eventos recientes
- ver el resumen del último monitor
- exportar incidencias a CSV
- consultar alternativas equivalentes
- ejecutar manualmente:
  - monitor AEMPS/CIMA
  - actualización de nomenclátor

### 4. Automatización

Ruta: `/automatizacion`

Permite:

- ver histórico de jobs
- ver locks activos
- revisar ejecuciones recientes
- gestionar suscripciones de email
- consultar últimos envíos de notificaciones

### 5. Dashboard

Ruta: `/`

Muestra una visión general del estado operativo:

- número de productos incluidos
- roturas activas
- métricas por estado hospitalario
- antigüedad media de incidencias
- productos con más tiempo en rotura

## Autenticación y permisos

La aplicación usa autenticación local con usuarios almacenados en base de datos.

### Rutas públicas

- `/login`
- `/api/auth/*`
- `/api/jobs/*`

### Roles

#### LECTURA

Puede:

- iniciar sesión
- consultar dashboard
- consultar catálogo y detalle
- consultar suministro
- consultar automatización
- importar y guardar ficheros `.tsv` de Orion

No puede:

- ejecutar manualmente el monitor de suministro
- ejecutar manualmente la actualización de nomenclátor
- gestionar suscripciones de automatización

#### ADMIN

Puede hacer todo lo anterior y además:

- ejecutar monitor manual
- ejecutar actualización manual del nomenclátor
- crear, activar, desactivar y eliminar suscripciones de email

## Reglas funcionales relevantes

- La unidad principal del catálogo es el CN.
- “Incluido en hospital” = Sí si el CN aparece en Orion/TSV.
- El “Estado hospitalario” se muestra tal cual venga de Orion.
- El código Orion no se muestra en el listado del catálogo, pero sí en la ficha detallada.
- BIFIMED en listado se muestra como resumen corto.
- La ficha detallada del producto vive en `/catalogo/[cn]`.

## Estructura del proyecto

```txt
app/                 Rutas App Router y UI principal
app/api/jobs/        Endpoints protegidos para jobs programados
components/          Componentes compartidos
lib/                 Lógica de negocio, integración, auth, jobs y utilidades
prisma/              Schema Prisma
scripts/             Scripts de backfill y utilidades manuales
tests/               Tests del parser/importador
types/               Extensiones de tipos
auth.ts              Configuración central de Auth.js
middleware.ts        Protección de rutas