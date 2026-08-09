# YouTube Groups

## Objetivo

Estamos desarrollando una extensión para Firefox inspirada en PocketTube.

La extensión permitirá organizar canales de YouTube en grupos personalizados y posteriormente filtrar el contenido de YouTube según esos grupos.

El proyecto debe ser mantenible, modular y resistente a cambios del DOM de YouTube.

---

## Tecnología

- Firefox WebExtensions
- Manifest V3
- JavaScript
- CSS
- browser.storage.local
- VS Code
- Codex

---

## Estado actual

El proyecto acaba de comenzar.

Archivos iniciales:

- manifest.json
- content.js
- content.css
- PROJECT.md

La extensión se cargará temporalmente en Firefox mediante:

about:debugging#/runtime/this-firefox

---

## Arquitectura prevista

La extensión tendrá aproximadamente estas partes:

### content.js

Se ejecutará en YouTube.

Responsabilidades:

- Detectar elementos de YouTube.
- Detectar vídeos.
- Detectar canales.
- Identificar el canal asociado a cada vídeo.
- Modificar la interfaz de YouTube.
- Aplicar filtros.
- Gestionar contenido cargado dinámicamente.
- Usar MutationObserver cuando sea necesario.

### content.css

Contendrá los estilos de los elementos añadidos por nuestra extensión.

### background.js

Se añadirá posteriormente.

Responsabilidades previstas:

- Gestionar almacenamiento.
- Gestionar eventos de la extensión.
- Coordinar comunicación entre diferentes partes de la extensión.

### popup/

Se añadirá posteriormente.

Permitirá:

- Ver grupos.
- Crear grupos.
- Editar grupos.
- Eliminar grupos.
- Activar/desactivar filtros.

### options/

Se añadirá posteriormente si necesitamos una configuración más completa.

---

## Funcionalidad prevista

### Fase 1 — Detección

Primero queremos conseguir:

1. Detectar vídeos en YouTube.
2. Obtener el nombre del canal.
3. Obtener la URL del canal.
4. Asociar cada vídeo con su canal.
5. Gestionar vídeos que aparecen dinámicamente.

### Fase 2 — Grupos

Crear grupos personalizados.

Ejemplo:

Tecnología:
- Canal A
- Canal B
- Canal C

Música:
- Canal D
- Canal E

Noticias:
- Canal F
- Canal G

Los grupos deben guardarse mediante:

browser.storage.local

### Fase 3 — Interfaz

Añadir una interfaz dentro de YouTube para:

- Mostrar grupos.
- Seleccionar un grupo.
- Crear grupos.
- Añadir canales a grupos.
- Eliminar canales de grupos.

### Fase 4 — Filtrado

Cuando el usuario seleccione un grupo:

- Mostrar vídeos de los canales pertenecientes al grupo.
- Ocultar vídeos que no pertenezcan al grupo.

También estudiaremos posteriormente:

- Página principal.
- Suscripciones.
- Shorts.
- Resultados de búsqueda.
- Recomendaciones.

### Fase 5 — Pulido

Posteriormente:

- Mejorar diseño.
- Añadir iconos.
- Mejorar rendimiento.
- Evitar conflictos con YouTube.
- Adaptarnos a cambios del DOM.
- Preparar la extensión para Firefox Add-ons.

---

## Principios importantes

No queremos construir todo de golpe.

Primero debemos conseguir un MVP pequeño y funcional.

Cada cambio debe ser probado antes de continuar.

Evitar depender excesivamente de selectores frágiles del DOM de YouTube cuando exista una alternativa más robusta.

No modificar código innecesariamente.

Mantener el código sencillo y modular.

---

## Próximo objetivo

El siguiente objetivo concreto es:

Detectar automáticamente el nombre y la URL del canal asociado a cada vídeo de YouTube.

Antes de implementar funcionalidades avanzadas debemos conseguir que esto funcione correctamente con contenido cargado dinámicamente.