# Despliegue interno hospitalario — Integramécum

## 1. Objetivo

Esta guía describe cómo desplegar Integramécum en un servidor interno del hospital para que el equipo de IT pueda:

- Instalar la aplicación.
- Configurar variables de entorno.
- Preparar PostgreSQL.
- Generar Prisma Client.
- Construir y arrancar la app en modo producción.
- Programar jobs corporativos.
- Definir backups y mantenimiento básico.

La aplicación está construida con:

- Next.js App Router.
- TypeScript.
- Prisma.
- PostgreSQL.
- Jobs HTTP protegidos por `CRON_SECRET`.
- Auth.js/NextAuth con autenticación local.

No hay un proveedor de hosting obligatorio. Puede desplegarse en infraestructura interna, VM, contenedor o plataforma corporativa siempre que cumpla los requisitos.

## 2. Requisitos del servidor

Requisitos mínimos recomendados para un despliegue interno:

- Node.js 20.x.
- npm 10.x o compatible.
- PostgreSQL accesible desde el servidor de aplicación.
- Acceso saliente controlado, si la política del hospital lo permite, para:
  - CIMA.
  - BIFIMED.
  - Descarga del nomenclátor.
  - Proveedor de correo, si se activan notificaciones.
- Almacenamiento persistente para logs, temporales y configuración.
- Servicio interno o supervisor para mantener la app levantada.

Sistemas operativos habituales:

- Linux.
- Windows Server.

Recomendaciones:

- Usar un servidor interno dedicado o semidedicado.
- No desplegar en una carpeta temporal ni en un perfil personal de usuario.
- Separar credenciales por entorno.
- No reutilizar secretos de desarrollo en producción.

## 3. Estructura esperada

Ejemplos de ubicación del proyecto:

```text
/opt/integramecum
```

O en Windows:

```text
C:\apps\integramecum\
```

La carpeta debe contener el código de la aplicación, sus dependencias instaladas, variables de entorno configuradas por IT y los artefactos generados durante build.

## 4. Base de datos PostgreSQL

Crear una base de datos PostgreSQL para Integramécum y un usuario con permisos adecuados sobre esa base.

Ejemplo orientativo, a adaptar por IT:

```sql
CREATE DATABASE integramecum;
CREATE USER integramecum_app WITH PASSWORD 'CAMBIAR_EN_ENTORNO_REAL';
GRANT ALL PRIVILEGES ON DATABASE integramecum TO integramecum_app;
```

No usar la contraseña de ejemplo. Guardar credenciales en el gestor de secretos o mecanismo corporativo correspondiente.

La aplicación espera `DATABASE_URL` con formato PostgreSQL, por ejemplo:

```text
DATABASE_URL="postgresql://integramecum_app:***@db-servidor:5432/integramecum?schema=public"
```

## 5. Variables de entorno

Configurar variables en el mecanismo corporativo elegido: fichero `.env` protegido, variables del servicio, secretos de plataforma o equivalente.

Variables principales:

```text
DATABASE_URL="postgresql://usuario:password@host:5432/integramecum?schema=public"
AUTH_SECRET="CAMBIAR_POR_SECRETO_LARGO_Y_ALEATORIO"
AUTH_URL="https://integramecum.interno.example"
CRON_SECRET="CAMBIAR_POR_SECRETO_LARGO_DE_JOBS"

NOMENCLATOR_ZIP_URL="https://listadomedicamentos.aemps.gob.es/prescripcion.zip"
NOMENCLATOR_XML_PATH="./data/Prescripcion.xml"
NOMENCLATOR_TEMP_DIR="./tmp/nomenclator"

MAIL_FROM="Integramécum <notificaciones@hospital.example>"
RESEND_API_KEY="CONFIGURAR_SOLO_SI_SE_USA_ESTE_PROVEEDOR"
```

Variables opcionales para sobrescribir fuentes externas si IT lo requiere:

```text
CIMA_REST_BASE_URL="https://cima.aemps.es/cima/rest"
BIFIMED_BASE_URL="https://www.sanidad.gob.es/profesionales/medicamentos.do"
```

Buenas prácticas:

- No commitear `.env` con secretos reales.
- Restringir permisos de lectura del fichero de entorno.
- Rotar secretos si se han compartido por canales no seguros.
- Validar conectividad a PostgreSQL antes de arrancar la app.

## 6. Instalación

