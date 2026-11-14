# Plan: objetivos del Makefile para la extensión de Firefox

**Estado:** hecho

## Contexto y decisión

`ai-kit adopt --team` dejó el Makefile del preset genérico, con `TODO` en `setup`, `up`, `down`, `logs`,
`test`, `lint`, `format`, `typecheck` y `check-file`. El proyecto es una extensión de Firefox (Manifest V3,
JavaScript y CSS sin compilar). Decisión de la persona: usar **web-ext** (herramienta oficial de Mozilla
para lint, ejecutar y empaquetar) y **Prettier** (formato), como `devDependencies` en un `package.json`
nuevo. Se descarta la opción sin dependencias (solo `node --check`), que no valida el manifiesto ni las
APIs de WebExtensions.

## Tareas

- [x] T1 · `package.json` (privado, `devDependencies`: `web-ext`, `prettier`), `web-ext-config.mjs` (excluye
  del paquete los ficheros del kit y de documentación), `.prettierignore` (solo el código de la extensión:
  fuera `.claude/`, `.kit/`, `ai/`, `docs/` y los JSON de herramientas) y objetivos del Makefile:
  `setup` = `npm install`; `up` = `web-ext run` (Firefox con la extensión cargada y recarga automática);
  `down` y `logs` = mensaje con cómo hacerlo en Firefox; `test` = `node --test` (sin tests todavía);
  `lint` = `web-ext lint` + `prettier --check`; `format` = `prettier --write`; `typecheck` = mensaje (no
  hay TypeScript); `check-file` = Prettier sobre el fichero si es de la extensión y `node --check` si es
  `.js`, sin fallar si aún no se ha hecho `make setup`; objetivo nuevo `build` = `web-ext build` a
  `web-ext-artifacts/` (ignorado en `.gitignore`) · Ficheros: `Makefile`, `package.json`,
  `package-lock.json`, `web-ext-config.mjs`, `.prettierignore`, `.gitignore` · Test: `make setup`,
  `make help`, `make test`, `make lint` (ejecuta; los avisos o fallos sobre el código de la extensión se
  informan, no se corrigen aquí), `make build` genera un `.zip` que solo contiene `manifest.json`,
  `content.js` y `content.css`, y `make check-file FILE=content.js` funciona.

## Criterios de aceptación

- Ningún objetivo del Makefile imprime `TODO`.
- `make build` produce un paquete sin ficheros del kit ni de documentación.
- `make check-file` no falla en una máquina sin `node_modules`.

## Fuera de alcance

- Cambiar `manifest.json`, `content.js` o `content.css` (incluido aplicar `make format` o corregir avisos de
  `web-ext lint`, como el ID de la extensión para Manifest V3).
- Escribir tests.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `chore: objetivos del Makefile con web-ext y Prettier` | `make lint` falla por `manifest.json` (falta el ID de la extensión, obligatorio en MV3, y aviso de `data_collection_permissions`) y por el formato de `content.js`: fuera de alcance |
