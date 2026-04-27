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
- Grilla ordenada por fecha ascendente.

## Formato de voz

Usá comandos como:

- `mañana - pagar luz`
- `30/04 - turno médico`
- `2026-05-12 - enviar informe`

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

## AI opcional (recomendación)

Mantener parser local para `fecha - tarea` y agregar fallback a LLM solo cuando no pueda interpretar la frase. El LLM debería devolver JSON estructurado:

```json
{ "date": "2026-05-02", "task": "pagar luz" }
```