Desde la carpeta del proyecto:

```bash
npm ci
npx prisma generate
```

`npx prisma generate` crea el cliente Prisma en `generated/postgres-client`. Esa carpeta está ignorada en Git y debe generarse en cada entorno.

## 7. Comprobaciones previas

Ejecutar comprobaciones ligeras antes del build de producción:

```bash
npm run typecheck
npm run test
```

Si el entorno de IT no tiene acceso a dependencias o fuentes externas en ese momento, documentar la limitación y repetir en un entorno con conectividad adecuada.

## 8. Build y arranque

Construir la aplicación:

```bash
npm run build
```

Arrancar en modo producción:

```bash
npm run start
```

Por defecto Next.js escucha en el puerto configurado por `PORT` o en `3000` si no se define. IT puede situar delante un proxy inverso corporativo con TLS, cabeceras y políticas de acceso internas.

## 9. Servicio persistente

La aplicación debe ejecutarse como servicio gestionado por la infraestructura del hospital. Opciones habituales:

- systemd en Linux.
- Servicio Windows.
- PM2 si está aprobado por IT.
- Contenedor gestionado por la plataforma corporativa.
- Orquestador interno.

El servicio debe cargar las variables de entorno y ejecutar el comando de arranque de producción.

## 10. Jobs programados

Los jobs se invocan por HTTP bajo `/api/jobs/*` y requieren `CRON_SECRET`.

Cabecera recomendada:

```http
x-cron-secret: <CRON_SECRET>
```

Endpoints actuales:

- `POST /api/jobs/supply-monitor`
- `POST /api/jobs/nomenclator`
- `POST /api/jobs/cima-cache`
- `POST /api/jobs/bifimed-cache`
- `POST /api/jobs/supply-daily-email-digest`

Ejemplo orientativo:

```bash
curl -X POST \
  -H "x-cron-secret: ${CRON_SECRET}" \
  "https://integramecum.interno.example/api/jobs/supply-monitor"
```

La planificación exacta debe acordarse con Farmacia e IT. Las cachés de CIMA y BIFIMED pueden necesitar cargas progresivas por lotes.

Más detalle en [docs/scheduled-jobs.md](docs/scheduled-jobs.md) y en [CHECKLIST_AUTOMATIZACIONES_HOSPITAL.md](CHECKLIST_AUTOMATIZACIONES_HOSPITAL.md).

## 11. Backups

PostgreSQL contiene la información operativa de Integramécum. IT debe incluir la base de datos en la política corporativa de backups.

Recomendaciones mínimas:

- Backup periódico de PostgreSQL.
- Prueba de restauración documentada.
- Retención acorde a normativa y política interna.
- Backup de configuración de servicio y variables no secretas.
- Custodia segura de secretos en gestor corporativo.

Ejemplo orientativo de backup lógico:

```bash
pg_dump "$DATABASE_URL" > integramecum_backup.sql
```

Ajustar el método a los estándares del hospital.

## 12. Mantenimiento operativo

Tareas recomendadas:

- Revisar `/automatizacion` para ejecuciones fallidas o locks persistentes.
- Revisar `/suministro` para incidencias activas y cambios recientes.
- Controlar uso de disco de logs, temporales y backups.
- Verificar que las cachés CIMA/BIFIMED se están poblando según lo previsto.
- Ejecutar `npx prisma generate` tras cambios de schema o reinstalaciones.
- Mantener Node.js dentro de la versión soportada por el proyecto.

## 13. Seguridad

- Publicar la app solo en red interna o detrás de los controles corporativos definidos.
- No exponer secretos en cliente ni en repositorio.
- Usar HTTPS en accesos internos si la política lo exige.
- Restringir acceso a PostgreSQL al servidor de aplicación y administradores autorizados.
- Rotar `AUTH_SECRET`, `CRON_SECRET` y credenciales si hay sospecha de exposición.
- Revisar altas de usuario y roles `ADMIN` / `LECTURA`.

## 14. Limitaciones conocidas

- Las cachés de CIMA y BIFIMED pueden estar incompletas tras un despliegue inicial hasta ejecutar jobs/backfills.
- La disponibilidad de datos externos depende de fuentes oficiales y conectividad saliente.
- No se deben inventar datos cuando una fuente externa aún no haya sido cacheada.
- La planificación de jobs debe adaptarse a políticas de red y ventanas operativas del hospital.
