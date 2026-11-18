# Roadmap de Desarrollo - YouTube Groups

## Fase 1 (MVP actual):
- ✅ Detección de canales y vídeos
- ✅ Creación/eliminación de grupos
- ✅ Asignación de canales a grupos
- ✅ Filtrado de contenido

## Fase 2 (Mejoras básicas):
- ✅ Multi-asignación de canales
- ✅ Sub-grupos
- ✅ Iconos personalizados (opcional)
- ✅ Marca como visto

## Fase 3 (Funcionalidades Avanzadas):
- ✅ Modos de visibilidad
- ✅ Gestor de playlists
- ✅ Filtros avanzados (duración, fecha, popularidad)
- ✅ Ocultar videos vistos
- ✅ Marcar videos vistos

## Fase 4 (Integración y Sincronización):
- ✅ Sincronización cruzada
- ✅ Integración en sidebar

## Fase 5 (Funcionalidades Opcionales):
- ✅ Limpieza de canales
- ✅ Auto-reproducción
- ✅ Soporte para Shorts
- ✅ Soporte para resultados de búsqueda
- ✅ Soporte para recomendaciones

## Fase 6 (Organización y mantenimiento):
Prioridad entre paréntesis; plan en `docs/plans/`.
- ✅ Editor de grupos en una página propia (alta, 6-1): renombrar, icono y color, crear, mover y reordenar y borrar
  con "Deshacer" sin depender de la guía de YouTube
- ✅ Editor de canales y búsqueda (alta, 6-2): quitar, copiar o mover canales en bloque y ver en qué grupos está un
  canal
- ✅ Avatares de canal (alta, 6-15): cada canal de un grupo o subgrupo muestra su imagen de canal en la guía y en el
  editor, para reconocerlo de un vistazo
- ⬜ Filtro "Sin grupo" (alta, 6-3): ver solo los vídeos de canales que aún no están en ningún grupo
- ✅ Bandeja "Sin clasificar" y suscripciones nuevas (alta, 6-4): que ninguna suscripción se quede fuera de los
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
- ⬜ Botones en Shorts (media, 6-16): recuperar visto, lista y +G manuales en `/shorts`, que se perdieron al retirar
  "Canal actual" y "Vídeo actual" del panel (ADR 0017)
- ⬜ Sincronización automática con `storage.sync` (baja, 6-14): grupos y ajustes en todos los dispositivos, si cabe
  en la cuota

Descartado: desuscripción masiva (acciones irreversibles de la cuenta en la interfaz de YouTube), exportar grupos como
OPML/RSS y contador exacto por RSS (necesitan el id `UC…` y peticiones de red) y orden por última actividad (sin
datos fiables sin red).
