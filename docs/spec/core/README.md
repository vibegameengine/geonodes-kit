# Core specifications

Behaviour of the machinery every node relies on. Written by an analyst from Blender 5.2.2 (tag
`v5.2.2`) and checked against the running Blender 5.2.2 LTS where marked **verified**. They contain no
Blender code.

| File | Covers |
|---|---|
| [geometry-set.md](geometry-set.md) | The geometry container, component kinds, instances and references, nesting, Join Geometry (order, attribute union, type and domain choice, fill values, materials, volumes) |
| [attributes.md](attributes.md) | Domains, data types and their defaults, built-in and reserved attributes, implicit type conversion, domain interpolation for meshes, curves and grease pencil |
| [fields.md](fields.md) | Fields, field inputs, where and on which geometry a field is evaluated, selections, anonymous attributes, single values vs fields |
| [evaluation.md](evaluation.md) | Evaluating a tree: counted links, socket values and defaults, multi-inputs, reroutes, frames, muted nodes, Switch / Index Switch laziness, node groups, order independence |
| [random-value.md](random-value.md) | The Random Value node for Float, Integer, Vector and Boolean, bit-exact: hash, word order, float mapping, ranges |

Each file ends with **Reference cases** in the format of `reference/cases/cases.json`, runnable with
`tools/blender/cases.py`, using the socket identifiers of `coverage/nodes-5.2.2.json`. All listed JSON
cases were captured with Blender 5.2.2 while writing the specs and their observed results are stated
next to them. Cases that the runner cannot build yet (materials, node groups, several Group Output
nodes) are listed as proposals in prose.

## Sources consulted

Blender source, tag `v5.2.2`, directories under `source/blender/`:

- `nodes/function/nodes/` — Random Value.
- `nodes/geometry/nodes/` — Join Geometry, Switch, Index Switch, Store Named Attribute, Named
  Attribute, Radius input.
- `nodes/intern/` — lazy tree evaluation (links, defaults, multi-inputs, muted nodes, group nodes,
  conversions on links), implicit socket inputs in node declarations, group-node socket declarations,
  socket types and their default values, final output clean-up.
- `blenkernel/intern/` — geometry fields and field contexts, attribute access and type/domain
  priorities, mesh and curves domain interpolation, attribute mixing, implicit type conversions,
  built-in attribute tables for mesh, curves, point cloud, instances and grease pencil, attribute
  storage defaults, instance references, geometry-set equality, internal links of muted nodes, link
  sorting of multi-inputs, vertex-to-face maps.
- `blenkernel/` headers — anonymous attribute naming, attribute mixers.
- `geometry/intern/` — join of geometries, realize instances.
- `functions/intern/` — field evaluation (defaults for missing inputs, constant fields, selections).
- `blenlib/intern/` — the lookup3 hash and hash-to-float mapping, colour byte encoding, value-type
  defaults.

Not available in the checkout and therefore not inspected: the modifier (`modifiers/`), colour
management (`imbuf/`, luminance coefficients were measured instead), build flags.

## Open points

- Byte-colour encoding uses a fast power approximation in Blender; rare one-byte differences from the
  exact sRGB formula are possible and were not searched for.
- Material handling on join (list order, out-of-range indices, dropped `material_index`) and
  grease-pencil joins are read from the source only.
- How the modifier supplies root Group Input values that were never set.
- Luminance coefficients depend on the colour-management configuration; the values given are those of
  the factory configuration.
