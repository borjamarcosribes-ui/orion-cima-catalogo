# Jobs programados de Integramécum

Integramécum expone jobs programados como endpoints HTTP bajo `/api/jobs/*`. Están pensados para ser invocados por el programador corporativo del hospital, cron del servidor, un orquestador interno o una tarea equivalente.

## Seguridad de los jobs

Todos los endpoints de jobs requieren `CRON_SECRET` configurado en el entorno.

La llamada debe enviar uno de estos mecanismos:

```http
x-cron-secret: <CRON_SECRET>
```

O bien:

```http
Authorization: Bearer <CRON_SECRET>
```

No se deben publicar ni commitear valores reales de `CRON_SECRET`.

## Trazabilidad, locks e histórico

Los jobs usan la infraestructura común de automatización:

- Registro de ejecuciones en histórico.
- Locks para evitar ejecuciones solapadas del mismo job.
- Estado de finalización y resumen.
- Registro de errores cuando aplica.
- Soporte de `x-idempotency-key` si el cliente desea identificar una ejecución.

El panel `/automatizacion` permite revisar ejecuciones recientes, locks, suscripciones y envíos.

## Endpoints actuales

### `POST /api/jobs/supply-monitor`

Ejecuta el monitor de suministro sobre los medicamentos vigilados.

Uso esperado:

- Programación periódica para detectar cambios de disponibilidad.
- Actualización de estados y eventos de suministro.
- Alimentación de vistas de `/suministro` y digest de email.

### `POST /api/jobs/nomenclator`

Actualiza el nomenclátor local.

Flujo preferente:

1. Descarga el ZIP oficial si `NOMENCLATOR_ZIP_URL` está configurada.
2. Extrae el XML.
3. Importa el contenido reutilizando la lógica existente.
4. Limpia temporales al finalizar.

Fallback:

- Si no se configura `NOMENCLATOR_ZIP_URL`, puede usarse `NOMENCLATOR_XML_PATH` para importar desde un XML local.

Variables relacionadas:

- `NOMENCLATOR_ZIP_URL`
- `NOMENCLATOR_XML_PATH`
- `NOMENCLATOR_TEMP_DIR`

### `POST /api/jobs/cima-cache`

Refresca la caché local de CIMA.

Parámetros opcionales por query string:

- `scope`: alcance de CN a refrescar. Por defecto se orienta a medicamentos vigilados.
- `limit`: número máximo de CN a procesar.
- `offset`: desplazamiento para procesado por lotes.
- `delayMs`: pausa entre consultas para reducir presión sobre la fuente externa.

Variable relacionada:

- `CIMA_REST_BASE_URL`, opcional si se quiere sobrescribir la URL base por defecto.

### `POST /api/jobs/bifimed-cache`

Refresca la caché local de BIFIMED para los CN del catálogo.

Parámetros opcionales por query string:

- `limit`: número máximo de CN a procesar.
- `offset`: desplazamiento para backfills por lotes.
- `delayMs`: pausa entre consultas.

Variable relacionada:

- `BIFIMED_BASE_URL`, opcional si se quiere sobrescribir la URL base por defecto.


### `POST /api/jobs/unit-dose-cache`

Refresca la caché local de dosis unitaria de SCMFH. Descarga un Excel de medicamentos activos, reutiliza el importador manual de unidosis y actualiza `unit_dose_cache` por CN.

El job no borra datos previos si falla la descarga o la importación; el error queda trazado en el histórico común de jobs. La sincronización completa de CN ausentes queda fuera de esta automatización inicial.

Fuente del Excel:

1. Si `SCMFH_UNIT_DOSE_XLS_URL` está configurada, descarga esa URL directa.
2. Si no, usa `SCMFH_UNIT_DOSE_PAGE_URL` para descubrir el primer enlace razonable a `.xls` o `.xlsx`.

Variables relacionadas:

- `SCMFH_UNIT_DOSE_XLS_URL`
- `SCMFH_UNIT_DOSE_PAGE_URL`
- `SCMFH_UNIT_DOSE_TEMP_DIR`

Frecuencia recomendada: semanal, salvo indicación distinta de Farmacia o IT según la cadencia real de publicación de SCMFH.

### `POST /api/jobs/supply-daily-email-digest`

Envía el digest diario de incidencias de suministro a suscripciones activas.

Parámetros opcionales por query string:

- `email`: limita el envío a una suscripción concreta.
- `lookbackHours`: ventana retrospectiva cuando una suscripción no tiene `lastSentAt`; por defecto se usa una ventana diaria.

Variables relacionadas:

- `MAIL_FROM`
- `RESEND_API_KEY`

## Ejemplo de invocación

```bash
curl -X POST \
  -H "x-cron-secret: ${CRON_SECRET}" \
  "https://integramecum.interno.example/api/jobs/supply-monitor"
```

Ajustar la URL al dominio interno real. No incluir secretos reales en documentación, tickets o repositorios.

## Planificación recomendada

La frecuencia exacta debe validarse con IT y Farmacia según disponibilidad de fuentes externas y necesidades operativas. Como criterio general:

- Monitor de suministro: periódico, al menos diario si el entorno lo permite.
- Nomenclátor: según publicación oficial y política interna.
- Caché CIMA/BIFIMED: carga progresiva y refrescos controlados.
- Caché SCMFH unidosis: refresco semanal.
- Digest diario: una vez al día, alineado con la jornada operativa.

## Checklist operativo

Para puesta en producción y validación hospitalaria, revisar también [CHECKLIST_AUTOMATIZACIONES_HOSPITAL.md](../CHECKLIST_AUTOMATIZACIONES_HOSPITAL.md).
