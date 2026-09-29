# The .blend container (Blender 5.x)

This document describes the byte-level container of a `.blend` file as written by Blender 5.x:
the file header, the block headers, the terminator, compression, old-address pointers and the
embedded structure description (SDNA). How to decode individual structs from blocks is in
[reading-structs.md](./reading-structs.md); where Geometry Nodes data lives is in
[geometry-nodes-data.md](./geometry-nodes-data.md).

Claims marked **[sample]** were checked byte-for-byte against
`reference/cache/hong-kong-building.blend` (21 850 153 bytes, saved by Blender 5.0, uncompressed).
Claims marked **[not in sample]** describe variants the sample does not contain; they come from
the container's documented history and must be pinned with a reference file before an
implementation relies on them.

All multi-byte integers in a 5.x file are little-endian.

---

## 1. Overall layout

```
[file header][block][block]...[block "DNA1"][block "ENDB"]
```

- The file is a flat sequence of blocks. Each block is a block header (BHead) immediately
  followed by `len` bytes of payload. There is no padding between blocks and no index. **[sample]**
- A block may start at any byte offset; blocks are **not** aligned in the file (the SDNA block of
  the sample starts at file offset 21 718 177, which is not a multiple of 4). **[sample]**
- The last block is `ENDB`. The file ends exactly at the end of the `ENDB` block header. **[sample]**
- The `DNA1` block (the structure description) is written near the end, just before `ENDB`.
  A reader must scan the whole file (or jump to the end) to get SDNA before it can decode any
  struct block. **[sample]**

Block order observed in the sample: `REND`, `TEST`, `GLOB`, then ID blocks each followed by their
`DATA` blocks, then `DNA1`, then `ENDB`. **[sample]**

---

## 2. File header

A file starts with the 7 ASCII bytes `BLENDER`. What follows decides the header variant.

### 2.1 New header (Blender 5.x, "large BHead" format)

Detected when bytes 7..8 are ASCII digits. **[sample]**

The sample begins with the 17 bytes `BLENDER17-01v0500`.

| Offset | Size | Bytes in sample | Meaning |
|---:|---:|---|---|
| 0 | 7 | `BLENDER` | Magic. |
| 7 | 2 | `17` | Total header length in bytes, as two ASCII decimal digits. The first block header starts at this offset. |
| 9 | 1 | `-` | Pointer size: `-` = 8-byte pointers. |
| 10 | 2 | `01` | File-format version, two ASCII digits. `01` = block headers use the 32-byte "large" layout (section 3.1). |
| 12 | 1 | `v` | Endianness: `v` = little-endian. |
| 13 | 4 | `0500` | Blender version that wrote the file, four ASCII digits (`0500` = 5.0). |

Rules:

- Parse the header length from bytes 7..8 rather than assuming 17, and start the first block at
  that offset.
- A reader that does not know the file-format version in bytes 10..11 must refuse the file.
- The four-digit version is the major/minor version only. The sub-version is stored in the `GLOB`
  block (section 4.3). In the sample `GLOB` gives sub-version 118, minimum reader version 405,
  minimum reader sub-version 85. **[sample]**

### 2.2 Old header (12 bytes)

Detected when byte 7 is `_` or `-`. **[not in sample]** Used by files from Blender versions before
the large-BHead format; a 5.x reader meets it when loading older assets.

| Offset | Size | Meaning |
|---:|---:|---|
| 0 | 7 | `BLENDER` |
| 7 | 1 | Pointer size: `_` = 4 bytes, `-` = 8 bytes. |
| 8 | 1 | Endianness: `v` = little-endian, `V` = big-endian. |
| 9 | 3 | Version, three ASCII digits, e.g. `405` = 4.5. |

The first block header starts at offset 12. The block-header layout is chosen by the pointer size
(section 3.2 / 3.3).

### 2.3 Endianness

Blender 5.x only handles little-endian data; the SDNA code in 5.2.2 notes that endian conversion
is a thing of the past. A reader for 5.x files may reject big-endian (`V`) files.

---

## 3. Block header (BHead)

Every block header carries the same five logical fields:

| Field | Meaning |
|---|---|
| `code` | 4 bytes identifying the block kind (section 4). |
| `len` | Payload length in bytes, not counting the header. |
| `old` | The "old address": an opaque identifier of the payload, used by pointers in other blocks (section 5). |
| `sdna_index` | Index into the SDNA **struct** list (not the type list) giving the struct stored in the payload. `0` means "raw bytes, no struct". |
| `nr` | Number of consecutive struct instances in the payload. |

For a struct block, `len == nr × size(struct)`. This held for all 26 884 struct blocks in the
sample. **[sample]**

