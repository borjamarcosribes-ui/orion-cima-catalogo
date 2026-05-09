# Tercera iteración del catálogo Orion + CIMA

## Decisiones de diseño ya cerradas en el importador

- Se mantiene **Next.js + TypeScript** como base única de frontend y lógica de servidor.
- El importador sigue siendo **configurable** y no fija columnas definitivas hasta validar el XLS/XLSX real de Orion.
- La regla de negocio crítica sigue encapsulada en una sola función: solo se acepta `^\d{6}\.CNA$`.
- **`medicines_snapshot` representa CN únicos por batch.**
- **Política de deduplicación cerrada:** gana la primera fila válida observada para cada CN, respetando el orden original del Excel.
- Del registro ganador se conservan `orionCode`, `localDescription` y `sourceRowNumber`.
- Tras deduplicar, `sourceRowNumber` significa "fila fuente ganadora del snapshot".
- Los duplicados válidos no se ocultan: se exponen como `duplicateConflicts`, indicando qué fila gana y cuáles quedan descartadas.
- La UI actual sigue siendo una **demo del flujo**, no una importación real desde navegador.
- La integración con CIMA y el uso operativo de Prisma siguen pendientes; en esta iteración solo quedan preparados el modelo y el vocabulario del dominio.

## Estado real de la implementación

### Ya resuelto en esta iteración

1. Validación estricta del código Orion con `^\d{6}\.CNA$`.
2. Extracción del CN a partir de filas válidas.
3. Distinción clara entre filas válidas/descartadas y snapshot de CN únicos.
4. Validación explícita de hoja y columnas del Excel en `parseWorkbook`.
5. Política explícita de deduplicación y exposición de conflictos por CN repetido.
6. Tests de comportamiento para validador, parser, deduplicación y diff.
7. Textos UI corregidos para dejar claro que la pantalla de importaciones es una demo.
8. Nombres alineados entre snapshot, demo y Prisma (`localDescription`, proyecciones demo diferenciadas del modelo persistente).

### Aún no implementado

1. Subida real de XLS/XLSX desde la interfaz.
2. Persistencia real en PostgreSQL mediante Prisma Client.
3. Migraciones y flujo operativo de base de datos.
4. Enriquecimiento real con CIMA.
5. Detección de cambios de descripción para un mismo CN en el diff entre snapshots.

## Contrato actual del importador

1. Se recibe un workbook XLS/XLSX en backend.
2. Se valida que exista la hoja indicada.
3. Se valida que existan las columnas mapeadas.
4. Se parsean filas en bruto.
5. Se valida el código Orion.
6. `raw_import_rows` representa el detalle fila a fila.
7. `medicines_snapshot` representa CN únicos por batch.
8. Si un CN válido aparece repetido, gana la primera fila válida del batch.
9. Los duplicados se devuelven en `duplicateConflicts` y en el resumen (`duplicateNationalCodes`, `duplicateValidRows`).
10. `parseWorkbook` no devuelve snapshot: su responsabilidad queda limitada a parsear, validar y describir conflictos del batch. El snapshot se construye después, cuando ya existe un `importBatchId` real y una decisión explícita de persistencia.
11. El diff actual compara presencia/ausencia de CN entre snapshots, no cambios de descripción.

## Qué queda pendiente del XLS real

1. Confirmar los nombres reales de las columnas a mapear.
2. Validar si hay más de una hoja útil por fichero.
3. Definir qué columnas adicionales deben persistirse en `raw_import_rows` y `medicines_master`.
4. Confirmar si la primera fila del Excel real es siempre un encabezado estable y usable para el mapeo.
5. Validar si el criterio "primera fila válida gana" sigue siendo correcto con datos reales o si habrá una prioridad distinta documentada por negocio.

## Separación de parsers

- `lib/orion.ts` mantiene el parser Excel actual orientado al flujo de medicamentos/CN.
- `lib/orion-tsv.ts` añade el parser específico del catálogo TSV de artículos Orion.
- `lib/import/header-utils.ts` contiene utilidades genéricas de normalización/resolución de encabezados.
- `lib/import/types.ts` declara contratos compartidos para headers normalizados, warnings, errors, parse results y `OrionCatalogItem`.
