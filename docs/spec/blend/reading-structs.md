# Reading structs from a .blend (Blender 5.x)

How to turn a block's bytes into field values using the file's own SDNA, and how the recurring
building blocks — pointers, arrays, strings, lists, ID headers, array data blocks — are
represented. The container itself (headers, blocks, SDNA encoding, pointer resolution) is in
[file-format.md](./file-format.md).

**[sample]** marks claims checked on `reference/cache/hong-kong-building.blend` (Blender 5.0).
**[5.2 source]** marks layout facts that differ in Blender 5.2.2 and were read from its DNA
definitions; they are not in the sample.

---

## 1. Decoding one struct instance

Inputs: a block header (`sdna_index`, `nr`, `len`, payload offset) and the parsed SDNA.

1. `S = structs[sdna_index]`. The struct's name is `types[S.type_index]`, its size is
   `tlen[S.type_index]`.
2. Instance `i` (0 ≤ i < `nr`) starts at payload offset `i × size`.
3. Walk `S`'s members in order, keeping a running offset that starts at 0. For each member:
   - element count `k` = product of all `[n]` in the member name (1 if none);
   - if the name starts with `*` or `(*`, the member is a pointer (or an array of `k` pointers),
     each pointer-size bytes (8 in 5.x);
   - otherwise it is `k` elements of the member type, each `tlen[member_type]` bytes;
   - the member occupies `k × element_size` bytes at the current running offset; add that to the
     running offset.
4. The running offset after the last member equals the struct size. **[sample]** (all 970 structs)

Look members up by their **identifier** (name stripped of `*`, `(`, `)` and brackets), in the
file's SDNA. Never assume an offset from another Blender version: offsets moved between 5.0 and
5.2 for several structs used here (section 8).

### 1.1 Values of basic members

| Member type | Read as |
|---|---|
| `char`, `uchar` | unsigned 8-bit; a `char name[N]` is a zero-terminated UTF-8 string inside `N` bytes (bytes after the terminator are undefined) |
| `int8_t` | signed 8-bit |
| `short` / `ushort` | 16-bit signed / unsigned |
| `int`, `long` / `ulong` | 32-bit signed / unsigned (`long` is 4 bytes in the SDNA) |
| `float` / `double` | IEEE binary32 / binary64 |
| `int64_t` / `uint64_t` | 64-bit |
| another struct type | a nested instance laid out inline; decode it recursively at its offset |

Enum-typed fields in Blender's headers appear in the SDNA as their storage type (`char`, `short`,
`int`, `int8_t`, ...). Read the storage type from the SDNA, not from the header.

### 1.2 Multi-dimensional arrays and matrices

Array elements are stored in declaration order with the last index varying fastest:
`float parentinv[4][4]` is 16 floats, elements `[0][0], [0][1], [0][2], [0][3], [1][0], ...`.

Blender's 4×4 matrices are stored with the **first index selecting the column**: the translation
is `m[3][0..2]` (floats 12, 13, 14). **[sample]** (`Object.parentinv` of `OBCatenary.007` holds
its translation in floats 12–14 and `1.0` in float 15.) So a `float[4][4]` read in order is a
column-major 4×4 matrix.

---

## 2. Pointers

A pointer member holds an old address (0 = null). Resolve it with the per-ID rule of
file-format.md §5.2. The target block's own `sdna_index` tells what it holds; it may be more
specific than the member's declared type (a `void *data` resolves to a `Mesh` block; an `ID *`
resolves to an `Object`, `Image`, ...). **[sample]**

What a resolved pointer points at depends on the member:

