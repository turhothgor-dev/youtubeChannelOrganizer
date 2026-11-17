# Plan: Fase 6 · Hoja de ruta (organización y mantenimiento)

**Estado:** borrador

Issue: petición de la persona (2026-11-17): ampliar `ROADMAP.md` con una Fase 6 priorizada a partir de lo pendiente y
de una búsqueda de extensiones similares (PocketTube, SubTube, Groupify, TubeZenify, YouTube Subscription Organizer).

<!-- Estados: borrador → aprobado (AAAA-MM-DD) → hecho. Se cambia solo la línea `**Estado:**`, y lo
     hace quien tiene la aprobación de una persona; los subagentes no ven la conversación, solo este fichero. -->

## Contexto y decisión

Las fases 1 a 5 están hechas. Ya existe: grupos y subgrupos, iconos fxemoji y color (banda), filtro por selección
múltiple en suscripciones, filtros avanzados (duración, fecha, visualizaciones), vistos (manual y automático), modos de
visibilidad, listas propias, limpieza (repetidos, URL no válidas, grupos vacíos), copia de seguridad, reproducir lo
visible, Shorts, búsqueda, recomendaciones y botones en miniaturas y reproductor. Queda pendiente la pantalla de
edición de grupos.

Filosofía que filtra las ideas: sin servidores propios, sin peticiones de red (solo lo que la propia página de YouTube
carga), datos en `browser.storage.local`, sin dependencias y sin automatizar acciones de la cuenta de YouTube.

Decisión: la Fase 6 se centra en **organizar y mantener** lo que ya hay. Primero el editor (dividido en dos planes,
6-1 y 6-2), después lo que cierra el ciclo "suscribirse → clasificar" (6-3 y 6-4) y luego mejoras de uso diario.

### Evaluación de las ideas

| Idea (origen) | Decisión | Prioridad | Motivo |
| --- | --- | --- | --- |
| Pantalla de edición de grupos (pendiente) | Plan 6-1 (árbol) y 6-2 (canales y búsqueda) | alta | Hoy no se puede renombrar, borrar, mover ni quitar canales |
| Búsqueda de canales y grupos (propia) | Dentro de 6-2 | alta | Saber en qué grupos está un canal; barata con la lógica del editor |
| Asignación masiva (propia) | Dentro de 6-2 (copiar o mover en bloque) y 6-4 (bandeja) | alta | No necesita plan propio |
| Orden personalizado con arrastrar y soltar (PocketTube) | Dentro de 6-1 | alta | Mover y reordenar grupos y subgrupos |
| Deshacer tras borrar (propia) | En el editor (6-1 y 6-2); el resto, plan 6-8 | alta / baja | Sustituye a `confirm`, que interrumpe y no protege de verdad |
| Filtro "Sin grupo" / ocultar del feed lo ya agrupado (PocketTube) | Plan 6-3 | alta | Barato (lógica de `filter.js`); ver lo que falta por clasificar |
| Bandeja "Sin clasificar" y suscripciones nuevas (YouTube Subscription Organizer) | Plan 6-4 + ADR | alta | Cierra el hueco de las suscripciones nuevas que nunca entran en un grupo |
| Contador de vídeos nuevos por grupo (SubTube, PocketTube) | Plan 6-5 + ADR, versión aproximada | media | Útil, pero sin red solo puede contar lo que YouTube ya ha cargado en suscripciones |
| Fusionar grupos (propia) y ordenar A-Z (PocketTube) | Plan 6-6 | media | Funciones puras pequeñas sobre el editor |
| Canales ocultos (propia, inspirada en la lista negra de PocketTube) | Plan 6-7 | media | Quitar de inicio, búsqueda y recomendaciones canales que no se quieren ver; reutiliza la visibilidad |
| Salud de suscripciones: canales inactivos (PocketTube) | Plan 6-9, fecha observada localmente | baja | "Limpieza" no lo cubre; sin red solo hay la fecha en que se vio un vídeo suyo |
| Reglas de autoasignación por palabras clave (propia) | Plan 6-10 | baja | Solo tiene sentido con la bandeja (6-4); el nombre del canal es una señal pobre |
| Ajustes y copia de seguridad en la página de opciones (propia) | Plan 6-11 | baja | Ordena el panel; no es barato hacerlo dentro de 6-1 (cachés de `content.js`, `watched.js` depende del origen) |
| Atajos de teclado (propia) | Plan 6-12 | baja | Pocos (abrir editor, limpiar selección) y sin chocar con los de YouTube |
| Reproducir un grupo como cola (PocketTube) | Plan 6-13 | baja | Ya se consigue seleccionando el grupo y "Reproducir lo visible"; solo sería un atajo |
| Sincronización con `browser.storage.sync` (Groupify, TubeZenify) | Plan 6-14 + ADR que revise el 0006 | baja | Cuota de 100 KB y 8 KB por elemento: solo grupos y ajustes, troceados; la copia de seguridad ya cubre el traslado |
| Desuscripción masiva (PocketTube) | **Descartada** | — | Automatiza acciones irreversibles de la cuenta en la interfaz de YouTube, frágil ante cambios del DOM; el editor enlaza al canal para hacerlo a mano |
| Exportar un grupo como OPML/RSS (propia) | **Descartada** | — | Los feeds de YouTube necesitan el id `UC…` y guardamos sobre todo `/@handle` (ADR 0001); obtenerlo exige red |
| Orden por última actividad (PocketTube) | **Descartada por ahora** | — | No hay dato fiable sin red; reconsiderar cuando 6-5 o 6-9 registren actividad |
| Contador exacto con RSS por canal (SubTube) | **Descartada** | — | Una petición por canal y el id `UC…`; se elige la versión aproximada de 6-5 |

