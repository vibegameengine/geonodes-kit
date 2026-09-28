# @vibegameengine/geonodes-kit

Blender Geometry Nodes, evaluated in JavaScript.

You open a `.blend`, run its node trees, and get the same geometry Blender gets. The goal is full
compatibility with one pinned Blender version: any node tree made in that version evaluates here to
the same points, topology, attributes on every domain, and instances.

- **Pinned version:** Blender **5.2.2 LTS** (build `d13f752e3b9c`).
- **Scope:** 360 node types can be created in a Geometry Nodes tree in that build, listed in
  `coverage/nodes-5.2.2.json`.
- **Progress:** tracked per node in `docs/coverage.md`.

## An independent implementation

This kit is **not a port of Blender's code**, and it is licensed MIT. It is built in two roles that
never share a context (the rules are in `docs/process.md`):

- **Analysts** read Blender's source to learn how a node behaves. They write a behaviour
  specification into `docs/spec/`: inputs, outputs, formulas, constants, element order, edge cases.
  A specification contains no code.
- **Implementers** never see Blender's source. They write this kit from the specifications, in its
  own architecture, and check their work against reference geometry from the running Blender.

**Verified against Blender as a black box.** Blender runs headless on the same node trees
(`tools/blender/`) and writes out the evaluated geometry. The tests compare this kit's result with
that reference: every attribute, every domain, every instance transform, within a stated tolerance.
A node is `verified` only when its reference cases pass. `ported` without `verified` is not done.

**Real assets are the acceptance.** Beyond per-node cases, whole Geometry Nodes assets (building
generators from BlenderKit and elsewhere) are opened from their `.blend` and must match Blender's
output.

**Third-party libraries** are only ones whose licences fit an MIT kit (for example Manifold,
OpenSubdiv, OpenVDB, FreeType), and each one is recorded in `docs/process.md`.

## Layout

| Path | What |
|---|---|
| `src/` | The kit: `.blend` reader, geometry core, fields, evaluator, nodes |
| `docs/spec/` | Behaviour specifications, one per node or subsystem |
| `docs/process.md` | Who may read what, and how a node moves from pending to verified |
| `docs/coverage.md` | Every node of the pinned build and its state (generated) |
| `tools/blender/` | Scripts Blender runs headless: node inventory, reference geometry export |
| `tools/runBlender.mjs` | Runs a script in Blender (`BLENDER` env var, defaults to the Steam install) |
| `coverage/` | Node inventory of the pinned build, and the per-node state |

## Tools

```sh
npm run inventory   # regenerate coverage/nodes-5.2.2.json from the installed Blender
npm run coverage    # regenerate docs/coverage.md
npm test            # the kit's tests, including comparisons with Blender references
```

## License

MIT.
