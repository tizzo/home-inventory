# Windsurf Setup (Repo-Tracked)

This repo contains `AGENTS.md` files which Windsurf/Cascade automatically applies based on directory scope:

- `/AGENTS.md` applies to the entire repo
- `/backend/AGENTS.md` applies to backend work
- `/frontend/AGENTS.md` applies to frontend work

## Optional: Windsurf Rules

Windsurf "Rules" live in `.windsurf/rules/` folders, but in this environment `.windsurf/` is not writable.

To use the Rules content tracked in this repo:

- Create this folder locally:
  - `.windsurf/rules/`
- Copy/paste the contents of `WINDSURF_RULES.md` into one or more `.md` files in `.windsurf/rules/`.
- Alternatively, paste the rules into Windsurf:
  - `Cascade -> Customizations -> Rules`

## Optional: Windsurf Workflows

Windsurf "Workflows" live in `.windsurf/workflows/` folders.

To use workflows:

- Create this folder locally:
  - `.windsurf/workflows/`
- Copy/paste the contents of `WINDSURF_WORKFLOWS.md` into workflow `.md` files.
- Invoke workflows in Cascade via `/workflow-name`.