### 3.1 Large BHead — 32 bytes (file-format version `01`) **[sample]**

| Offset | Size | Type | Field |
|---:|---:|---|---|
| 0 | 4 | 4 bytes | `code` |
| 4 | 4 | int32 | `sdna_index` |
| 8 | 8 | uint64 | `old` |
| 16 | 8 | int64 | `len` |
| 24 | 8 | int64 | `nr` |

Note the field order differs from the old layouts: `sdna_index` comes second and `len` fourth.

Worked example from the sample, file offset 17 (the first block):
`52 45 4E 44 | 00 00 00 00 | 10 00 00 00 00 00 00 00 | 08 01 00 00 00 00 00 00 | 01 00 00 00 00 00 00 00`
= code `REND`, sdna_index 0, old 0x10, len 264, nr 1. Payload starts at offset 49.

### 3.2 Small BHead for 8-byte pointers — 24 bytes (old header, pointer char `-`) **[not in sample]**

| Offset | Size | Type | Field |
|---:|---:|---|---|
| 0 | 4 | 4 bytes | `code` |
| 4 | 4 | int32 | `len` |
| 8 | 8 | uint64 | `old` |
| 16 | 4 | int32 | `sdna_index` |
| 20 | 4 | int32 | `nr` |

### 3.3 BHead for 4-byte pointers — 20 bytes (old header, pointer char `_`) **[not in sample]**

| Offset | Size | Type | Field |
|---:|---:|---|---|
| 0 | 4 | 4 bytes | `code` |
| 4 | 4 | int32 | `len` |
| 8 | 4 | uint32 | `old` |
| 12 | 4 | int32 | `sdna_index` |
| 16 | 4 | int32 | `nr` |

A file uses exactly one BHead layout throughout.

---

## 4. Block codes

`code` is 4 bytes. ID blocks use a two-letter ID code padded with two zero bytes.

### 4.1 Codes found in the sample **[sample]**

| Code | Count | Payload |
|---|---:|---|
| `REND` | 1 | Render info (4.2). |
| `TEST` | 1 | File thumbnail (4.4). |
| `GLOB` | 1 | `FileGlobal` struct (4.3). |
| `DATA` | 31 325 | Data belonging to the most recent ID block (section 5). |
| `DNA1` | 1 | SDNA (section 7). |
| `ENDB` | 1 | Terminator (section 4.5). |
| `OB\0\0` | 1 217 | `Object` |
| `ME\0\0` | 147 | `Mesh` |
| `GR\0\0` | 169 | `Collection` |
| `NT\0\0` | 2 | `bNodeTree` (node groups; embedded trees are `DATA`, see geometry-nodes-data.md) |
| `SC\0\0` | 1 | `Scene` |
| `MA\0\0` | 4 | `Material` |
| `LA\0\0` | 5 | `Lamp` (the SDNA type name of lights) |
| `CA\0\0` | 1 | `Camera` |
| `IM\0\0` | 12 | `Image` |
| `BR\0\0` | 74 | `Brush` |
| `WO`, `WM`, `WS`, `SN`, `PL`, `LS`, `TX` | — | World, WindowManager, WorkSpace, Screen, Palette, LineStyle, Text |

Other ID codes a reader may meet: `LI` (Library), `ID` (placeholder for a linked ID), `CU`
(legacy curve), `CV` (Curves), `PT` (PointCloud), `VO` (Volume), `GP` (Grease Pencil), `AC`
(Action), `KE` (shape Key). **[not in sample]** A reader interested only in Geometry Nodes may
skip unknown codes by their `len`.

### 4.2 `REND` **[sample]**

`nr = 1`, `sdna_index = 0`, `len = 264`. Payload: int32 start frame, int32 end frame, then the
active scene's name as a zero-terminated string in a 256-byte field (the scene ID name without
its two-letter prefix). Sample: 1, 250, `Scene`.

### 4.3 `GLOB` **[sample]**

A single `FileGlobal` struct (sdna_index points at `FileGlobal`, 1 216 bytes in the sample SDNA).
Useful members: `subversion` (file sub-version), `minversion` / `minsubversion` (oldest Blender that
may read the file), `curscene` (old address of the active Scene), `build_hash`, `filename`
(absolute path at save time; empty in the sample).

### 4.4 `TEST` (thumbnail) **[sample]**

Payload: int32 width, int32 height, then `width × height` RGBA pixels, 4 bytes each. Sample:
128 × 128, `len = 8 + 65 536`. Optional; absent in files saved without a thumbnail.

### 4.5 `ENDB` **[sample]**

A block header with code `ENDB` and all other fields zero (`len = 0`). Nothing follows it.

---

## 5. Old addresses and pointer resolution

