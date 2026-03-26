# Checklist operativo de automatizaciones — Integramécum

## 1. Objetivo

Este documento resume qué automatizaciones deben quedar programadas en el entorno interno del hospital, con qué frecuencia, qué endpoint deben invocar y qué validaciones mínimas deben realizarse.

---

## 2. Requisitos previos

Antes de activar automatizaciones, verificar:

* la aplicación arranca correctamente en producción
* la base de datos está sincronizada
* Prisma Client está generado
* el archivo `.env` está configurado
* `CRON_SECRET` está definido
* la app responde en la URL interna prevista
* el envío de correo funciona correctamente
* existen, si procede, suscripciones configuradas en `/automatizacion`

---

## 3. Cabecera obligatoria para todos los jobs

Todos los jobs HTTP deben invocarse con esta cabecera:

```http
x-cron-secret: TU_CRON_SECRET
```

---

## 4. Automatizaciones a programar

## 4.1. Monitor AEMPS / CIMA

### Objetivo

Actualizar el estado de problemas de suministro y registrar eventos:

* `NEW_ISSUE`
* `CHANGED`
* `RESOLVED`

### Endpoint

```text
POST /api/jobs/supply-monitor
```

### Frecuencia recomendada

3 veces al día.

### Horario recomendado

* 08:00
* 14:00
* 20:00

### Resultado esperado

* actualización de `supply_statuses`
* creación de eventos en `supply_monitoring_events`
* nueva ejecución visible en `/automatizacion`
* actualización visible en `/suministro`

---

## 4.2. Digest diario por email

### Objetivo

Enviar a los destinatarios configurados un resumen de cambios en problemas de suministro de las últimas 24 horas.

### Endpoint

```text
POST /api/jobs/supply-daily-email-digest
```

### Frecuencia recomendada

1 vez al día.

### Horario recomendado

* 07:00

### Requisitos adicionales

* `MAIL_FROM` configurado
* `RESEND_API_KEY` válida
* al menos una suscripción activa en `/automatizacion`

### Resultado esperado

* registro en `supply_notification_runs`
* actualización de `lastSentAt` en suscripciones exitosas
* recepción del correo por los destinatarios

---

## 4.3. Actualización del nomenclátor de prescripción

### Objetivo

Descargar el ZIP oficial, descomprimirlo y cargar `Prescripcion.xml` en la base local.

### Endpoint

```text
POST /api/jobs/nomenclator
```

### Frecuencia recomendada

1 vez al día.

### Horario recomendado

* 03:30

### Requisitos adicionales

* `NOMENCLATOR_ZIP_URL` configurada
* acceso saliente a la URL oficial
* `NOMENCLATOR_TEMP_DIR` accesible en disco

### Resultado esperado

* actualización de `nomenclator_products`
* ejecución registrada en `/automatizacion`

---

## 4.4. Refresco CIMA watched

### Objetivo

Actualizar en caché CIMA los CN vigilados / prioritarios.

### Endpoint

```text
POST /api/jobs/cima-cache?scope=watched&limit=5000
```

### Frecuencia recomendada

1 vez al día como mínimo.

### Horario recomendado

* 05:00

### Resultado esperado

* refresco de `cima_cache`
* refresco de `cima_characteristic_cache`
* documentación CIMA disponible en fichas
* ejecución registrada en `/automatizacion`

---

## 4.5. Refresco CIMA completo

### Objetivo

Actualizar toda la caché CIMA del catálogo por lotes.

### Endpoint base

```text
POST /api/jobs/cima-cache?scope=all&limit=1000&offset=N
```

### Frecuencia recomendada

semanal o en ventana nocturna ampliada

### Propuesta operativa

Lanzar por lotes de 1000 en cadena.

### Ejemplos

```text
POST /api/jobs/cima-cache?scope=all&limit=1000&offset=0
POST /api/jobs/cima-cache?scope=all&limit=1000&offset=1000
POST /api/jobs/cima-cache?scope=all&limit=1000&offset=2000
POST /api/jobs/cima-cache?scope=all&limit=1000&offset=3000
...
```

### Horario recomendado

* madrugada de sábado o domingo
* o ventana nocturna amplia entre 00:00 y 06:00

### Resultado esperado

* alta cobertura de `cima_cache`
* alta cobertura de `leafletHtmlUrl`
* alta cobertura de `cima_characteristic_cache`

---

## 4.6. Refresco BIFIMED completo

### Objetivo

Actualizar financiación BIFIMED e indicaciones por CN.

### Endpoint base

```text
POST /api/jobs/bifimed-cache
```

### Si el endpoint admite parámetros

usar lotes con `limit`, `offset` y, si procede, `delayMs`.

