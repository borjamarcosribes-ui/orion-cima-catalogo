\# Scheduled jobs MVP



\## Estado actual del job del Nomenclátor



En esta iteración, el job del Nomenclátor automatiza \*\*solo el import desde un `Prescripcion.xml` ya presente en disco\*\*.



No automatiza todavía:

\- la descarga de `prescripcion.zip`

\- ni la extracción de `Prescripcion.xml` desde el ZIP oficial



La infraestructura de jobs, locks y endpoints HTTP ya queda preparada para conectar esa capa de descarga/extracción en una iteración posterior sin rehacer el disparo programado ni el registro de ejecuciones.



\## Variables relevantes



\- `CRON\_SECRET`

\- `NOMENCLATOR\_XML\_PATH`

