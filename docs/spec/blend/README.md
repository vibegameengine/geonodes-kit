# .blend reading — specifications

Format and behaviour specifications for reading Geometry Nodes setups out of `.blend` files written
by Blender 5.x. They describe byte layouts, field meanings and rules; they contain no Blender code.

| File | Contents |
|---|---|
| [file-format.md](./file-format.md) | Container: file header variants, block headers (32/24/20-byte), block codes, `REND`/`TEST`/`GLOB`/`ENDB`, old addresses and the per-ID pointer resolution rule, zstd/gzip compression and the zstd seek table, the `DNA1` (SDNA) block and struct layout rules. |
| [reading-structs.md](./reading-structs.md) | Decoding a struct with SDNA: member offsets, basic types, arrays and matrices, pointers, pointer arrays, strings, ListBase, the ID header, IDProperty, array data blocks, file names versus current code names, 5.0 → 5.2 differences. |
| [geometry-nodes-data.md](./geometry-nodes-data.md) | Object → Nodes modifier → node tree; nodes, sockets and default values, links, group interface, modifier input values (5.0 flat and 5.2 structured), storage/settings of the kit's 16 node types with enum values, object transforms, 5.x mesh attribute storage, collections; proposed reference cases. |

## Sources consulted

- Blender 5.2.2 source (tag `v5.2.2`), sparse checkout at `E:\Reference\blender-5.2.2-src`:
  - `source/blender/makesdna/` — `DNA_sdna_types.h`, `DNA_ID.h`, `DNA_ID_enums.h`,
    `DNA_node_types.h`, `DNA_node_tree_interface_types.h`, `DNA_modifier_types.h`,
    `DNA_object_types.h`, `DNA_action_types.h`, `DNA_mesh_types.h`, `DNA_attribute_types.h`,
    `DNA_customdata_types.h`, `DNA_collection_types.h`, `intern/dna_genfile.cc`,
    `intern/dna_utils.cc`, `intern/dna_parse.cc`, `intern/dna_rename_defs.h`.
  - `source/blender/blenkernel/` — `intern/object.cc` (transform composition, legacy modifier
    properties on save), `intern/mesh.cc` (mesh write), `intern/attribute_storage.cc`,
    `intern/customdata.cc`, `intern/node_runtime.cc` (multi-input link order),
    `BKE_attribute_enums.hh`, `BKE_main.hh`.
  - `source/blender/blenlib/` — `intern/filereader_zstd.cc`, `intern/fileops_c.cc`,
    `intern/math_rotation_c.cc` (Euler order convention).
  - `source/blender/nodes/` — `intern/geometry_nodes_execute.cc`, `intern/geometry_nodes_srna.cc`,
    `NOD_geometry_nodes_execute.hh`, `NOD_geometry_nodes_srna.hh`, `intern/node_socket.cc`, and the
    node files of the 16 node types (settings storage only).
  - `source/blender/blenloader/` (the actual reader/writer) is **not** in the checkout. Header and
    block-header layouts were therefore established from the sample bytes; the old 12-byte header
    and the 24/20-byte block headers are described from the format's history and are unverified.
- Sample file `reference/cache/hong-kong-building.blend` (21 850 153 bytes, Blender 5.0,
  uncompressed), parsed independently with a throwaway script outside the repository.

## Verified on the sample bytes

- Header `BLENDER17-01v0500` (17 bytes) and the 32-byte block header field order
  (code, sdna index, old, len, nr); the whole file parses into 32 989 blocks ending exactly at the
  end of `ENDB`.
- `REND` (1, 250, `Scene`), `TEST` (128 × 128 RGBA + 8), `GLOB` = `FileGlobal`
  (sub-version 118, min version 405.85), `DNA1` just before `ENDB`.
- SDNA encoding, including 4-byte padding measured from the DNA1 payload start (the payload is
  unaligned in the file): 5 225 names, 1 109 types, 970 structs, exact byte consumption.
- Offsets by running sum: computed size equals TLEN for all 970 structs; `len = nr × size` for all
  26 884 struct blocks; all 9 694 members naturally aligned; `long` is 4 bytes.
- Old addresses are unique only per ID: 21 addresses repeat across IDs, 18 with different
  contents; none repeats inside one ID. Per-ID-then-global resolution resolves every non-runtime
  pointer; runtime pointers and zero-count arrays (`bakes`, `panels`) dangle.
- ID header layout, null `ID.next`, screen code `SN` vs name prefix `SR`, embedded node trees and
  master collection as DATA blocks.
- IDProperty GROUP/INT/FLOAT/STRING layouts; the modifiers' flat `Nodes Modifier Settings` groups.
- Object → modifiers → `NodesModifierData` (type 57) → node tree; all 763 links consistent with
  their nodes' socket lists; interface item tree (`item_type` 0 panel / 1 socket, pointer-array
  `items_array`); Group Input/Output sockets plus `__extend__`.
- Socket identifiers, storage struct names and observed setting values for all 16 node types.
- Mesh: `AttributeStorage` with 1 132 arrays whose size and byte length match their domain; face
  offsets for all 147 meshes; `.corner_edge` ↔ `.corner_vert` relation for every corner; empty
  `CustomData` with zero typemap.
- Collections, children, master collection flag 32; object `rotmode` 1 everywhere, parent type 0,
  `parentinv` translation in floats 12–14.

## Open points

1. Old 12-byte header and 24/20-byte block headers: not in the sample and not in the checkout.
2. Compression: seek table taken from the zstd reader source; no compressed sample was checked.
3. Modifier value types for bool, vector, color, rotation, string, menu and ID inputs; missing-key
   fallback; exact 5.2.2 `system_properties` contents on disk — needs a 5.2.2-saved reference.
4. Object world-matrix formula and Euler convention — needs exported world matrices.
5. Multi-input link order (descending index) — needs a Join Geometry reference.
6. Muted links and links to unavailable sockets — behaviour not pinned.
7. Single-value mesh attributes (`storage_type` 1, `is_single`) in 5.2.2 files — not seen yet.
8. Implicit-sharing arrays shared between meshes — expected to be written once per ID with the
   same old address; the sample contains no such array.

Proposed reference cases are listed in geometry-nodes-data.md §9.