A pointer member of a struct holds the **old address** (the `old` field of some block header),
not a file offset. Zero means null.

In 5.x files old addresses are opaque 64-bit identifiers (in the sample they look like hashed
values such as `0x4A32B9439E78E880`, not real memory addresses). Never interpret their numeric
value.

### 5.1 Block ownership

- An **ID block** is a block whose code is a two-letter ID code (`OB\0\0`, `ME\0\0`, ...).
- Every `DATA` block belongs to the nearest preceding ID block. `DATA` blocks before the first ID
  block (after `GLOB`) belong to no ID. **[sample]**

### 5.2 Resolution rule

Old addresses are **not unique across the file**. They are unique only within one ID and its
`DATA` blocks.

Evidence from the sample: 21 old addresses occur in more than one block; in every case the copies
belong to different IDs, and in 18 of the 21 cases the payloads differ (for example the
`AttributeArray` block at the same old address in `MECube.001` and `MECube.045` describes
different arrays). No ID contains two blocks with the same old address. **[sample]**

To resolve a pointer found in a block owned by ID `X`:

1. Look for a block with that old address among the blocks of `X` (the ID block itself and its
   `DATA` blocks). If found, that is the target.
2. Otherwise look among **ID blocks** of the whole file. A pointer to another data-block
   (`Object.data`, `CollectionObject.ob`, a socket's Object value, ...) resolves here.
3. Otherwise the pointer is dangling (see 5.3).

A global map of all blocks keyed by old address gives wrong answers on 5.x files.

Resolution statistics over every pointer member of every struct block in the sample: 50 898
resolved inside the owning ID, 202 573 resolved to an ID block, 164 579 were null, 15 961 did not
resolve. **[sample]**

### 5.3 Pointers that do not resolve

These are expected and must be ignored, not treated as corruption:

- **Runtime pointers.** Members that point to run-time-only types (types whose SDNA length is 0,
  e.g. `bNodeRuntimeHandle`, `bNodeSocketTypeHandle`, `ImplicitSharingInfoHandle`,
  `IDPropertyGroupChildrenSet`, `RuntimeNodeEnumItemsHandle`) are written with stale non-zero
  values. **[sample]**
- **Zero-length arrays.** A pointer to an array whose element count is 0 may be non-zero
  without any block behind it. In the sample every `NodesModifierData` has `bakes_num = 0` and
  `panels_num = 0` while `bakes` and `panels` are non-null and unresolvable. **[sample]** Read the
  count first; follow the pointer only when the count is positive.
- UI-only pointers (screen, space and window-manager data) that the writer does not save.

---

## 6. Compressed files

A `.blend` may be stored compressed. Detect by the first bytes:

| First bytes | Meaning |
|---|---|
| `BLENDER` | Uncompressed. |
| `28 B5 2F FD` (little-endian u32 `0xFD2FB528`) | Zstandard frame. |
| `5x 2A 4D 18` with x in 0..F (u32 `0x184D2A5x`) | Zstandard skippable frame; also treat as Zstandard. |
| `1F 8B 08` | gzip (files from before Zstandard became the default). |

After decompression the stream is an ordinary `.blend` starting with `BLENDER`.

### 6.1 Zstandard framing

Blender writes the file as a sequence of independent Zstandard frames followed by a **seek table**
in the Zstandard "seekable format", so a reader can decompress any part without decoding from the
start. A reader that simply decompresses the whole stream (all frames concatenated, skippable
frames ignored) gets the correct result; the seek table is an optimisation.

Seek table layout, at the very end of the file:

| Position | Size | Content |
|---|---:|---|
| frame start | 4 | u32 `0x184D2A5E` (skippable-frame magic) |
| +4 | 4 | u32 frame length `L` (bytes after this field) |
| +8 | `n × 8` or `n × 12` | One entry per data frame: u32 compressed size, u32 decompressed size, and, if checksums are flagged, a u32 checksum. |
| end − 9 | 4 | u32 number of frames `n` |
| end − 5 | 1 | Flags. Bit 7 = entries carry checksums. Bits 5 and 6 must be 0. |
| end − 4 | 4 | u32 `0x8F92EAB1` (seek-table footer magic) |

Consistency rules a reader should check: `L = n × (12 if checksums else 8) + 9`; the sum of all
compressed sizes equals the offset where the seek-table frame starts. If any check fails, fall
back to decompressing the stream sequentially.

The sample is not compressed, so this section is **[not in sample]**.

---

## 7. `DNA1` block: the structure description (SDNA)

The `DNA1` block (`sdna_index = 0`, `nr = 1`) holds a self-description of every struct the writer
knew. A reader decodes all other blocks with **this** description, never with a hard-coded layout.

### 7.1 Layout

All integers are little-endian. "Pad to 4" means: advance to the next offset that is a multiple of
4 **counted from the start of the DNA1 payload** (not from the file start — the payload itself is
unaligned in the file). **[sample]**

| Part | Content |
|---|---|
| `SDNA` | 4 ASCII bytes. |
| `NAME` | 4 ASCII bytes, then int32 `names_count`, then `names_count` zero-terminated strings. Pad to 4. |
| `TYPE` | 4 ASCII bytes, then int32 `types_count`, then `types_count` zero-terminated strings. Pad to 4. |
| `TLEN` | 4 ASCII bytes, then `types_count` int16 values: the byte size of each type. If `types_count` is odd, skip 2 bytes (this is the same as pad to 4). |
| `STRC` | 4 ASCII bytes, then int32 `structs_count`, then `structs_count` struct records. |

A struct record is a sequence of int16:

| Item | Meaning |
|---|---|
| `type_index` | Index into TYPE: the struct's own type name. |
| `members_count` | Number of members. |
| then `members_count` pairs | `(member_type_index, member_name_index)`: the member's type (index into TYPE) and its name string (index into NAME). |

Sample: 5 225 names, 1 109 types, 970 structs; the parse consumed exactly the 131 944 payload
bytes. **[sample]**

### 7.2 Types

- TYPE holds both basic types and struct types. A type is a struct type exactly when some STRC
  record has it as `type_index`.
- Struct index `0` is a pseudo-struct named `raw_data` with no members; blocks with
  `sdna_index = 0` hold raw bytes (strings, number arrays, pointer arrays). **[sample]**
- Basic types in the sample and their TLEN sizes **[sample]**:

| Type | Size | Notes |
|---|---:|---|
| `char` | 1 | Unsigned. Used for strings (`name[64]`) and small integers/enums. |
| `uchar` | 1 | |
| `short` | 2 | signed |
| `ushort` | 2 | |
| `int` | 4 | signed |
| `long` | 4 | Size 4 in the SDNA even on 64-bit writers. |
| `ulong` | 4 | |
| `float` | 4 | IEEE 754 binary32 |
| `double` | 8 | IEEE 754 binary64 |
| `int64_t` | 8 | |
| `uint64_t` | 8 | |
| `int8_t` | 1 | signed |
| `void` | 0 | Only meaningful behind a pointer. |
| `bool` | 0 | Present in TYPE but never used as a by-value member. |

- Many opaque run-time types have size 0 (e.g. `bNodeRuntimeHandle`, `MeshRuntimeHandle`,
  `GHash`). They only ever appear behind pointers.
- Type names in the file are the names used when the file was written. Some structs were renamed
  later in Blender's code but keep their old name in files (the sample has `Lamp`, `SpaceOops`,
  `SpaceButs`). Look types up by the file's names.

