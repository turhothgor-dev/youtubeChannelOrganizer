# 0011 · Selección limitada a hermanos

- Estado: aceptada
- Fecha: 2026-11-15
- Sustituye a: [0009](0009-seleccion-multiple-como-filtro.md)
- Modificado por: [0020](0020-filtro-sin-grupo-excluyente.md) (clave `ungrouped`)

## Contexto

Con la selección múltiple libre del ADR 0009 se pueden mezclar un grupo, un subgrupo suyo y canales de otros grupos;
tras probarlo (2026-11-15) la persona decide una regla única: al seleccionar un elemento solo se conservan los
seleccionados que sean **hermanos** suyos. Un mismo canal puede estar en varios grupos, así que hace falta saber en qué
lista se pulsó.

## Decisión

1. **Claves**: grupo `group:<id>`; canal `channel:<contenedor>:<url normalizada>`, donde `<contenedor>` es el id del
   grupo o subgrupo en cuya lista está el canal, codificado con `encodeURIComponent` (no contiene `:`). Un canal sin
   contenedor no es una clave válida.
2. **Hermanos**: dos claves son hermanas si son del mismo tipo y tienen el mismo contenedor: grupos con el mismo padre
   (la raíz para los de primer nivel) y canales con el mismo `<contenedor>`. Un grupo y un canal nunca son hermanos.
3. **Alternar** (`toggleSelection(groups, selection, filter)`): si la clave ya está, se quita y nada más (sin navegar).
   Si no está, se quitan todas las que no son hermanas suyas y se añade al final. La selección sigue siendo un array en
   orden de pulsación; la última es el ancla para crear subgrupos. Consecuencia: nunca coexisten un padre y su hijo, ni
   grupos y canales.
4. **Filtro**: unión de URL como en el 0009 (grupo: sus canales y los de sus descendientes; canal: su URL).
5. **Resolver** (`resolveSelection`): se descarta un grupo que ya no existe y un canal cuyo contenedor no existe o ya
   no lo tiene en su propia lista. Después, si lo que queda no son todos hermanos del último, se conservan solo los
   hermanos del último (defensa ante datos de `sessionStorage` o cambios en otra pestaña).
6. **Navegación**: sin cambios respecto al 0009 (solo navega a `/feed/subscriptions` un clic que añade fuera de esa
   página).
7. **Traspaso**: misma clave `youtubeGroupsPendingFilter` y caducidad de 30 s, con `version: 3`; las versiones 1 y 2 se
   ignoran.
8. **Guía**: `aria-pressed` de un canal se calcula con su clave de fila (contenedor incluido): un canal presente en dos
   listas solo se marca en la que se pulsó. La lista de canales de un elemento se despliega por defecto si contiene un
   canal seleccionado **de esa lista**.

No cambia ningún formato de `browser.storage.local` ni la copia de seguridad.

## Alternativas descartadas

- Selección libre (0009): mezcla niveles sin aportar nada (un grupo ya incluye a sus subgrupos).
- Clave de canal sin contenedor: no se sabe qué hermanos tiene ni qué fila marcar.
- Modelar la selección como `{ tipo, contenedor, ids }`: más explícito, pero obliga a reescribir el traspaso, la
  resolución y las comparaciones; el array de claves con la regla en `toggleSelection` basta.
- Contenedor sin codificar: un id importado con `:` haría ambigua la clave.

## Consecuencias

- Se gana: selecciones coherentes (un nivel, un contenedor) y un ancla clara para crear.
- Se pierde: combinar grupos de distintos niveles o canales de distintos grupos en un mismo filtro.
- A vigilar: un canal seleccionado en un grupo no aparece marcado en otras listas donde también está; es lo pedido.
