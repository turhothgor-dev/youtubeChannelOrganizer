---
name: revisar-cambios
description: "Revisa el diff actual contra el plan y los criterios de aceptación, y devuelve hallazgos priorizados sin reescribir código. Úsala antes de abrir un PR."
argument-hint: "[ruta del plan]"
context: fork
agent: reviewer
---

# Revisar cambios

Plan de referencia: $ARGUMENTS

Revisión independiente: revisa **todo el diff** (con y sin commit), nunca solo los ficheros de la tarea, y **no atribuyas autoría**: no digas quién hizo un cambio, solo si es correcto. En Cline, ejecútala en una **tarea nueva**, sin el contexto de quien implementó.

1. Averigua la rama principal: `git symbolic-ref --short refs/remotes/origin/HEAD` y, si no hay remoto, la que exista de `main` o `master`. Si estás en ella, revisa los commits del trabajo (`git log`, `git show`) y lo que haya sin commitear (`git diff`, `git diff --staged`); si no, `git diff <principal>...HEAD` más lo no commiteado.
2. Ejecuta `make lint` y `make test` (no modifican el repositorio) e incluye el resultado en la revisión.
3. Compara cada cambio con el plan y sus criterios de aceptación. Lo anotado en **Cambios aprobados** cuenta como aprobado; un cambio de alcance sin anotar ahí es un hallazgo.
4. Revisa, por este orden:
   - **Corrección**: errores de lógica, casos límite, manejo de errores.
   - **Seguridad**: secretos, inyecciones (SQL, XSS), validación de entradas, permisos.
   - **Tests**: cada criterio de aceptación tiene un test; los tests prueban comportamiento.
   - **Alcance**: cambios fuera del plan o dependencias no justificadas.
   - **Protecciones**: un cambio en `.claude/hooks/`, `.claude/settings*.json`, `.clinerules/hooks/`, `.kit/`, `AGENTS.md` o las reglas de las herramientas que no esté previsto en el plan (sus tareas o **Cambios aprobados**) es *Bloqueante*.
   - **Plan al día**: cada tarea hecha está marcada, **Registro** tiene una línea por commit y lo implementado coincide con el plan; si no, es *Importante*. El estado del plan es coherente (`hecho` si no quedan tareas pendientes) y el trabajo tiene commit.
   - **Higiene**: no hay fines de línea CRLF (salvo `.cmd`/`.bat`) ni ficheros sin seguimiento que deberían estar ignorados.
   - **Mantenibilidad**: nombres, duplicación, convenciones de `AGENTS.md`.
5. Devuelve los hallazgos agrupados en *Bloqueante*, *Importante* y *Sugerencia*, con fichero y línea, y el resultado de lint y tests.
6. No modifiques código ni el plan: la revisión solo informa.

## 🚫 Reglas

- Si algo falla, un reintento con otro enfoque; si vuelve a fallar, para y explica qué intentabas, qué ha fallado y qué propones.
- Edita solo con la herramienta de edición; nunca con comandos de terminal.
