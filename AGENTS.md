# youtubeChannelOrganizer

Organiza canales de YouTube en grupos personalizados.

Instrucciones para agentes de IA (Claude Code, Cline, Continue) y para personas.
Fuente única: los ficheros de cada herramienta importan o se generan desde aquí.

## Comandos

Usa **siempre** estos objetivos de `make`; no llames directamente a docker, composer o npm salvo que se indique.

**Nota**: En Windows nativo, `make` necesita WSL o devcontainer. Si no está disponible, los hooks
de bash se omiten automáticamente.

| Comando | Qué hace |
| --- | --- |
| `make doctor` | Comprueba los prerrequisitos de la máquina |
| `make setup` | Instala dependencias y crea `.env` desde `.env.example` si no existe |
| `make up` / `make down` | Levanta o para los servicios |
| `make test` | Todos los tests |
| `make test-affected` | Solo los tests de lo que has cambiado |
| `make lint` / `make format` | Comprobación y formato |
| `make ai-sync` | Regenera los ficheros de cada herramienta de IA desde `ai/skills/` |
| `make ai-models` | Qué modelo usa cada rol y cómo configurarlo en cada herramienta |

Una tarea no está terminada hasta que `make lint` y los tests afectados pasan.

<!-- ai-kit:reglas -->
## Forma de trabajar

