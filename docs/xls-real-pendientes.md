# Confirmaciones pendientes con el XLS real de Orion

Este documento deja explicitado qué partes del importador y del modelo funcional deben confirmarse cuando se disponga del fichero real de Orion Logis.

## Objetivo

Preparar la primera iteración sin cerrar supuestos que todavía no están validados por datos reales.

## Invariantes ya fijados

Estas reglas sí se consideran cerradas desde el inicio:

- Solo se tratará como medicamento válido una fila cuyo código cumpla exactamente `^\d{6}\.CNA$`.
- El CN operativo será siempre los 6 dígitos anteriores a `.CNA`.
- Toda fila sin sufijo `.CNA` o con cualquier otra estructura quedará descartada como no medicamentosa.
- No se introducirán excepciones manuales mientras no aparezcan documentadas en exportaciones reales.

## Pendientes de confirmar con el XLS/XLSX real

### 1. Mapeo de columnas

Se debe confirmar:

- qué cabecera contiene el código Orion
- qué cabecera contiene la descripción principal
- si existen columnas adicionales útiles para trazabilidad, familia, estado o ubicación
- si las cabeceras son estables entre exportaciones

### 2. Forma real del fichero

Se debe verificar:

- si el fichero llega en `.xls`, `.xlsx` o ambos
- si hay una sola hoja o varias hojas por exportación
- si la primera fila contiene cabeceras limpias o metadatos previos
- si hay filas vacías, celdas combinadas o formatos mixtos

### 3. Normalización de valores

Se debe revisar:

- si el código Orion llega siempre como texto o a veces como número
- si la descripción contiene espacios, prefijos o sufijos sistemáticos a normalizar
- si aparecen caracteres especiales o codificaciones problemáticas
- si hay duplicados dentro de una misma exportación

### 4. Reglas de descarte y trazabilidad

El sistema debe quedar preparado para registrar al menos:

- motivo de descarte por patrón inválido
- motivo de descarte por valor vacío
- fila original importada para auditoría
- snapshot e importación de origen

## Decisiones de diseño que no deben cerrarse todavía

Hasta tener el fichero real, conviene mantener configurables:

- nombres de columnas
- posición de la fila de cabecera
- hoja a leer
- transformaciones de texto previas a la validación
- reglas secundarias de deduplicación

## Resultado esperado cuando llegue el XLS real

Cuando se reciba la exportación real, la siguiente iteración debería permitir:

1. fijar el contrato de entrada del importador
2. validar el regex contra casos reales
3. ajustar los motivos de descarte observados
4. cerrar el parser definitivo con tests de muestra
5. confirmar si hace falta preservar más columnas en `raw_import_rows`

## Nota de trabajo

Este documento no cambia la regla principal del proyecto; solo delimita qué aspectos siguen abiertos hasta validar el formato real de Orion.
