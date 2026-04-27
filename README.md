# To-Do por voz

App web responsive para celular, sin autenticación, con carga manual o por voz y persistencia en base de datos.

## Stack

- HTML + CSS + JavaScript (frontend)
- Web Speech API (captura de voz)
- Vercel Serverless Function (`/api/tasks`)
- Vercel Postgres (persistencia de tareas)

## UX implementada

- Formulario simple con foco en móvil.
- Botón **Agregar** y botón de **micrófono chico al lado**.
- Estado visible de carga/errores.
- Sección **Pendientes** y sección **Hechas** (tachadas).
- Check para marcar/desmarcar tareas realizadas.
- Grillas ordenadas por fecha ascendente.

## PWA mobile

- `manifest.webmanifest` para instalación en pantalla de inicio.
- `service-worker.js` para cache de assets estáticos.
- Ícono en `icons/icon.svg`.

## Formato de voz

Usá comandos como:

- `mañana - pagar luz`
- `30/04 - turno médico`
- `2026-05-12 - enviar informe`
- `4 de abril de 2026 tengo parcial 1` (se guarda como `04/04/2026 parcial 1`)

## Ejecutar local

1. Instalar dependencias:
   `npm install`
2. Correr entorno local de Vercel:
   `npm run dev`

> Para que la API funcione local y en producción, tenés que tener configurada la base de datos de Vercel Postgres en tu proyecto (variables de entorno incluidas por Vercel).

## Deploy

```bash
npx vercel --yes
npx vercel --prod --yes
```

## Persistencia

- Base de datos Postgres (Neon integrado en Vercel).
- API serverless en `api/tasks.js` con:
  - `GET /api/tasks`
  - `POST /api/tasks`
  - `PATCH /api/tasks` (marcar hecha/no hecha)
  - `DELETE /api/tasks?id=...`
