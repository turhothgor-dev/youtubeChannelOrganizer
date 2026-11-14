---
name: crear-plan
description: "Convierte un requisito o issue en un plan aprobable en docs/plans/ con tareas del tamaño de un commit, tests y criterios de aceptación. Úsala antes de cualquier tarea de un agente: todas tienen plan, aunque sea de un fichero."
argument-hint: "<requisito o enlace a la issue>"
context: fork
agent: architect
---

# Crear un plan

Requisito: $ARGUMENTS

1. Lee `AGENTS.md`, `docs/ARCHITECTURE.md` y los ADR de `docs/adr/` que apliquen.
2. Explora el código relevante. No modifiques nada todavía.
3. Copia `docs/plans/PLAN-plantilla.md` a `docs/plans/AAAA-MM-DD-<slug>.md` y rellénalo (si la tarea es pequeña, usa el plan mínimo que describe la plantilla):
   - **Contexto y decisión**: qué se resuelve y qué alternativa se descarta, en pocas líneas.
   - **Tareas**: cada una del tamaño de un commit, con los ficheros que toca y el test que la valida. Si una tarea necesita "pensar la arquitectura", divídela.
   - **Criterios de aceptación**: comportamiento observable, no detalles de implementación.
   - **Fuera de alcance**: lo que no se toca.
4. Si la decisión es de arquitectura (nueva dependencia, cambio de estructura, patrón nuevo), propón también un ADR en `docs/adr/`.
5. Si no puedes escribir ficheros (por ejemplo, en el modo Plan de Cline), no lo intentes con comandos: termina **mostrando el plan completo en el chat**, con el formato de `docs/plans/PLAN-plantilla.md`, y pide a la persona que **pase a modo Act** para guardarlo tal cual en `docs/plans/AAAA-MM-DD-<slug>.md` con estado `borrador`. En Act, guardar el plan es lo primero que se hace.
6. Si has podido escribir el plan, termina devolviendo la ruta y un resumen corto (decisión, tareas, casos límite) para que una persona lo apruebe. No implementes nada.

## 🚫 Reglas

- Si algo falla, un reintento con otro enfoque; si vuelve a fallar, para y explica qué intentabas, qué ha fallado y qué propones.
- Edita solo con la herramienta de edición; nunca con comandos de terminal.