| Member shape | Target block | How to read it |
|---|---|---|
| `T *x` where `T` is a struct, single object | struct block of `T` (or a derived struct), `nr = 1` | decode as §1 |
| `T *x` where `T` is a struct, array of `n` | struct block with `nr = n` | `n` instances back to back; the count comes from a sibling count member |
| `char *x` (string) | `raw_data` block | zero-terminated UTF-8; `len` includes the terminator **[sample]** |
| `float *x`, `int *x`, `void *x` (number array) | `raw_data` block, `nr = 1` | `len` bytes of packed elements; element type and count come from context (a count member, or the owning struct's semantics) **[sample]** |
| `T **x` (pointer array) | `raw_data` block, `nr = 1`, `len = count × 8` | `count` old addresses, each resolved again **[sample]** (`Mesh.mat` → 2 Material pointers; `bNodeTreeInterfacePanel.items_array`) |
| `(*x)()` | as a plain pointer | only used for data Geometry Nodes does not need |
| pointer to a run-time type (TLEN 0) | none | ignore; the stored value is stale **[sample]** |

Rule for array pointers: always take the element count from the owning struct (e.g.
`Mesh.totvert`, `AttributeArray.size`, `bNodeTreeInterfacePanel.items_num`) and use the block's
`len` only as a consistency check. When the count is 0, do not follow the pointer (it may be
non-null and dangling). **[sample]**

---

## 3. ListBase linked lists

`ListBase` is a struct of two pointers: `first` and `last`. **[sample]**

Every struct stored in a ListBase begins with two pointers, `next` at offset 0 and `prev` at
offset 8 (for a struct whose first member is a nested struct, the nested struct begins with
them — e.g. `NodesModifierData` begins with `ModifierData`, which begins with `next`, `prev`).
**[sample]**

To iterate: start at `first`, resolve it to a block, read the element, then follow the pointer at
offset 0 (`next`) until it is null. Each element is normally its own block with `nr = 1`.
**[sample]** (modifier lists, node lists, link lists, socket lists, IDProperty groups, collection
object and child lists all verified). Guard against cycles.

`last` and `prev` are redundant for reading.

---

## 4. ID blocks

Every data-block type (`Object`, `Mesh`, `bNodeTree`, `Collection`, `Scene`, ...) is a struct
whose first member is an `ID` struct named `id`. **[sample]**

`ID` layout in the sample SDNA (408 bytes) **[sample]**:

| Offset | Member | Meaning |
|---:|---|---|
| 0 | `*next`, 8 `*prev` | Written as null in 5.x files. **[sample]** (all 1 659 IDs) |
| 16 | `*newid` | run-time |
| 24 | `*lib` | Library the ID is linked from; null for local data. **[sample]** (all IDs local) |
| 32 | `*asset_data` | asset metadata, if the ID is marked as an asset |
| 40 | `name[258]` | two-letter type code followed by the user-visible name, zero-terminated, e.g. `OBCube.001`, `NTbuild system`, `GRScene Collection` |
| 298 | `flag` (short) | |
| 300 | `tag`, `us`, `icon_id`, `recalc`, ... (ints) | run-time / bookkeeping |
| 344 | `*properties` | user custom properties (IDProperty group) |
| 352 | `*system_properties` | system-owned IDProperty group |
| 368 | `*override_library`, 376 `*orig_id`, 384 `*py_instance` | not needed |
| 392 | `*library_weak_reference` | set on data appended with "reuse"; a `LibraryWeakReference` DATA block |
| 400 | `*runtime` | run-time |

Other ID-level facts:

- The ID's `name` prefix normally equals the block code's two letters (`OB`, `ME`, `NT`, ...).
  Exception: screens use block code `SN` but name prefix `SR`. **[sample]** (11 screens)
- The name without the two-letter prefix is what users see; names are unique per ID type within
  one file.
- **Embedded IDs** are full ID structs stored as `DATA` blocks owned by another ID, not as ID
  blocks: a material's or world's node tree (`bNodeTree` DATA block with name
  `NTShader Nodetree`), a scene's master collection (`Collection` DATA block named
  `GRScene Collection`). They are reached only through their owner's pointer, and their internal
  pointers resolve within the **owner's** block group. **[sample]**
- Pointers between IDs (object → mesh, collection → object, socket → collection, ...) resolve to
  ID blocks anywhere in the file. **[sample]**

### 4.1 IDProperty

Custom properties, modifier input values and a few UI settings are `IDProperty` trees. Layout in
the sample (144 bytes) **[sample]**:

| Offset | Member | Meaning |
|---:|---|---|
| 0 | `*next`, 8 `*prev` | siblings inside a group (ListBase links) |
| 16 | `type` (char) | see table below |
| 17 | `subtype` (char) | for strings: 0 = UTF-8, 1 = raw bytes; for arrays: the element type (a `type` code) |
| 18 | `flag` (short) | |
| 20 | `name[64]` | property name |
| 88 | `data` (`IDPropertyData`, 40 bytes) | see below |
| 128 | `len` (int) | array length, or string length **including** the terminator |
| 132 | `totallen` (int) | allocated length; ignore |
| 136 | `*ui_data` | UI metadata (min/max/defaults); not needed for evaluation |

`IDPropertyData`: `*pointer` at +0, `group` (ListBase) at +8, `*children_map` at +24 (run-time,
stale), `val` at +32, `val2` at +36.

| `type` | Name | Value is stored in |
|---:|---|---|
| 0 | STRING | `data.pointer` → raw_data block of `len` bytes |
| 1 | INT | `data.val` (int32) |
| 2 | FLOAT | `data.val` reinterpreted as binary32 |
| 5 | ARRAY | `data.pointer` → raw_data block of `len` elements of type `subtype` (1 = int32, 2 = float32, 8 = float64, 10 = int8 boolean); `subtype` 6 = array of groups (struct block of `len` IDProperty) |
| 6 | GROUP | `data.group`: ListBase of child IDProperty blocks, in order |
| 7 | ID | `data.pointer` → an ID block |
| 8 | DOUBLE | the 8 bytes of `val` and `val2` together, as binary64 (little-endian: `val` is the low half) |
| 9 | IDPARRAY | `data.pointer` → struct block of `len` IDProperty |
| 10 | BOOLEAN | `data.val` (0 or 1) |

Checked on the sample: GROUP, INT, FLOAT and STRING (an empty string has `len = 1` and a 1-byte
raw block containing `00`). **[sample]** DOUBLE, ARRAY, ID, BOOLEAN and IDPARRAY do not occur in
the sample's modifier properties.

---

## 5. Array data blocks

Large arrays owned by a struct (mesh positions, face offsets, attribute values, pointer arrays,
strings) are separate blocks:

- The owning struct holds an old address; the target is usually a `raw_data` block (`sdna_index
  0`, `nr = 1`) whose `len` is the byte size of the whole array. **[sample]** (all 1 132 mesh
  attribute arrays and all 147 face-offset arrays)
- Arrays of structs are a single struct block with `nr` = element count (e.g. a mesh's
  `Attribute` array is one block with `nr = 9`). **[sample]**
- The element type is not stored in a raw block. It follows from the owner: e.g. an attribute's
  `data_type` (geometry-nodes-data.md §7), or the declared member type (`int *` → int32).
- Arrays may be shared between data-blocks at run time ("implicit sharing"). In the file an
  array is written inside each ID that uses it; copies written for different IDs can carry the
  same old address. Resolve per ID; a reader may deduplicate identical arrays but must not rely
  on sharing. (The sample contains no shared attribute arrays; it does contain identical
  attribute-name strings at the same old address in several meshes.) **[sample]**

---

## 6. Names in the file versus names in Blender's current code

The SDNA in a file keeps the member and struct names from when those members were first written
("static" names). Blender renames members in its code without changing the file format, so the
names a reader must use are the file's names. Relevant cases, all verified present under the left
name in the sample's SDNA **[sample]**:

