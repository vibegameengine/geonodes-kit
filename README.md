# @vibegameengine/geonodes-kit

Blender Geometry Nodes, evaluated in JavaScript.

You open a `.blend`, run its node trees, and get the same geometry Blender gets. The goal is full
compatibility with one pinned Blender version: any node tree made in that version evaluates here to
the same points, topology, attributes on every domain, and instances.

- **Pinned version:** Blender **5.2.2 LTS** (build `d13f752e3b9c`).
- **Scope:** 360 node types can be created in a Geometry Nodes tree in that build, listed in
  `coverage/nodes-5.2.2.json`.
- **Progress:** tracked per node in `docs/coverage.md`.

## How compatibility is kept honest

**Ported, not re-imagined.** Each module is a port of the matching Blender source, so behaviour is
not guessed from the manual:
- the geometry core (`blenkernel`);
- fields and lazy evaluation (`functions`);
- the node implementations (`nodes/geometry`, `nodes/function`, the shared shader math and textures).

Where Blender calls an external library, the same library is used, built for the web:
- Manifold for booleans;
- OpenSubdiv for subdivision;
- OpenVDB for volumes;
- FreeType for text;
- GMP for the exact boolean solver.

**Verified against Blender itself.** Blender runs headless on the same node trees
(`tools/blender/`) and writes out the evaluated geometry. The tests compare this kit's result with
that reference: every attribute, every domain, every instance transform, within a stated tolerance.
A node is `verified` only when its reference cases pass. `ported` without `verified` is not done.

**Real assets are the acceptance.** Beyond per-node cases, whole Geometry Nodes assets (building
generators from BlenderKit and elsewhere) are opened from their `.blend` and must match Blender's
output.

## Layout

| Path | What |
|---|---|
| `src/` | The kit: `.blend` reader, geometry core, fields, evaluator, nodes |
| `tools/blender/` | Scripts Blender runs headless: node inventory, reference geometry export |
| `tools/runBlender.mjs` | Runs a script in Blender (`BLENDER` env var, defaults to the Steam install) |
| `coverage/` | The node inventory of the pinned build |
| `docs/` | Coverage table, porting notes, source map to Blender files |

## Tools

```sh
npm run inventory   # regenerate coverage/nodes-5.2.2.json from the installed Blender
npm test            # the kit's tests, including comparisons with Blender references
```

## License

GPL-3.0-or-later. The kit ports code from Blender, which is licensed GPL-2.0-or-later.

A game that ships this kit in its bundle ships GPL code. A game that runs the kit only at build time
and ships the resulting geometry does not.
