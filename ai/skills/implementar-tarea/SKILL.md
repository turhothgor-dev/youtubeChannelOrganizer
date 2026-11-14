---
name: implementar-tarea
description: "Implementa UNA tarea de un plan aprobado de docs/plans/ hasta que su test y el lint pasan, y la marca como hecha. Úsala tras aprobar un plan."
argument-hint: "<ruta del plan> <id de tarea, p. ej. T2>"
context: fork
agent: implementer
---

# Implementar una tarea del plan

Tarea: $ARGUMENTS

1. Lee el plan y la tarea indicada. Si el plan no está en estado `aprobado`, para y dilo: no implementes un borrador.
2. Si los argumentos piden algo distinto de lo que dice la tarea en el plan, añade primero una fila en **Cambios aprobados** (fecha, tarea, cambio, motivo, quién lo aprueba según los argumentos) y ajusta la tarea. Si los argumentos no dicen que una persona lo ha aprobado, para y pregunta.
3. Lee solo los ficheros que la tarea lista y los que necesites para entenderlos.
4. Si la tarea no tiene test, escríbelo primero y comprueba que falla.
5. Implementa el cambio mínimo que hace pasar el test.
6. Ejecuta `make test-affected` y `make lint`. Corrige hasta que pasen.
7. Si algo falla, un reintento con otro enfoque; si vuelve a fallar, para: explica el error y tu diagnóstico.
8. No cambies interfaces públicas ni decisiones del plan fuera de lo anotado en **Cambios aprobados**.
9. Actualiza el plan: marca la tarea como `[x]` (si era la última pendiente, cambia el estado del plan a `hecho`) y añade una línea en **Registro** con la fecha, la tarea, el mensaje de commit que propones y una nota corta.
10. Cierra según quién te lanzó:
    - Si la skill la lanzó otra conversación (subagente de Claude Code), no hagas commit: lo hace quien te lanzó, incluyendo el plan actualizado. Resume el cambio en cinco líneas como máximo.
    - Si trabajas directamente con la persona (Cline, Continue), haz el commit con el plan actualizado, en el mismo commit, y un mensaje en español con Conventional Commits.
    - Si era la última tarea pendiente, pasa el estado del plan a `hecho` **antes** del commit, nunca después.

## 🚫 Reglas

- Si algo falla, un reintento con otro enfoque; si vuelve a fallar, para y explica qué intentabas, qué ha fallado y qué propones.
- Edita solo con la herramienta de edición; nunca con comandos de terminal.
- No hagas commit sin actualizar el plan primero (y sin `git push`: lo hace una persona).