| Struct | Name in the file | Name in Blender 5.2 code |
|---|---|---|
| `Object` | `size` | `scale` |
| `Object` | `dup_group` | `instance_collection` |
| `Object` | `dupfacesca` | `instance_faces_scale` |
| `Object` | `col` | `color` |
| `Object` | `restrictflag` | `visibility_flag` |
| `Mesh` | `totvert`, `totedge`, `totpoly`, `totloop` | `verts_num`, `edges_num`, `faces_num`, `corners_num` |
| `Mesh` | `poly_offset_indices` | `face_offset_indices` |
| `Mesh` | `vdata`, `edata`, `pdata`, `ldata`, `fdata` | `vert_data`, `edge_data`, `face_data`, `corner_data`, `fdata_legacy` |
| `Mesh` | `loc`, `size`, `texflag`, `smoothresh` | `texspace_location`, `texspace_size`, `texspace_flag`, `smoothresh_legacy` |
| `Collection` | `dupli_ofs` | `instance_offset` |
| `NodesModifierData` | `settings` | `settings_legacy` |
| `NodesModifierData` | `simulation_bake_directory` | `bake_directory` |
| `bNode` | `type` | `type_legacy` |
| `bNode` | `locx`, `locy`, `offsetx`, `offsety` | `*_legacy` |
| `bNodeLink` | `multi_input_socket_index` | `multi_input_sort_id` |
| `bNodeTree` | `inputs`, `outputs` | `inputs_legacy`, `outputs_legacy` |

Struct type names follow the same rule: the sample stores lights as `Lamp`. **[sample]**

A reader written against these file names works for any 5.x file, because a renamed member keeps
its file name forever.

---

## 7. Worked example: reaching a mesh from an object

From the sample, object `OBCube.001` **[sample]**:

1. Block code `OB\0\0`, `sdna_index` → `Object` (1 296 bytes).
2. `Object.type` (short, offset 424) = 1 (mesh).
3. `Object.data` (pointer, offset 560) resolves — not in the object's own blocks, so among ID
   blocks — to an `ME\0\0` block.
4. `Object.modifiers` (ListBase, offset 664) → `first` resolves inside the object's own DATA
   blocks to a `NodesModifierData` block.

Offsets above are from the 5.0 sample's SDNA; compute them from the file's SDNA in practice.

---

## 8. Version differences a 5.x reader must handle

The SDNA makes most layout changes transparent: members found by name are read correctly whatever
their offset, and members absent from a file are simply missing (treat them as zero/default).
These are the changes that matter semantically for Geometry Nodes data:

| Change | 5.0 sample | 5.2.2 |
|---|---|---|
| Container | New 17-byte header and 32-byte block headers. **[sample]** | same |
| Mesh attributes | Generic attributes in `Mesh.attribute_storage` (`Attribute` array); `vdata`/`edata`/`pdata`/`ldata` hold only non-generic layers (none in the sample). **[sample]** | same, but see next row |
| Single-value attributes | Only array storage (`storage_type = 0`). **[sample]** | Mesh attributes may be written with `storage_type = 1` (one value for the whole domain, `AttributeSingle`). `AttributeArray` gains `is_single` (int8) + 7 pad bytes (24 → 32 bytes); when `is_single` is 1 the array is a full-length array holding one repeated value. **[5.2 source]** |
| Mesh UV names | `active_uv_map_attribute`, `default_uv_map_attribute` | adds `stencil_uv_map_attribute`, `clone_uv_map_attribute` **[5.2 source]** |
| Modifier input values | `NodesModifierData.settings.properties`: flat IDProperty group named `Nodes Modifier Settings`. **[sample]** | Primary storage moves to a new `ModifierData.system_properties` group with `inputs` / `outputs` / `panels` sub-groups; the flat group is still written next to it for older readers. **[5.2 source]** (details in geometry-nodes-data.md §4) |
| Node tree interface socket | `structure_type` + 7 pad bytes | `structure_type`, `is_pixel_socket_forward_compat` (char), 6 pad bytes **[5.2 source]** |
| Node socket | has `short_label[64]` | `short_label` removed **[5.2 source]** |
| Socket value structs | Int, Float, Boolean, Vector, Rotation, RGBA, String, Object, Image, Collection, Texture, Material, Menu **[sample]** | adds IntVector, Font, Scene, Text, Mask, Sound **[5.2 source]** |
| Node tree | — | adds `view_width` and `compositor_node_asset_traits` (UI / compositor only) **[5.2 source]** |

Files older than 5.0 (4.x) store mesh attributes in `CustomData` layers and use the older
header/BHead layouts; they are outside the scope of this document.