### 7.3 Member names encode pointer-ness and arrays

A NAME string is a C-style declarator:

| Name form | Meaning | Size in bytes |
|---|---|---|
| `value` | one element of the member type | size(type) |
| `name[64]` | array | size(type) × 64 |
| `parentinv[4][4]` | multi-dimensional array; element count is the product of all bracket numbers | size(type) × 16 |
| `*next` | pointer | pointer size |
| `**mat` | pointer to pointer (an old address of a pointer array) | pointer size |
| `*rect[2]` | array of pointers | pointer size × 2 |
| `(*func)()` | function pointer, or a pointer to an array declared `T (*name)[N]`; treated as a plain pointer | pointer size |

The identifier is the run of letters, digits and `_` after any leading `*` and `(`.

Pointer size is 8 in 5.x files. It can also be derived from the SDNA: `ListBase` is exactly two
pointers, so pointer size = size(`ListBase`) / 2.

### 7.4 Member offsets and alignment

- A struct has **no implicit padding**. Member `k` starts at the sum of the sizes of members
  `0..k-1`; padding exists only as explicit members named `_pad`, `_pad0[4]`, and so on.
- The struct size (TLEN of its type) equals the sum of its members' sizes. This held for all
  970 structs of the sample. **[sample]**
- Because of how the writer lays out its structs, every member is naturally aligned relative to
  the struct start (2-byte types on 2, 4-byte types on 4, 8-byte basic types, pointers and nested
  structs on 8). All 9 694 members of the sample satisfy this. **[sample]** A reader does not need
  this rule to compute offsets — the running sum is authoritative — but may use it as a sanity
  check.
- Struct sizes are not always multiples of 8 (133 structs in the sample are not, e.g.
  `CollectionLightLinking` is 4 bytes). In a block with `nr > 1`, instance `i` starts at
  `i × size`.
