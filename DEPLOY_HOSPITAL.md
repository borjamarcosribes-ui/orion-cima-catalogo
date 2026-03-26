\# Despliegue interno hospitalario — Integramécum



\## 1. Objetivo



Esta guía describe cómo desplegar \*\*Integramécum\*\* en un servidor interno del hospital, de forma que el equipo de IT pueda:



\- instalar la aplicación

\- configurar variables de entorno

\- inicializar la base de datos

\- arrancarla en modo producción

\- programar las automatizaciones corporativas



La aplicación está construida con:



\- Next.js (App Router)

\- TypeScript

\- Prisma

\- SQLite

\- jobs HTTP protegidos por `CRON\_SECRET`



\---



\## 2. Requisitos del servidor



Requisitos mínimos recomendados para el piloto interno:



\- Node.js 20.x

\- npm 10.x o compatible

\- acceso a internet saliente para:

&#x20; - CIMA

&#x20; - BIFIMED

&#x20; - descarga de nomenclátor

&#x20; - proveedor de correo (Resend)

\- almacenamiento persistente para la base de datos SQLite

\- servicio interno o supervisor para mantener la app levantada



Sistema operativo válido:

\- Windows Server

\- Linux



Recomendación:

\- usar un servidor interno dedicado o semidedicado

\- no desplegar en una carpeta temporal o perfil de usuario



\---



\## 3. Estructura esperada



La aplicación debe quedar desplegada como proyecto Node normal, por ejemplo:



```text

C:\\apps\\integramecum\\

