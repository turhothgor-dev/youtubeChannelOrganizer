#!/usr/bin/env python3
"""Genera los ficheros de cada herramienta de IA a partir de la fuente única.

Fuente:  AGENTS.md y ai/skills/<nombre>/ del proyecto.
Salida:  según los módulos activos en .kit/modules.txt
         - adapter-claude-code: .claude/skills/<nombre>/
         - adapter-cline:       .cline/skills/<nombre>/     (si no hay Claude Code)
         - adapter-continue:    .continue/skills/<nombre>/  (si no hay Claude Code)
         Cline y Continue también leen .claude/skills/, así que con Claude Code no se duplican.
         En las copias para Cline y Continue se quitan los campos propios de Claude
         (context, agent).

Solo gestiona lo que él mismo generó (lista .ai-kit-managed en cada carpeta):
las skills que crees a mano no se tocan.

Uso: python3 .kit/scripts/ai_sync.py [raíz del proyecto]   (o `make ai-sync`)
"""
import shutil
import sys
from pathlib import Path


def active_modules(root: Path) -> set[str]:
    f = root / ".kit" / "modules.txt"
    if not f.exists():
        return set()
    return {line.strip() for line in f.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")}


BUILTIN_AGENTS = {"Explore", "Plan", "general-purpose"}


def adapt_for_claude(skill_md: Path, agents_dir: Path) -> None:
    """Si la skill se ejecuta en un subagente que no existe en el proyecto, quita
    `context: fork` y `agent:` para que se ejecute en la conversación principal."""
    text = skill_md.read_text(encoding="utf-8")
    if not text.startswith("---\n") or "\n---\n" not in text[4:]:
        return
    head, body = text[4:].split("\n---\n", 1)
    lines = head.splitlines()
    agent = next((l.split(":", 1)[1].strip() for l in lines if l.startswith("agent:")), None)
    if agent is None or agent in BUILTIN_AGENTS or (agents_dir / f"{agent}.md").exists():
        return
    lines = [l for l in lines if not l.startswith(("agent:", "context:"))]
    skill_md.write_text("---\n" + "\n".join(lines) + "\n---\n" + body, encoding="utf-8", newline="\n")
    print(f"  {skill_md.parent.name}: sin subagente '{agent}' en el proyecto; se ejecutará en la conversación principal")


def sync_skills(src: Path, dst: Path) -> list[str]:
    dst.mkdir(parents=True, exist_ok=True)
    marker = dst / ".ai-kit-managed"
    previous = set(marker.read_text(encoding="utf-8").split()) if marker.exists() else set()
    current = sorted(p.name for p in src.iterdir() if (p / "SKILL.md").is_file()) if src.is_dir() else []

    # Borra las que generó antes y ya no están en la fuente
    for name in previous - set(current):
        stale = dst / name
        if stale.is_dir():
            shutil.rmtree(stale)

    managed = []
    for name in current:
        target = dst / name
        if target.exists() and name not in previous:
            print(f"  omitida {name}: ya existe una skill propia con ese nombre en {dst}")
            continue
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(src / name, target)
        managed.append(name)

    marker.write_text("".join(f"{n}\n" for n in managed), encoding="utf-8", newline="\n")
    return managed


def strip_claude_fields(skill_md: Path) -> None:
    """Adapta una skill para Cline y Continue: quita `context:` y `agent:` y el placeholder $ARGUMENTS."""
    text = skill_md.read_text(encoding="utf-8")
    if not text.startswith("---\n") or "\n---\n" not in text[4:]:
        return
    head, body = text[4:].split("\n---\n", 1)
    lines = [l for l in head.splitlines() if not l.startswith(("agent:", "context:"))]
    # Cline y Continue no sustituyen $ARGUMENTS: añaden el texto tras el comando
    body = body.replace("$ARGUMENTS", "(el texto que la persona escriba tras el comando)")
    skill_md.write_text("---\n" + "\n".join(lines) + "\n---\n" + body, encoding="utf-8", newline="\n")


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    modules = active_modules(root)
    skills_src = root / "ai" / "skills"
    done = []

    if "adapter-claude-code" in modules:
        names = sync_skills(skills_src, root / ".claude" / "skills")
        for name in names:
            adapt_for_claude(root / ".claude" / "skills" / name / "SKILL.md", root / ".claude" / "agents")
        done.append(f".claude/skills ({len(names)} skills)")

    # Cline y Continue leen .claude/skills/; solo hace falta su carpeta si no hay Claude Code.
    if "adapter-claude-code" not in modules:
        for module, folder in (("adapter-cline", ".cline/skills"), ("adapter-continue", ".continue/skills")):
            if module in modules:
                names = sync_skills(skills_src, root / folder)
                for name in names:
                    strip_claude_fields(root / folder / name / "SKILL.md")
                done.append(f"{folder} ({len(names)} skills)")

    print("ai-sync: " + (", ".join(done) if done else "ningún adaptador activo"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
