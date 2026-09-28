# Process: analysts, implementers, references

The kit reaches Blender compatibility without becoming a derivative of Blender's code. Blender is
GPL-2.0-or-later; this kit is MIT, and games ship it in their bundles. Reading Blender's source is
not the problem. Code that is a translation of it — the same structure, names and sequence of steps
in another language — is.

The two roles below keep that line provable.

## Roles

### Analyst

- **May read** Blender's source: a shallow sparse checkout of tag `v5.2.2`, kept outside this
  repository and never committed.
- **Writes** a behaviour specification into `docs/spec/<area>/<node-or-subsystem>.md`.
- **A specification describes behaviour, never code:**
  - inputs and outputs, with types, domains and defaults;
  - properties and every enum mode;
  - what is computed, as formulas or plain steps;
  - numeric constants that decide the result (seeds, hash constants, tolerances);
  - the order of elements in the output (vertex, edge, face and corner indices, curve and instance
    order) and how attributes propagate to it;
  - edge cases: empty input, zero sizes, degenerate faces, NaN, out-of-range indices.
- **Never pastes source code into a specification, and never paraphrases it line by line.** Pseudo-code
  that mirrors Blender's functions is not allowed either. If a behaviour can only be described by
  retelling a routine, describe the observable result and add a reference case that pins it.
- **Proposes reference cases:** node trees plus inputs whose Blender output should be captured.

### Implementer

- **Never reads** Blender's source, any fragment of it, or a path into the checkout. This holds even
  briefly, even to check one detail. When a detail is missing, the answer is a question for an
  analyst or a new reference case.
- **Reads** the specifications, the Blender manual, published algorithms and papers, and the
  reference geometry.
- **Writes** `src/` in this kit's own architecture and naming.
- **Proves** each node with reference cases. A node is `verified` only when all its cases pass.

**One context never plays both roles.** An agent that has read Blender's source in a session does
not write `src/` in that session.

## References

`tools/blender/` holds scripts that the pinned Blender runs headless:
- `inventory.py` — lists every node type a Geometry Nodes tree accepts, with its sockets, defaults
  and enum properties.
- Reference export (planned) — builds or loads a node tree, evaluates it, and writes the resulting
  geometry: every component, every attribute on every domain, instance transforms and references.

This is output of the program, not its code.

## Node states

| State | Meaning |
|---|---|
| pending | No implementation |
| ported | Implemented from a spec; not all reference cases pass yet |
| verified | Every reference case for the node passes |

`coverage/status.json` holds the state. `npm run coverage` regenerates `docs/coverage.md`.

## Third-party libraries

A library may be used only if its licence fits an MIT kit shipped inside games.

| Library | Use | Licence | Status |
|---|---|---|---|
| Manifold | mesh booleans | Apache-2.0 | allowed |
| OpenSubdiv | subdivision surfaces | Apache-2.0 (modified) | allowed |
| OpenVDB | volumes | MPL-2.0 | allowed |
| FreeType | String to Curves | FreeType License | allowed |
| GMP | exact arithmetic | LGPL | not allowed in the bundle |