1. **Planificar**: toda tarea que haga un agente, aunque sea de un solo fichero, tiene su plan en `docs/plans/` a partir de `docs/plans/PLAN-plantilla.md` (para tareas pequeñas basta el plan mínimo que describe la plantilla). Sin plan no se toca código; no lo necesitan las preguntas, las explicaciones ni las erratas en la documentación.
2. **Aprobar**: una persona lo revisa. Cuando lo apruebe, cambia la línea `**Estado:**` del plan a `**Estado:** aprobado (AAAA-MM-DD)`. Los subagentes no ven la conversación: lo que no esté escrito en el plan no existe para ellos.
3. **Implementar**: una tarea del plan cada vez, del tamaño de un commit, con su test. Cualquier cambio sobre el plan aprobado se anota antes en **Cambios aprobados**, con su motivo.
4. **Verificar, actualizar el plan y commitear**: tests y lint en verde. Antes de cada commit, actualiza el plan (tarea marcada, desviaciones en **Cambios aprobados** y una línea en **Registro**) e inclúyelo en el mismo commit que el cambio. Un commit por tarea con [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat:`, `fix:`, `chore:`...). Nunca `git push`: lo hace una persona.
5. **Revisar**: revisión del diff contra el plan antes de abrir el PR, incluido que el plan esté al día. Corrige bloqueantes e importantes; las sugerencias, según su valor. No encadenes revisiones si no hay cambios de diseño.

Decisiones de arquitectura relevantes: añade un ADR en `docs/adr/`.

### Modelos por rol

Cada rol usa un modelo distinto: uno potente para decidir y uno más barato para ejecutar.
La asignación está en `.kit/models.yaml`. En Claude Code, cada skill se ejecuta en su subagente con su modelo: `/crear-plan` → `architect` (opus), `/implementar-tarea` → `implementer` (sonnet), `/revisar-cambios` → `reviewer` (opus). `make ai-models` resume qué usa cada herramienta y cómo configurarla.

Los subagentes no ven la conversación: todo lo que necesitan va en el plan (`docs/plans/`) o en los argumentos de la skill.

- **Arquitecto** (`/crear-plan`): lee código y escribe **solo** planes en `docs/plans/`; no toca código ni configuración. Termina con el plan y pide a la persona que lo apruebe.
- **Programador** (`/implementar-tarea`): una tarea de un plan aprobado cada vez.
- **Revisor** (`/revisar-cambios`): informa; no modifica nada. Revisa todo el diff, sin atribuir autoría, y en Cline en una tarea nueva.

<!-- ai-kit:reglas-generales -->
## Reglas

- No leas, muestres ni modifiques ningún `.env` ni sus variantes (`.env.local`, `.env.test`, `.env.production`, `.envrc`...); un hook lo bloquea. Sí puedes leer y actualizar `.env.example` (y `.env.dist`), que documentan las variables con valores de desarrollo.
- **Edita ficheros solo con la herramienta de edición** del agente. Nunca con comandos: ni PowerShell (`Set-Content`, `Out-File`, `Add-Content`), ni `sed -i`, `>`, `tee` o scripts que escriban ficheros. La terminal es para `make`, `git` y los tests. Un hook lo bloquea.
- Lee el fichero, o las líneas que vas a cambiar, antes de editarlo. Cambia lo mínimo y no reescribas ficheros enteros.
- Si un test falla, arregla el código o explica por qué el test está mal; no cambies lo que comprueba para que pase.
- Usa los comandos y rutas de `AGENTS.md`; no inventes otros. Si la tarea es ambigua, pregunta antes de empezar.
- Los cambios del propio kit van en su commit aparte: `make kit-update` lo crea; no los mezcles con tu trabajo.
- No ejecutes `gcloud`, `git push`, migraciones contra entornos remotos ni nada irreversible: eso lo hace una persona.
- No cambies interfaces públicas ni decisiones de un plan aprobado sin decirlo explícitamente.
- No añadas dependencias sin justificarlo en el plan.
- Los ficheros de texto van en UTF-8 sin BOM y con fin de línea LF, también en Windows. Las únicas excepciones son los `.ps1` (UTF-8 **con BOM**, por Windows PowerShell 5.1, y LF) y los `.cmd`/`.bat` (CRLF, que `cmd.exe` exige). Lo fija `.gitattributes` y el hook tras cada edición lo comprueba.
<!-- /ai-kit:reglas-generales -->
<!-- /ai-kit:reglas -->

## Convenciones

- Describe aquí las convenciones de código del proyecto.
- Idioma de la documentación: español.

## Kit

Este proyecto usa ai-kit (versión en `.kit/manifest/kit.yaml`). El kit mantiene la configuración y las herramientas (`Makefile`, `compose.yaml`, `docker/`, `.claude/`, configs de calidad); el código de la aplicación y los manifiestos de dependencias son del proyecto y el kit no los toca al actualizar. Los hooks y permisos reducen riesgos, pero no son una barrera absoluta: para aislar de verdad a los agentes, usa el devcontainer o el sandbox de Claude Code. Los ficheros generados por el kit se actualizan con `make kit-update`; cambia la fuente (este fichero, `ai/skills/`) en lugar de los ficheros derivados de cada herramienta.

<!-- ai-kit:reglas -->
<!-- ai-kit:reglas-generales -->
## Cuando algo falla

| Situación | Qué hacer |
| --- | --- |
| Falla una herramienta o un comando | Un reintento con otro enfoque (por ejemplo, releer las líneas exactas) |
| Vuelve a fallar | **Para**: explica qué intentabas, qué ha fallado y qué propones, y espera a la persona |
| La edición no encuentra el texto | Relee solo esas líneas y repite la edición con el texto exacto; si falla otra vez, para |
| La lectura devuelve contenido desactualizado o incompleto | Vuelve a leer el fichero o el rango; si sigue igual, para |

Nunca rodees un fallo de la herramienta de edición con la terminal (PowerShell, `sed`, `>`, scripts): es lo
que estropea los ficheros. Para no quedar en bucle, para tú tras el segundo fallo.

<!-- /ai-kit:reglas-generales -->

## 📝 Formato Markdown

El formato Markdown se corrige automáticamente con `make format-md` (Linux/macOS/WSL) o
`.\format-md.ps1` / `.\Makefile.ps1 format-md` (Windows nativo) antes del commit.
No es necesario aplicar las reglas de formato manualmente.
<!-- /ai-kit:reglas -->