### Frecuencia recomendada

1 vez por semana

### Horario recomendado

* fin de semana
* preferiblemente de madrugada

### Resultado esperado

* actualización de `bifimed_cache`
* actualización de `bifimed_indication_cache`
* mejora de financiación e indicaciones en `/catalogo/[cn]`

---

## 5. Orden recomendado diario

### Madrugada

1. nomenclátor
2. CIMA watched

### Primera hora de la mañana

3. digest diario por email

### Durante el día

4. monitor AEMPS / CIMA a las 08:00, 14:00 y 20:00

### Fin de semana / ventana larga

5. CIMA completo
6. BIFIMED completo

---

## 6. Recomendación de secuencia para evitar solapes

No lanzar jobs pesados a la vez.

### Secuencia recomendada

* 03:30 nomenclátor
* 05:00 CIMA watched
* 07:00 digest diario
* 08:00 monitor
* 14:00 monitor
* 20:00 monitor
* sábado 01:00 en adelante CIMA all por lotes
* domingo 01:00 en adelante BIFIMED all

---

## 7. Comprobaciones tras cada automatización

## 7.1. Monitor AEMPS / CIMA

Comprobar:

* nueva ejecución en `/automatizacion`
* resumen correcto en `/suministro`
* eventos recientes visibles
* roturas activas coherentes

## 7.2. Digest diario por email

Comprobar:

* nueva ejecución en `/automatizacion`
* nuevo registro en “Últimos envíos de notificaciones”
* correo recibido
* `status=sent` o `failed` visible

## 7.3. Nomenclátor

Comprobar:

* ejecución registrada
* resumen con procesados / actualizados / descartados
* catálogo operativo accesible

## 7.4. CIMA watched / CIMA all

Comprobar:

* ejecución registrada
* resumen con `updated`, `notFound`, `failed`
* fichas con documentación CIMA
* características CIMA visibles

## 7.5. BIFIMED

Comprobar:

* ejecución registrada
* fichas con resumen BIFIMED
* indicaciones BIFIMED visibles cuando existan

---

## 8. Gestión de errores

## 8.1. Si el endpoint responde `401 Unauthorized`

Revisar:

* cabecera `x-cron-secret`
* valor de `CRON_SECRET` en el servidor

## 8.2. Si el endpoint responde `409` o `skipped_locked`

Interpretación:

* ya hay una ejecución previa en curso
* no duplicar el job
* reprogramar con margen

## 8.3. Si el job completa con errores

Revisar:

* `/automatizacion`
* resumen de ejecución
* bloque de errores
* conectividad saliente a servicios externos

## 8.4. Si falla el digest de email

Revisar:

* `MAIL_FROM`
* `RESEND_API_KEY`
* suscripciones activas
* errores en `supply_notification_runs`

---

## 9. Comandos de prueba manual

## Monitor

```bash
curl -X POST "http://localhost:3000/api/jobs/supply-monitor" -H "x-cron-secret: TU_CRON_SECRET"
```

## Digest diario

```bash
curl -X POST "http://localhost:3000/api/jobs/supply-daily-email-digest" -H "x-cron-secret: TU_CRON_SECRET"
```

## Nomenclátor

```bash
curl -X POST "http://localhost:3000/api/jobs/nomenclator" -H "x-cron-secret: TU_CRON_SECRET"
```

## CIMA watched

```bash
curl -X POST "http://localhost:3000/api/jobs/cima-cache?scope=watched&limit=50" -H "x-cron-secret: TU_CRON_SECRET"
```

## CIMA all por lote

```bash
curl -X POST "http://localhost:3000/api/jobs/cima-cache?scope=all&limit=1000&offset=0" -H "x-cron-secret: TU_CRON_SECRET"
```

## BIFIMED

```bash
curl -X POST "http://localhost:3000/api/jobs/bifimed-cache?limit=200&offset=0&delayMs=200" -H "x-cron-secret: TU_CRON_SECRET"
```

---

## 10. Checklist final de activación en producción interna

* [ ] `.env` configurado
* [ ] app arranca con `npm run build` y `npm run start`
* [ ] base de datos sincronizada
* [ ] jobs manuales probados
* [ ] correo probado con éxito
* [ ] suscripciones de email cargadas
* [ ] scheduler corporativo configurado
* [ ] verificados locks y ejecuciones en `/automatizacion`
* [ ] validado panel `/suministro`
* [ ] validado catálogo `/catalogo`
* [ ] estrategia de backup definida

---

## 11. Responsable funcional

Responsable funcional recomendado:

* Servicio de Farmacia Hospitalaria

Responsable técnico recomendado:

* IT / Sistemas del hospital