### Planes futuros (uno por funcionalidad grande)

Cada uno se escribirá con `/crear-plan` cuando toque; aquí solo se reserva nombre y alcance.

- `2026-11-17-fase6-1-editor-de-grupos.md` · Página de opciones con el árbol: renombrar, icono y color, crear, mover
  y reordenar (botones, teclado, arrastrar y soltar), borrar con "Deshacer". ADR 0014. **Escrito.**
- `2026-11-17-fase6-2-editor-de-canales.md` · Canales del grupo: quitar (con "Deshacer"), copiar y mover en bloque y
  búsqueda de grupos y canales. **Escrito.**
- `fase6-3-filtro-sin-grupo` · Elemento "Sin grupo" en la guía que muestra solo vídeos de canales que no están en
  ningún grupo (y, con "Vídeos fuera del filtro", oculta o atenúa los agrupados).
- `fase6-4-sin-clasificar` · Lista de suscripciones conocidas, leída del DOM al visitar `/feed/channels` o al
  desplegar las suscripciones de la guía (sin peticiones); bandeja "Sin clasificar" en el editor con las que no están
  en ningún grupo, marca de "nuevas" desde la última lectura y asignación en bloque. ADR para la nueva clave de
  almacenamiento.
- `fase6-5-videos-nuevos-por-grupo` · Contador junto a cada grupo en la guía con los vídeos de sus canales aparecidos
  en suscripciones desde la última vez que se seleccionó; se guarda por grupo la marca de la última visita. ADR para
  el formato.
- `fase6-6-fusionar-y-ordenar` · "Fusionar con…" y "Ordenar A-Z" (subgrupos o canales) en el editor.
- `fase6-7-canales-ocultos` · Lista de canales cuyos vídeos se ocultan siempre, gestionada en el editor y con "Ocultar
  canal" en el desplegable de la tarjeta.
- `fase6-8-deshacer-en-listas-y-limpieza` · Aviso con "Deshacer" en lugar de `confirm` al borrar listas y al limpiar.
- `fase6-9-canales-inactivos` · En "Limpieza", canales de los que no se ha visto un vídeo en suscripciones desde hace
  X meses (fecha registrada localmente), con quitar en bloque de los grupos.
- `fase6-10-reglas-de-autoasignacion` · Palabras clave por grupo que sugieren grupo a las suscripciones de la bandeja
  (6-4). Nunca asigna sin confirmar.
- `fase6-11-ajustes-en-opciones` · Ajustes y copia de seguridad también en la página de opciones; `watched.js`
  independiente del origen.
- `fase6-12-atajos-de-teclado` · Atajos propios mínimos, desactivados en campos de texto.
- `fase6-13-reproducir-grupo` · Botón ▶ en la fila del grupo: lo selecciona, abre suscripciones y lanza "Reproducir lo
  visible".
