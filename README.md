# To-Do por voz

App web responsive para celular, sin autenticación, con carga manual o por voz y persistencia en base de datos.

## Stack

- HTML + CSS + JavaScript (frontend)
- Web Speech API (captura de voz)
- Vercel Serverless Function (`/api/tasks`)
- Vercel Postgres (persistencia de tareas)

## UX implementada

- UI renovada enfocada en móvil, limpia y legible.
- Cambio de contexto rápido entre **Estudio** y **Trabajo**.
- Modo claro/oscuro con toggle.
- Lista de pendientes + lista de hechas (tachadas), con check de completado.
- Botón de micrófono junto a agregar y estados de feedback claros.
- Botón para mover tareas entre Estudio y Trabajo en un toque.

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
- `mañana tengo que hacer guía 4`

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
  - `PATCH /api/tasks` (marcar hecha/no hecha y mover de categoría)
  - `DELETE /api/tasks?id=...`
