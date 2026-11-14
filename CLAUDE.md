@AGENTS.md

## Claude Code

- Las skills del proyecto (`/crear-plan`, `/implementar-tarea`, `/revisar-cambios`) se generan desde `ai/skills/`. Para cambiarlas, edita `ai/skills/` y ejecuta `make ai-sync`; no edites `.claude/skills/` a mano.
- Subagentes: `architect` planifica, `implementer` ejecuta una tarea del plan, `reviewer` revisa el diff, `explorer` busca en el código sin llenar el contexto. Delega en ellos en lugar de hacerlo todo en la conversación principal.
- Cuando la persona apruebe un plan o un cambio sobre él, escríbelo tú en el plan (estado `aprobado (fecha)` o una fila en **Cambios aprobados**) antes de lanzar `/implementar-tarea`: los subagentes solo ven el fichero.
- Toda tarea tiene plan: si la persona pide un cambio sin plan, crea antes uno (mínimo, si es pequeño) con `/crear-plan`. Antes de cada `git commit`, comprueba que el plan está actualizado (tarea marcada, **Cambios aprobados** y una línea en **Registro**) e inclúyelo en el commit.
- Tras cada edición, un hook comprueba el fichero (`make check-file`). Si devuelve un error, corrígelo antes de seguir.
- Los permisos de `.claude/settings.json` bloquean `gcloud`, `docker` directo y `git push`, y el hook `protect-secrets` bloquea cualquier `.env*` salvo `.env.example` y `.env.dist`, y los comandos que escriben ficheros (edita con Edit o Write). Si necesitas algo de eso, pídeselo a la persona.
- Preferencias personales que no deban compartirse: `.claude/settings.local.json` (ignorado por git).

## Cuando algo falla

Si algo falla, un reintento con otro enfoque; si vuelve a fallar, para y explica qué intentabas, qué ha fallado y qué propones. Nunca edites ficheros con la terminal como alternativa. Detalle en `AGENTS.md`.
