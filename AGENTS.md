# AGENTS.md

## Propósito del proyecto

Este repositorio contiene una app web interna para Farmacia Hospitalaria.

La app debe construir un catálogo operativo real a partir de exportaciones manuales de Orion Logis y enriquecerlo con información oficial de CIMA.

No debe apoyarse inicialmente en una GFT formal, ya que no está actualizada.

## Regla de negocio más importante

En Orion Logis, los medicamentos válidos tienen un código con esta estructura exacta:

`XXXXXX.CNA`

donde `XXXXXX` son los 6 dígitos del Código Nacional.

### Regla obligatoria
Considera medicamento válido solo una fila cuyo código cumpla exactamente:

`^\d{6}\.CNA$`

### Comportamiento obligatorio
- Extrae el CN como los 6 dígitos previos a `.CNA`.
- Descarta automáticamente todo registro que no cumpla ese patrón.
- Trata los registros sin `.CNA` como no medicamentosos.
- No inventes excepciones a esta regla salvo que aparezcan documentadas explícitamente en los datos reales.

## Estado actual del proyecto

Todavía NO se ha aportado el XLS real de Orion.

Por tanto:
- no inventes nombres de columnas definitivos
- no fijes un parser rígido
- diseña el importador con mapeo configurable
- deja preparado el sistema para cerrar el parser cuando se aporte el fichero real

## Objetivo técnico del MVP

Construir una primera versión funcional con:

1. estructura de proyecto clara
2. base de datos relacional
3. importador de XLS/XLSX
4. validación por regex del código Orion
5. extracción de CN
6. almacenamiento por snapshots
7. comparación entre importaciones
8. integración preparada con CIMA
9. interfaz básica usable

## Arquitectura preferida

Prioriza una arquitectura sencilla y mantenible.

Preferencias:
- Next.js o React moderno
- TypeScript
- PostgreSQL / Supabase
- server actions, API routes o edge/serverless functions
- UI limpia y responsive
- separación clara entre frontend, backend y acceso a datos

## Reglas de implementación

- No uses Power Apps.
- No construyas una solución dependiente de una GFT formal.
- No metas lógica crítica solo en frontend.
- No expongas secretos ni claves en cliente.
- Mantén el modelo de datos claro y normalizado.
- Favorece código legible sobre complejidad innecesaria.
- Documenta las decisiones relevantes.
- Añade manejo de errores de importación.
- Añade logs básicos o trazabilidad de las importaciones.

## Enfoque con CIMA

Usa CIMA como fuente oficial externa.

No hagas que toda la UI dependa de llamadas en tiempo real para cada fila de una tabla.
Prefiere:
- persistencia/caché local para rendimiento
- refresco controlado
- consultas puntuales en detalle cuando sea útil

## Modelo funcional esperado

Debe existir lógica equivalente a:

- import_batches
- raw_import_rows
- medicines_snapshot
- medicines_master
- cima_cache
- supply_alerts
- local_annotations

Puedes adaptar nombres técnicos, pero no elimines estos conceptos.

## Pantallas mínimas esperadas

- Dashboard
- Importaciones
- Catálogo operativo
- Detalle de medicamento
- Cambios entre cargas
- Administración/validación

## Importador

Diseña el importador para que:
- acepte XLS/XLSX
- permita configurar la columna del código Orion
- permita configurar la columna de descripción
- lea filas de forma robusta
- marque válidas y descartadas
- guarde motivo de descarte
- genere snapshot

## Qué hacer si faltan datos

Si una parte depende del XLS real y aún no está disponible:
- deja el sistema preparado
- usa configuración y tipos flexibles
- documenta claramente qué queda pendiente
- no inventes supuestos innecesarios

## Estilo de trabajo esperado

Antes de hacer cambios grandes:
- revisa la estructura actual del repositorio
- propón una organización coherente
- crea una base mínima funcional
- evita sobreingeniería

Cuando termines una tarea:
- resume qué has creado
- enumera lo pendiente
- indica qué necesita confirmación con el XLS real

## Prioridad de trabajo

1. estructura base del proyecto
2. esquema de datos
3. importador configurable
4. snapshots y comparación
5. integración con CIMA
6. interfaz inicial

## No hacer por ahora

- no implementar scraping complejo
- no integrar aún BIFIMED
- no cerrar reglas de columnas reales del XLS
- no añadir funcionalidades clínicas no confirmadas
- no asumir automatización de carga desde Orion

## Definición de éxito para esta primera iteración

La primera iteración será satisfactoria si deja:
- proyecto arrancado
- modelo de datos razonable
- importador preparado
- validación por regex funcionando
- snapshots diseñados o implementados
- base para integrar CIMA
- UI inicial navegable
