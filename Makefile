# Objetivos estándar del proyecto (generado por ai-kit). Ver AGENTS.md.
# Agentes, hooks y CI usan solo estos objetivos.
SHELL := /bin/bash
PYTHON ?= python3

.DEFAULT_GOAL := help
.PHONY: help doctor ai-sync ai-models kit-update setup up down logs test test-affected lint format typecheck check-file lint-md format-md

help: ## Muestra los objetivos disponibles
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "} {printf "  %-15s %s\n", $$1, $$2}'

doctor: ## Comprueba los prerrequisitos de la máquina
	@./.kit/doctor/doctor.sh

ai-sync: ## Regenera los ficheros de las herramientas de IA desde ai/skills
	@$(PYTHON) .kit/scripts/ai_sync.py

ai-models: ## Muestra qué modelo usa cada rol y cómo configurarlo en cada herramienta
	@cat .kit/ai-models.txt

kit-update: ## Actualiza a la última versión de ai-kit y deja los cambios en su propio commit
	@if [ -f .kit/adopt.json ]; then \
	command -v ai-kit >/dev/null 2>&1 || { echo "Este proyecto se adoptó con 'ai-kit adopt --team': actualízalo con 'ai-kit adopt --team .' (instala ai-kit y ponlo en el PATH)"; exit 1; }; \
	exec ai-kit adopt --team . $(ARGS); \
	fi; \
	[ -z "$$(git status --porcelain)" ] || { echo "Haz commit de tus cambios antes de actualizar el kit (los del kit van en un commit aparte)"; exit 1; }; \
	echo "copier update --trust -a .kit/.copier-answers.yml $(ARGS)"; \
	copier update --trust -a .kit/.copier-answers.yml $(ARGS) || exit $$?; \
	if [ -z "$$(git status --porcelain)" ]; then echo "El kit ya estaba al día."; exit 0; fi; \
	conflicts="$$(git status --porcelain | cut -c4- | while IFS= read -r f; do [ -f "$$f" ] && grep -lE '^(<<<<<<<|>>>>>>>) ' "$$f"; done; find . -name '*.rej' -not -path './.git/*')"; \
	if [ -n "$$conflicts" ]; then echo "Conflictos en:"; echo "$$conflicts"; echo "Resuélvelos y haz commit: git add -A && git commit -m 'chore: actualizar ai-kit'"; exit 1; fi; \
	v="$$(awk '/^kit:/{k=1;next} k&&/^[^ ]/{k=0} k&&/^  version:/{print $$2;exit}' .kit/manifest/kit.yaml)"; \
	git add -A && git commit -q -m "chore: actualizar ai-kit a v$$v" && echo "Commit creado: chore: actualizar ai-kit a v$$v (revísalo con git show --stat)"


# Extensión de Firefox (Manifest V3): web-ext (lint, ejecutar, empaquetar) y Prettier (formato).
WEB_EXT := npx --no-install web-ext
PRETTIER := npx --no-install prettier
EXT_FILES := "**/*.{js,mjs,css,html,json}"

.PHONY: build

setup: ## Instala dependencias (web-ext y Prettier)
	npm install --no-fund --no-audit

up: ## Abre Firefox con la extensión cargada y recarga al guardar
	$(WEB_EXT) run --url https://www.youtube.com

down: ## Para Firefox lanzado con make up
	@echo "Cierra la ventana de Firefox o pulsa Ctrl+C en la terminal de make up."

logs: ## Dónde ver los logs de la extensión
	@echo "Los mensajes de content.js salen en la consola web de la pestaña de YouTube (F12)."
	@echo "Los de la extensión: about:debugging#/runtime/this-firefox -> Inspeccionar."

test: ## Todos los tests (node --test; ficheros *.test.js)
	node --test

test-affected: ## Tests de lo cambiado
	@$(MAKE) -s test

lint: ## Comprobaciones estáticas: web-ext lint y formato (Prettier)
	$(WEB_EXT) lint
	$(PRETTIER) --check $(EXT_FILES)

format: ## Formatea el código de la extensión (Prettier)
	$(PRETTIER) --write $(EXT_FILES)

typecheck: ## Comprobación de tipos (no hay TypeScript)
	@echo "Sin comprobación de tipos: el proyecto es JavaScript sin TypeScript."

build: ## Empaqueta la extensión en web-ext-artifacts/
	$(WEB_EXT) build

check-file: ## Comprueba un fichero: make check-file FILE=ruta (lo usa el hook de Claude Code)
	@f="$(FILE)"; \
	case "$$f" in *.js|*.mjs) node --check "$$f" || exit 1 ;; esac; \
	case "$$f" in *.js|*.mjs|*.css|*.html|*.json) \
	  [ ! -x node_modules/.bin/prettier ] || node_modules/.bin/prettier --write --ignore-unknown --log-level warn "$$f" ;; \
	esac