- `fase6-14-sincronizacion-storage-sync` · ADR que revise el 0006 y, si cabe en la cuota, sincronización de grupos y
  ajustes troceados.

Orden recomendado: 6-1 → 6-2 → 6-3 → 6-4; el resto según interés. 6-10 depende de 6-4; 6-9 puede reutilizar la
observación del feed de 6-5.

## Tareas

- [ ] T1 · Sustituir la sección "Pendiente" de `ROADMAP.md` por la sección **Fase 6** con este texto exacto (mismo
  estilo que las fases anteriores; "⬜" = pendiente, se cambia por "✅" al terminar cada plan):

  ```markdown
  ## Fase 6 (Organización y mantenimiento):
  Prioridad entre paréntesis; plan en `docs/plans/`.
  - ⬜ Editor de grupos en una página propia (alta, 6-1): renombrar, icono y color, crear, mover y reordenar y borrar
    con "Deshacer" sin depender de la guía de YouTube
  - ⬜ Editor de canales y búsqueda (alta, 6-2): quitar, copiar o mover canales en bloque y ver en qué grupos está un
    canal
  - ⬜ Filtro "Sin grupo" (alta, 6-3): ver solo los vídeos de canales que aún no están en ningún grupo
  - ⬜ Bandeja "Sin clasificar" y suscripciones nuevas (alta, 6-4): que ninguna suscripción se quede fuera de los
    grupos
  - ⬜ Vídeos nuevos por grupo (media, 6-5): saber qué grupo tiene novedades desde la última visita, sin peticiones
    de red
  - ⬜ Fusionar grupos y ordenar A-Z (media, 6-6): reorganizar rápido grupos que crecieron sin orden
  - ⬜ Canales ocultos (media, 6-7): no volver a ver vídeos de ciertos canales en inicio, búsqueda y recomendaciones
  - ⬜ Deshacer en listas y limpieza (baja, 6-8): borrar sin miedo y sin diálogos de confirmación
  - ⬜ Canales inactivos (baja, 6-9): detectar canales que ya no publican para sacarlos de los grupos
  - ⬜ Reglas de autoasignación (baja, 6-10): sugerir grupo a las suscripciones nuevas por palabras clave
  - ⬜ Ajustes y copia de seguridad en la página de opciones (baja, 6-11): todo lo que no es filtrar, fuera de YouTube
  - ⬜ Atajos de teclado (baja, 6-12): abrir el editor y limpiar la selección sin ratón
  - ⬜ Reproducir un grupo (baja, 6-13): un clic para ver en cola lo último de un grupo
  - ⬜ Sincronización automática con `storage.sync` (baja, 6-14): grupos y ajustes en todos los dispositivos, si cabe
    en la cuota

  Descartado: desuscripción masiva (acciones irreversibles de la cuenta en la interfaz de YouTube), exportar grupos como
  OPML/RSS y contador exacto por RSS (necesitan el id `UC…` y peticiones de red) y orden por última actividad (sin
  datos fiables sin red).
  ```

  · Ficheros: `ROADMAP.md`, este plan · Test: `make format-md` sin cambios pendientes y `make lint` en verde; la
  sección "Pendiente" ya no existe y su contenido está en el primer punto de la Fase 6.

## Criterios de aceptación

- `ROADMAP.md` tiene una Fase 6 con 14 funcionalidades, cada una con prioridad (alta, media o baja), número de plan y
  una línea de valor, y una línea con lo descartado.
- Ninguna funcionalidad de la Fase 6 repite algo ya hecho en las fases 1 a 5.
- Este plan explica por qué se descarta cada idea descartada y lista los planes futuros.

## Fuera de alcance

- Escribir los planes 6-3 a 6-14 (cada uno cuando toque).
- Cambiar código, `docs/ARCHITECTURE.md` o `PROJECT.md`.

## Cambios aprobados

Cambios sobre el plan después de aprobarlo. Sin una línea aquí, un cambio no está aprobado.

| Fecha | Tarea | Cambio | Motivo | Aprobado por |
| --- | --- | --- | --- | --- |

## Registro

Una línea por commit, añadida **antes** de commitear. El plan actualizado va en el mismo commit que el cambio.

| Fecha | Tarea | Commit | Nota |
| --- | --- | --- | --- |
