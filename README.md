# orion-cima-catalogo

Tercera iteración enfocada en robustecer el contrato del importador y el testing para una app de Farmacia Hospitalaria que construirá un catálogo operativo real a partir de exportaciones manuales de Orion Logis y dejará preparada la integración con CIMA.

## Qué incluye esta iteración

- Base web con Next.js + TypeScript.
- Navegación inicial con Dashboard, Importaciones y Catálogo operativo.
- Demo navegable del flujo de importación, sin subida real de fichero desde la interfaz todavía.
- Importador XLS/XLSX configurable por nombre de hoja, columna de código Orion y columna de descripción.
- Validación estricta del patrón `^\d{6}\.CNA$`.
- Extracción del Código Nacional (CN) a partir de los 6 dígitos previos a `.CNA`.
- Decisión explícita de dominio: `medicines_snapshot` representa **CN únicos por batch**.
- Política explícita de deduplicación: gana la primera fila válida observada para cada CN y los duplicados se reportan como conflicto.
- Validación explícita de existencia de hoja y columnas mapeadas en el parser.
- Tests de comportamiento para validador, parser, deduplicación y diff.
- Esquema relacional preparado para `import_batches`, `raw_import_rows`, `medicines_snapshot`, `medicines_master`, `cima_cache`, `supply_alerts` y `local_annotations`.
- Documentación de arquitectura y pendientes a confirmar con el XLS real.

## Reglas de negocio implementadas

Solo se considera medicamento válido un código Orion que cumpla exactamente:

```txt
^\d{6}\.CNA$
```

Comportamiento aplicado:

- Se extrae el CN como los 6 dígitos previos a `.CNA`.
- Todo registro sin `.CNA` se descarta como no medicamentoso.
- Todo registro con `.CNA` pero formato distinto al patrón exacto se descarta.
- Si un CN válido aparece varias veces dentro del mismo batch, el snapshot conserva la primera fila válida observada para ese CN.
- Los duplicados válidos se exponen como conflicto y también se resumen en el resultado del parser.
- No se asumen excepciones mientras no lleguen documentadas en datos reales.

## Estructura del proyecto

```txt
app/                 UI demo con rutas del dashboard, importaciones y catálogo
components/          Componentes reutilizables de navegación y métricas
lib/                 Lógica de importación Orion, snapshots, diff y preparación CIMA
prisma/              Esquema relacional inicial
docs/                Decisiones de arquitectura y pendientes
tests/               Tests de comportamiento del contrato del importador
```

## Puesta en marcha

```bash
npm install
npm run dev
npm run test
```

La app queda accesible en `http://localhost:3000`.

## Estado real de Prisma

El proyecto incluye `prisma/schema.prisma` como diseño del modelo de datos, pero **Prisma todavía no está operativo en esta iteración**:

- no hay `prisma` ni `@prisma/client` en `package.json`
- no hay migraciones
- no hay Prisma Client integrado en la app
- no hay persistencia real todavía

## Validación con el XLS real pendiente

Todavía no se fijan columnas definitivas del Excel de Orion. Antes de cerrar el importador real habrá que confirmar:

- nombres exactos de columnas
- estructura real del fichero
- hojas disponibles
- campos extra que interese conservar
- estabilidad real de la fila de encabezados
- si la política "gana la primera fila válida" sigue siendo la correcta con datos reales

## Próximos pasos recomendados

1. Añadir subida real de ficheros y server actions/API routes para persistencia.
2. Integrar Prisma de forma operativa con PostgreSQL/Supabase y generar migraciones.
3. Implementar enriquecimiento asíncrono desde CIMA con caché local.
4. Añadir detalle de medicamento, cambios entre cargas y validación administrativa.
