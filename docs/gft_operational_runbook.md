# Runbook operativo GFT

> Nota: este repositorio no expone actualmente endpoints públicos `/gft/*`. Si se incorporan, deben mantenerse públicos solo cuando sean consultas/exportaciones de lectura previstas para la operación.

## Importación y sincronización

Las operaciones internas de importación o sincronización no deben invocarse sin credenciales administrativas. En esta implementación, las sincronizaciones sensibles disponibles son:

- `POST /api/jobs/cima-cache`
- `POST /api/jobs/bifimed-cache`

Estas llamadas requieren `ADMIN_API_KEY` configurada en el entorno y la cabecera:

```http
X-Admin-API-Key: <ADMIN_API_KEY>
```

No incluir valores reales de `ADMIN_API_KEY` en tickets, documentación, logs compartidos ni commits.
