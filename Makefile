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


# Preset genérico: sustituye cada TODO por el comando real del proyecto.
setup: ## Instala dependencias
	@echo "TODO: define 'setup' en el Makefile"

up: ## Levanta los servicios
	@echo "TODO: define 'up' en el Makefile"

down: ## Para los servicios
	@echo "TODO: define 'down' en el Makefile"

logs: ## Logs de los servicios
	@echo "TODO: define 'logs' en el Makefile"

test: ## Todos los tests
	@echo "TODO: define 'test' en el Makefile"

test-affected: ## Tests de lo cambiado
	@$(MAKE) -s test

lint: ## Comprobaciones estáticas
	@echo "TODO: define 'lint' en el Makefile"

format: ## Formato
	@echo "TODO: define 'format' en el Makefile"

typecheck: ## Comprobación de tipos
	@echo "TODO: define 'typecheck' en el Makefile"

check-file: ## Comprueba un fichero: make check-file FILE=ruta
	@true
