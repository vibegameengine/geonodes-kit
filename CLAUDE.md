# CLAUDE.md

Read `docs/process.md` before doing anything in this repository.

- This kit is an **independent** implementation of Blender Geometry Nodes, licensed MIT. It must
  never become a translation of Blender's GPL code.
- **Writing `src/` means you are an implementer.** Do not open Blender's source or any path into a
  Blender source checkout, not even to check one detail. Work from `docs/spec/`, the Blender manual,
  published algorithms and the reference geometry that `tools/blender/` produces.
- **Reading Blender's source means you are an analyst.** You write only `docs/spec/` and reference
  cases, never `src/`, and a specification never contains Blender code or a line-by-line
  paraphrase of it.
- **A node is done when it is `verified`:** every reference case captured from Blender 5.2.2 passes.
- **No comments in code.** Say it in a name. Anything worth keeping that a name cannot carry goes
  into `docs/`.
