# Scheduled jobs MVP

## Estado actual del job del Nomenclátor

En esta iteración, el job del Nomenclátor prioriza la **descarga automática del ZIP oficial** cuando se configura `NOMENCLATOR_ZIP_URL`.

Flujo preferente:
- descarga `prescripcion.zip`
- extrae `Prescripcion.xml`
- importa el XML reutilizando la lógica existente
- limpia temporales al finalizar

Fallback mantenido:
- si `NOMENCLATOR_ZIP_URL` no está configurada, el job sigue funcionando con `NOMENCLATOR_XML_PATH`
- esto permite seguir ejecutándolo contra un XML local ya disponible en disco

La infraestructura de jobs, locks y endpoints HTTP sigue siendo la misma. Cambia solo la preparación de la fuente de datos del Nomenclátor.

## Variables relevantes

- `CRON_SECRET`
- `NOMENCLATOR_ZIP_URL`
- `NOMENCLATOR_XML_PATH`
- `NOMENCLATOR_TEMP_DIR`