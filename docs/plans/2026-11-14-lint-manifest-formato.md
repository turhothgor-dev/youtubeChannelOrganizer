# Plan: `make lint` en verde (manifiesto y formato)

**Estado:** hecho

## Contexto y decisión

`make lint` falla por dos motivos: `web-ext lint` exige el ID de la extensión en Manifest V3
(`ADDON_ID_REQUIRED`) y avisa de que falta `data_collection_permissions`
(`MISSING_DATA_COLLECTION_PERMISSIONS`); y Prettier encuentra `content.js` sin formatear. ID elegido por la
persona: `youtube-groups@turhothgor` (permanente una vez publicada la extensión). La extensión no envía
datos fuera del navegador (solo `storage`, sin `fetch` ni peticiones de red), así que declara
`"required": ["none"]`.

## Tareas

- [x] T1 · `browser_specific_settings.gecko` en `manifest.json`: `id` y `data_collection_permissions`
  (`required: ["none"]`), con la versión mínima de Firefox que pida `web-ext lint` si la pide · Ficheros:
  `manifest.json` · Test: `make lint` sin errores ni avisos de `web-ext lint`; `make build` sigue generando
  el paquete.
- [x] T2 · `make format` sobre el código de la extensión (solo cambia el formato de `content.js`), en su
  propio commit · Ficheros: `content.js` · Test: `make lint` pasa entero; `node --check content.js`.

## Criterios de aceptación

- `make lint` termina sin errores.
- El comportamiento de la extensión no cambia: T2 solo cambia espacios, comillas y saltos de línea.

## Fuera de alcance

- Cambios de lógica en `content.js` o nuevos permisos.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
| 2026-11-14 | T1 | `fix: ID de la extensión y data_collection_permissions en manifest.json` | `web-ext lint`: 0 errores, 0 avisos; no pide versión mínima de Firefox |
| 2026-11-14 | T2 | `style: formatear content.js con Prettier` | AST de `content.js` idéntico antes y después (comparado con espree): solo formato |
