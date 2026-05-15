# Seguridad administrativa temporal

Las operaciones internas sensibles deben estar protegidas por una clave administrativa temporal mientras no exista un mecanismo corporativo definitivo de autorización de máquina a máquina.

## Mecanismo

Configurar la variable de entorno `ADMIN_API_KEY` con un valor largo y secreto. Las llamadas deben incluir:

```http
X-Admin-API-Key: <ADMIN_API_KEY>
```

El helper reutilizable `requireAdminApiKey` centraliza las respuestas de seguridad:

- `503` si `ADMIN_API_KEY` no está configurada.
- `401` si falta la cabecera `X-Admin-API-Key`.
- `403` si la cabecera no coincide.

## Operaciones protegidas

En esta aplicación Next.js quedan protegidas las sincronizaciones internas sensibles equivalentes a CIMA/BIFIMED:

- `POST /api/jobs/cima-cache`
- `POST /api/jobs/bifimed-cache`

Si se exponen endpoints internos adicionales de importación o sincronización —por ejemplo `/imports/*`, `/cima/*` o `/bifimed/*` en una API separada— deben reutilizar el mismo mecanismo y no crear una segunda protección paralela.

## Operaciones públicas o con otro control

No se debe aplicar esta clave a rutas públicas de consulta. Las rutas de aplicación protegidas por sesión y rol siguen usando Auth.js/NextAuth y los jobs programados no sensibles mantienen su secreto operativo documentado en `docs/scheduled-jobs.md`.
