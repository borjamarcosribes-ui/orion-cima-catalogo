# orion-cima-catalogo
# Catálogo operativo de Farmacia desde Orion + CIMA

## Objetivo

Construir una web app interna para Farmacia Hospitalaria que permita cargar manualmente exportaciones de Orion Logis, filtrar solo medicamentos reales, extraer su Código Nacional (CN), guardar cada carga como un snapshot histórico y enriquecer los medicamentos con información oficial de CIMA, incluyendo problemas de suministro.

La app NO trabajará inicialmente con la GFT formal, porque no está actualizada. El núcleo funcional será un catálogo operativo construido a partir de productos activos exportados desde Orion Logis.

## Regla principal de negocio

En Orion Logis, los medicamentos vienen identificados con un código con esta estructura exacta:

`XXXXXX.CNA`

donde `XXXXXX` son los 6 dígitos del Código Nacional.

### Regla de validación
Solo se considerarán medicamentos válidos las filas cuyo código cumpla exactamente esta expresión regular:

`^\d{6}\.CNA$`

### Consecuencias
- Si una fila cumple el patrón, se considera medicamento válido.
- El CN utilizable será solo los 6 dígitos anteriores a `.CNA`.
- Todo lo que no cumpla ese patrón debe descartarse automáticamente.
- Los registros sin `.CNA` se consideran productos no medicamentosos y quedan fuera del catálogo.

## Flujo funcional previsto

1. Subida manual de fichero XLS/XLSX exportado desde Orion Logis.
2. Lectura de filas del Excel.
3. Identificación de la columna del código Orion.
4. Aplicación de la regla `^\d{6}\.CNA$`.
5. Extracción del CN.
6. Descarte de filas no válidas.
7. Guardado de la importación como snapshot histórico.
8. Comparación contra la importación anterior.
9. Enriquecimiento de los CN válidos con información de CIMA.
10. Visualización del catálogo operativo y de incidencias de suministro.

## Fuentes de datos

### Fuente principal local
- Exportaciones manuales de Orion Logis en formato XLS/XLSX.

### Fuente externa oficial
- CIMA, como fuente oficial externa para:
  - nombre oficial
  - principio activo
  - ATC
  - laboratorio
  - estado/comercialización si aplica
  - VMP / VMPP si aplica
  - problemas de suministro

## Alcance inicial (MVP)

La primera versión debe incluir:

- carga manual de XLS/XLSX
- filtrado de medicamentos por patrón `XXXXXX.CNA`
- extracción del CN
- almacenamiento por snapshots
- comparación entre cargas
- enriquecimiento con CIMA
- visualización de incidencias de suministro
- interfaz clara para escritorio y móvil

## Arquitectura deseada

Se busca una app web moderna, mantenible y rápida.

Preferencias:
- frontend: React o Next.js
- backend: API routes / serverless / edge functions
- base de datos: PostgreSQL o Supabase
- autenticación simple
- diseño responsive
- posibilidad futura de PWA

## Enfoque de integración con CIMA

La API de CIMA será la fuente externa de verdad.

No se desea depender de llamadas en vivo para pintar tablas completas si eso degrada el rendimiento.

Se prefiere una estrategia híbrida:
- persistencia o caché local para búsquedas, filtros, histórico y cruces
- consultas puntuales en vivo solo cuando tenga sentido

## Modelo conceptual de datos

### import_batches
Una fila por cada importación de Orion.

### raw_import_rows
Cada fila del Excel tal como se ha cargado, incluyendo si fue válida o descartada.

### medicines_snapshot
Medicamentos válidos detectados en una importación concreta.

### medicines_master
Catálogo consolidado por CN a lo largo del tiempo.

### cima_cache
Información enriquecida obtenida de CIMA.

### supply_alerts
Incidencias de suministro detectadas para CN concretos.

### local_annotations
Notas, criticidad y observaciones locales del servicio.

## Vistas previstas

- Dashboard
- Importaciones
- Catálogo operativo
- Detalle del medicamento
- Cambios entre cargas
- Administración / validación

## Estado actual del proyecto

Pendiente de confirmar con el fichero real de Orion:
- nombres exactos de las columnas
- estructura exacta del XLS/XLSX
- posibles excepciones de formato
- campos adicionales útiles para conservar

## Criterios de diseño

- No usar Power Apps
- No asumir una GFT formal actualizada
- No inventar aún columnas definitivas del Excel
- No exponer secretos en frontend
- Mantener el código limpio y modular
- Diseñar el importador con mapeo configurable de columnas

## Próximo paso

Cuando se disponga del XLS real de Orion:
- cerrar el parser
- fijar el mapeo de columnas
- validar casos reales
- afinar reglas de importación
