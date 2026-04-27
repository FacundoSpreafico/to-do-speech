# To-Do por voz (MVP)

App web responsive (sin autenticación) para agendar tareas por voz en formato **fecha - tarea** y verlas en una grilla ordenada por fecha.

## Stack

- HTML + CSS + JavaScript vanilla
- Web Speech API (reconocimiento de voz en navegador)
- localStorage (persistencia local en el celular/PC)

## Uso

1. Abrí `index.html` en el navegador (ideal: Chrome móvil).
2. Tocá **Hablar** y decí algo como:
   - `mañana - pagar luz`
   - `30/04 - turno médico`
   - `2026-05-12 - enviar informe`
3. La tarea se agrega automáticamente y queda ordenada por fecha.

También podés cargar tareas manualmente con el formulario.

## Notas de compatibilidad

- El reconocimiento de voz depende del navegador/dispositivo.
- En algunos navegadores móviles requiere HTTPS (o localhost).

## ¿Es plausible sumar AI para interpretar voz?

Sí, totalmente plausible y útil para frases más naturales.

### Opción simple recomendada (híbrida)

- **Paso 1 (actual):** parser local por reglas para comandos claros `fecha - tarea`.
- **Paso 2 (AI opcional):** cuando el parser local falla, enviar el texto transcripto a un endpoint backend muy chico (por ejemplo Node/Express o serverless) que use un LLM y devuelva JSON:

```json
{ "date": "2026-05-02", "task": "pagar luz" }
```

### Por qué así

- Mantenés el MVP rápido y barato.
- No exponés la API key del modelo en el frontend.
- Tenés fallback robusto: regla local + AI solo cuando haga falta.
