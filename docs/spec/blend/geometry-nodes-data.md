# Geometry Nodes data in a .blend (Blender 5.x)

Where everything a Geometry Nodes evaluator needs lives in a `.blend`, and what each stored value
means. Byte-level decoding rules are in [file-format.md](./file-format.md) and
[reading-structs.md](./reading-structs.md); in particular, pointers resolve per ID
(file-format.md §5.2) and members are found by their file names (reading-structs.md §6).

Offsets given below are those of the 5.0 sample's SDNA and are for orientation only; always
compute offsets from the file's SDNA.

**[sample]** = checked on `reference/cache/hong-kong-building.blend` (Blender 5.0).
**[5.2 source]** = read from Blender 5.2.2 definitions, not present in the sample.
**[unverified]** = expected behaviour that neither the sample nor the consulted sources pin; needs
a reference case.

---

## 1. Map

```
Scene (SC)
 └─ master_collection ─► Collection (embedded, DATA)
       ├─ gobject:  ListBase<CollectionObject> ─► Object (OB)
       └─ children: ListBase<CollectionChild>  ─► Collection (GR) ─► ... (recursive)

Object (OB)
 ├─ loc / rot / quat / size / d* / rotmode / parent / parentinv   (transform, §6)
 ├─ data ─► Mesh (ME)                                               (geometry, §7)
 └─ modifiers: ListBase<ModifierData>
       └─ NodesModifierData (type 57)
             ├─ node_group ─► bNodeTree (NT)                        (§3)
             └─ settings.properties ─► IDProperty group             (input values, §4)

bNodeTree (NT)
 ├─ nodes: ListBase<bNode> ─► inputs/outputs: ListBase<bNodeSocket> ─► default_value
 │                          └─ storage ─► per-type struct (§5)
 ├─ links: ListBase<bNodeLink>
 └─ tree_interface.root_panel.items_array ─► panels / interface sockets (§3.4)
```

---

## 2. Object → Nodes modifier

### 2.1 Finding objects

Either iterate all `OB\0\0` blocks, or walk the scene: `Scene.master_collection` (an embedded
`Collection` DATA block inside the Scene's group, flag bit 5 set) and recursively its children
(§8). **[sample]**

`Object.type` (short) selects what `Object.data` points to **[sample]** for 1 and 10/11:

| `type` | Kind | `data` points to |
|---:|---|---|
| 0 | Empty | null |
| 1 | Mesh | `Mesh` |
| 2 | Legacy curve | `Curve` |
| 10 | Light | `Lamp` |
| 11 | Camera | `Camera` |
| 27 | Curves | `Curves` |
| 28 | Point cloud | `PointCloud` |
| 29 | Volume | `Volume` |
| 30 | Grease Pencil | `GreasePencil` |

The sample has 1 211 mesh objects, 5 lights, 1 camera. **[sample]**

### 2.2 Modifier list

`Object.modifiers` is a ListBase of modifier structs, evaluated in list order. Each begins with
`ModifierData` (120 bytes in the sample) **[sample]**:

| Member | Meaning |
|---|---|
| `type` (int) | Modifier kind. **57 = Geometry Nodes.** |
| `mode` (int) | Bits: 1 = enabled in viewport, 2 = enabled in render, 4 = in edit mode. Sample: 7. |
| `flag` (short) | Bit 2 = active modifier (UI). |
| `name[64]` | Modifier name, unique on the object. |
| `persistent_uid` (int) | Stable identifier within the object. |
| `system_properties` | **[5.2 source]** only; see §4.2. |

The struct stored in the block is chosen by `type`; for type 57 it is `NodesModifierData`.
All 666 modifiers in the sample are Geometry Nodes modifiers. **[sample]**

### 2.3 `NodesModifierData`

184 bytes in the sample **[sample]**:

| Member | Meaning |
|---|---|
| `modifier` | the `ModifierData` above (inline) |
| `node_group` | the node tree (an `NT` ID block); null = modifier without a tree (passes geometry through) |
| `settings` (`NodesModifierSettings`, inline) | one member `properties`: the input-value IDProperty group (§4.1) |
| `bakes_num`, `bakes` | simulation/bake records; ignore (count 0 in the sample, pointer dangling) |
| `panels_num`, `panels` | UI panel open states; ignore |
| `flag`, `bake_target`, `simulation_bake_directory` | bake settings; ignore |

The modifier receives the object's geometry (after the preceding modifiers) on the tree's first
Geometry input and replaces it with the tree's first Geometry output. **[unverified]** — this is
Blender's documented modifier behaviour; which inputs count as "first" follows the interface order
of §3.4.

---

## 3. Node tree (`bNodeTree`)

Node groups are `NT\0\0` ID blocks. Node trees embedded in materials and worlds are `bNodeTree`
DATA blocks owned by that material/world (their `idname` is `ShaderNodeTree`); Geometry Nodes
never uses those. **[sample]**

| Member | Meaning |
|---|---|
| `id.name` | `NT` + group name, e.g. `NTbuild system` |
| `idname[64]` | `GeometryNodeTree` for Geometry Nodes |
| `type` (int) | 3 for Geometry Nodes (legacy code; prefer `idname`) |
| `nodes` | ListBase of `bNode` |
| `links` | ListBase of `bNodeLink` |
| `tree_interface` (inline `bNodeTreeInterface`) | the group's inputs, outputs and panels (§3.4) |
| `inputs`, `outputs` | legacy interface lists from before 4.0; empty in 5.x files **[sample]** |
| `geometry_node_asset_traits` | asset flags (tool / modifier usage); not needed for evaluation |

Sample: `NTbuild system` has 592 nodes and 763 links; `NTAuto Smooth` has 10 nodes and 9 links.
**[sample]**

### 3.1 Nodes (`bNode`, 384 bytes in the sample)

| Member | Meaning |
|---|---|
| `name[64]` | unique name within the tree (e.g. `Math.070`) |
| `identifier` (int) | unique, stable integer id within the tree |
| `idname[64]` | the node type, e.g. `GeometryNodeMeshGrid`, `ShaderNodeMath`. **Use this to identify the type.** |
| `type` (short) | legacy numeric type code (e.g. 1039 for Grid); still written, but deprecated |
| `flag` (int) | bit 9 (512) = muted; bit 6 (64) = active output among several Group Output nodes |
| `custom1`, `custom2` (short), `custom3`, `custom4` (float) | small per-type settings for types without a storage struct (§5) |
| `storage` | per-type settings struct (§5), or null |
| `id` | an ID used by the node: the node tree for a group node (`GeometryNodeGroup`), an image for image nodes |
| `prop`, `system_properties` | IDProperty groups; not needed |
| `inputs`, `outputs` | ListBases of `bNodeSocket`, in the node's declaration order |
| `parent` | the frame node containing this node (layout only) |
| `location[2]`, `width`, `height`, `label[64]`, `color[3]` | UI only |
| `num_panel_states`, `panel_states_array` | UI only |

Layout-only node types: `NodeFrame` (storage `NodeFrame`: flag, label size) and `NodeReroute`
(storage `NodeReroute`: `type_idname[64]`, a pass-through of one value). **[sample]**

`NodeGroupInput` nodes expose the tree's interface inputs as **outputs**, in interface order,
followed by a virtual socket with identifier `__extend__` and idname `NodeSocketVirtual`.
`NodeGroupOutput` nodes expose the interface outputs as **inputs**, again followed by
`__extend__`. Ignore `__extend__`. A tree may contain several Group Input nodes (the sample has
48). **[sample]**

### 3.2 Sockets (`bNodeSocket`, 528 bytes in the sample)

| Member | Meaning |
|---|---|
| `identifier[64]` | unique among the node's inputs (or among its outputs); **match sockets by this**. For group nodes and group input/output nodes it equals the interface socket identifier (e.g. `Input_2`, `Socket_1`). |
| `name[64]` | display name; not unique (Math has three inputs named `Value` with identifiers `Value`, `Value_001`, `Value_002`) |
| `idname[64]` | socket type with subtype, e.g. `NodeSocketFloat`, `NodeSocketFloatDistance`, `NodeSocketFloatFactor`, `NodeSocketFloatAngle`, `NodeSocketVectorTranslation`, `NodeSocketVectorXYZ`, `NodeSocketIntFactor` |
| `type` (short) | base data type (table below) |
| `flag` (short) | bits below |
| `in_out` (short) | 1 = input, 2 = output |
| `limit` (short) | maximum link count (1 for ordinary inputs, 4095 for outputs and multi-inputs) |
| `default_value` | the socket's own value when unlinked (struct by type, below); null for geometry, matrix and similar |
| `attribute_domain`, `default_attribute_name` | only meaningful on group output sockets used for attribute outputs |
| `link`, `ns`, `stack_index`, `own_index`, `to_index` | legacy/run-time; ignore |

`type` codes (`eNodeSocketDatatype`) **[5.2 source]**, codes marked * seen in the sample:

| Code | Type | `default_value` struct |
|---:|---|---|
| 0* | Float | `bNodeSocketValueFloat`: `subtype` int, `value` float, `min`, `max` |
| 1* | Vector | `bNodeSocketValueVector`: `subtype` int, `value[4]` float, `min`, `max`, `dimensions` int (3 for ordinary vectors; only the first `dimensions` components are meaningful) |
| 2* | Color | `bNodeSocketValueRGBA`: `value[4]` float, linear RGBA |
| 3 | Shader | — |
| 4* | Boolean | `bNodeSocketValueBoolean`: `value` char (0/1) |
| 6* | Integer | `bNodeSocketValueInt`: `subtype`, `value` int, `min`, `max` |
| 7* | String | `bNodeSocketValueString`: `subtype`, `value[1024]` |
| 8* | Object | `bNodeSocketValueObject`: `value` → Object ID |
| 9 | Image | `bNodeSocketValueImage` |
| 10* | Geometry | none |
| 11* | Collection | `bNodeSocketValueCollection`: `value` → Collection ID |
| 12 | Texture | `bNodeSocketValueTexture` |
| 13 | Material | `bNodeSocketValueMaterial`: `value` → Material ID |
| 14* | Rotation | `bNodeSocketValueRotation`: `value_euler[3]` float, XYZ Euler angles in radians |
| 15* | Menu | `bNodeSocketValueMenu`: `value` int (the chosen item's identifier value), `runtime_flag`, `enum_items` (run-time, stale) |
| 16* | Matrix | none (unlinked matrix inputs are identity) **[unverified]** |
| 17, 18 | Bundle, Closure | none |
| 19–23 | Font, Scene, Text, Mask, Sound | `bNodeSocketValueFont` / `Scene` / `Text` / `Mask` / `Sound`, each a single ID pointer **[5.2 source]** |
| 24 | Integer vector | `bNodeSocketValueIntVector`: `subtype`, `value[3]` int, `min`, `max`, `dimensions` **[5.2 source]** |

The `subtype` members mix a property subtype with unit bits (sample: `65557` on a Translation
vector, `327696` on an angle); they affect display only. **[sample]**

Socket `flag` bits:

| Bit | Value | Name | Meaning for a reader |
|---:|---:|---|---|
| 1 | 2 | hidden | UI only |
| 2 | 4 | is linked | cached; recompute from links |
| 3 | 8 | **unavailable** | the socket is not part of the node in its current mode (e.g. Compare's `A_INT` while `data_type` is Float). Links to/from unavailable sockets do not take part in evaluation. |
| 6 | 64 | collapsed | UI only |
| 7 | 128 | hide value | the input has no editable value; often an implicit-field input such as `Position`, `ID`, `Selection` of some nodes. The node's specification defines what an unlinked implicit input means — do **not** substitute `default_value`. |
| 11 | 2048 | **multi-input** | the input accepts several links (Join Geometry's `Geometry`) |
| 12 | 4096 | hide label (legacy) | UI only |

All of these flag values were observed in the sample (e.g. 68 = linked + collapsed, 72 =
unavailable + collapsed, 192 = collapsed + hide value, 2116 = multi-input + collapsed + linked).
**[sample]**

Nodes whose socket set depends on a mode store **all** variants and mark the inactive ones
unavailable: the sample's `FunctionNodeCompare` nodes carry `A`/`B` (float), `A_INT`/`B_INT`,
`A_VEC3`/`B_VEC3`, `A_COL`/`B_COL`, `A_STR`/`B_STR`, `C`, `Angle`, `Epsilon`; `FunctionNodeRandomValue`
carries `Min`/`Max` (vector), `Min_001`/`Max_001` (float), `Min_002`/`Max_002` (int), `Probability`,
`ID`, `Seed` and outputs `Value`, `Value_001`, `Value_002`, `Value_003`. **[sample]**

### 3.3 Links (`bNodeLink`, 56 bytes in the sample)

| Member | Meaning |
|---|---|
| `fromnode`, `fromsock` | source node and one of its **output** sockets |
| `tonode`, `tosock` | target node and one of its **input** sockets |
| `flag` (int) | bit 1 (2) = valid, bit 4 (16) = muted |
| `multi_input_socket_index` (int) | order key for links into a multi-input socket |

All four pointers resolve inside the tree's own block group, and in all 763 links of the sample
`fromsock` is in `fromnode`'s outputs and `tosock` in `tonode`'s inputs. **[sample]**

Ordering into a multi-input socket: the links are taken in **descending** order of
`multi_input_socket_index` (the link with the highest index is first). **[5.2 source]** The
sample has 91 links with a non-zero index. **[sample]** Pin the resulting order of Join Geometry
with a reference case.

A muted link, and a link with an unavailable end, does not carry a value. What the target input
receives instead is node behaviour. **[unverified]**

### 3.4 Group interface (`bNodeTreeInterface`)

`bNodeTree.tree_interface` (64 bytes, inline) holds `root_panel` (an inline
`bNodeTreeInterfacePanel`), `active_index` and `next_uid`. **[sample]**

`bNodeTreeInterfacePanel` (48 bytes) **[sample]**:

| Member | Meaning |
|---|---|
| `item` | `bNodeTreeInterfaceItem`: `item_type` char — **0 = panel, 1 = socket** — and 7 pad bytes |
| `name`, `description` | strings (raw blocks) |
| `flag` | bit 0 = default closed (UI) |
| `items_array` | pointer to a **pointer array** (`raw_data` block of `items_num × 8` bytes); each pointer resolves to a panel or socket item block **[sample]** |
| `items_num` | number of child items |
| `identifier` | panel id |

Read each child's first byte (`item_type`) to know whether the block is a
`bNodeTreeInterfacePanel` or a `bNodeTreeInterfaceSocket`; the block's `sdna_index` says the same.
Panels nest; walk them depth-first.

`bNodeTreeInterfaceSocket` (80 bytes in the sample) **[sample]**:

| Member | Meaning |
|---|---|
| `name` | display name string |
| `description` | string |
| `socket_type` | socket idname string, e.g. `NodeSocketFloat` (without subtype suffix; the subtype is in `socket_data.subtype`) |
| `flag` (int) | bit 0 = input, bit 1 = output; bit 2 = hide value; bit 3 = hide in modifier; bit 6 = layer selection; bit 8 = panel toggle; bit 9 = menu expanded |
| `attribute_domain` (short) | domain for attribute outputs |
| `default_input` (short) | implicit default for unlinked inputs: 0 = the value, 1 = index, 2 = ID-or-index, 3 = normal, 4 = position, 5 = instance transform, 6/7 = left/right handle, 8 = scene frame, 9 = image coordinates, 10 = the modifier's own object |
| `default_attribute_name` | string |
| `identifier` | string; the key used by group nodes, group input/output nodes and the modifier's properties (`Input_2`, `Socket_1`, `Output_1`, ...) |
| `socket_data` | the default value, same structs as §3.2 (min/max are the UI limits) |
| `properties` | IDProperty group; not needed |
| `structure_type` (int8) | 0 auto, 1 single value, 2 dynamic, 3 field, 4 grid, 5 list |

Order: the interface **inputs** are the socket items with the input flag, in depth-first order
of the item tree; the **outputs** likewise with the output flag. Outputs and inputs may be
interleaved in the item array (the sample's `build system` lists `Output_1` first, then
`Input_0`, `Input_2`, ...). The Group Input node's outputs follow the input order exactly.
**[sample]**

The two sample trees' interfaces **[sample]**:

- `Auto Smooth`: outputs `Socket_0` Geometry; inputs `Socket_1` Geometry, `Socket_2` Float
  (angle subtype, default 0, range 0..π).
- `build system`: output `Output_1` Geometry; inputs `Input_0` Geometry, `Input_2`/`Input_3`/
  `Input_4` Int, `Input_6`…`Input_17` and `Input_19` Float (factor subtype), `Input_18`,
  `Input_20`, `Input_21` Int.

---

## 4. Modifier input values

The modifier overrides the group's interface defaults with per-modifier values stored as
IDProperties keyed by interface socket **identifier**.

### 4.1 Flat group (`NodesModifierData.settings.properties`) — the 5.0 format **[sample]**

`settings.properties` is an IDProperty GROUP named `Nodes Modifier Settings`. For each interface
input that has a value, it contains:

| Key | Type | Meaning |
|---|---|---|
| `<identifier>` | depends on the socket type (table below) | the value |
| `<identifier>_use_attribute` | INT (0/1) | 1 = the input is driven by a named attribute instead of the value |
| `<identifier>_attribute_name` | STRING | the attribute name used when `_use_attribute` is 1 |

For each interface output that can write an attribute:

| Key | Type | Meaning |
|---|---|---|
| `<identifier>_attribute_name` | STRING | name of the attribute to store the output field in; empty = do not store |

Sample (`OBCube.001`, modifier `GeometryNodes`, tree `build system`): `Input_2` = INT 6,
`Input_3` = INT 7, `Input_4` = INT 3, `Input_6` = FLOAT 0.72440946, …, `Input_21` = INT 0, each
followed by `_use_attribute` = INT 0 and `_attribute_name` = `""`. Geometry inputs have no entry.
The Auto Smooth modifiers store only `Socket_2` = FLOAT 0.5235988 (30°) plus its two companions.
**[sample]**

Value property type by socket type:

| Socket type | IDProperty type | Status |
|---|---|---|
| Integer, Menu | INT | Integer **[sample]**; Menu **[unverified]** |
| Float | FLOAT | **[sample]**; also accept DOUBLE **[unverified]** |
| Boolean | BOOLEAN (older files: INT) | **[unverified]** |
| Vector, Color, Rotation | ARRAY of FLOAT (3, 4, 3 elements; rotation as XYZ Euler radians) | **[unverified]** |
| String | STRING | **[unverified]** |
| Object, Collection, Material, Image, Texture | ID | **[unverified]** |

Rules:

- A missing key means the interface default (`socket_data`) applies. **[unverified]**
- Accept INT/BOOLEAN interchangeably and FLOAT/DOUBLE interchangeably.
- Geometry inputs never have a value; the first one receives the object's geometry.

### 4.2 Structured group (`ModifierData.system_properties`) — Blender 5.2 **[5.2 source]**

Files saved by 5.2 carry a new member `ModifierData.system_properties` (an IDProperty GROUP) whose
children are:

| Path | Type | Meaning |
|---|---|---|
| `inputs/<identifier>/value` | as in §4.1 | the input value |
| `inputs/<identifier>/type` | INT | 0 = fallback, 1 = value, 2 = attribute, 3 = layer selection |
| `inputs/<identifier>/attribute_name` | STRING | attribute name when `type` is 2 |
| `inputs/<identifier>/layer_name` | STRING | layer name when `type` is 3 |
| `outputs/<identifier>/attribute_name` | STRING | output attribute name |
| `panels/open_<panel id>` | BOOLEAN | UI only |

When saving (not for undo), 5.2 **also** writes the flat group of §4.1 into
`NodesModifierData.settings.properties`, derived from the structured one: `value` becomes
`<identifier>`, `type == 2` becomes `<identifier>_use_attribute = 1` (INT), `attribute_name`
becomes `<identifier>_attribute_name`, and for `type == 3` the `layer_name` string is stored under
`<identifier>` itself. Reader rule: prefer `system_properties` when present; otherwise use the
flat group.

---

## 5. Per-node settings for the kit's node types

Every node type below occurs in the sample with the listed socket identifiers (inputs → outputs,
in list order). The node spec for each type defines what the settings do; this table only says
where they are stored and what the stored numbers mean. **[sample]** for identifiers, storage
struct names and observed values; enum meanings **[5.2 source]**.

| idname | Settings stored in | Inputs → outputs (identifiers) |
|---|---|---|
| `GeometryNodeMeshGrid` | none | `Size X`, `Size Y`, `Vertices X`, `Vertices Y` → `Mesh`, `UV Map` |
| `GeometryNodeExtrudeMesh` | `NodeGeometryExtrudeMesh.mode` | `Mesh`, `Selection`, `Offset`, `Offset Scale`, `Individual` → `Mesh`, `Top`, `Side` |
| `GeometryNodeMeshToPoints` | `NodeGeometryMeshToPoints.mode` | `Mesh`, `Selection`, `Position`, `Radius` → `Points` |
| `GeometryNodeSeparateGeometry` | `NodeGeometrySeparateGeometry.domain` | `Geometry`, `Selection` → `Selection`, `Inverted` |
| `GeometryNodeSetShadeSmooth` | `custom1` = domain | `Geometry` (named "Mesh"), `Selection`, `Shade Smooth` → `Geometry` (named "Mesh") |
| `GeometryNodeSwitch` | `NodeSwitch.input_type` | `Switch`, `False`, `True` → `Output` |
| `ShaderNodeMath` | `custom1` = operation, `custom2` bit 0 = clamp | `Value`, `Value_001`, `Value_002` → `Value` |
| `FunctionNodeCompare` | `NodeFunctionCompare` (`operation`, `data_type`, `mode`) | `A`, `B`, `A_INT`, `B_INT`, `A_VEC3`, `B_VEC3`, `A_COL`, `B_COL`, `A_STR`, `B_STR`, `C`, `Angle`, `Epsilon` → `Result` |
| `FunctionNodeBooleanMath` | `custom1` = operation | `Boolean`, `Boolean_001` → `Boolean` |
| `FunctionNodeRandomValue` | `NodeRandomValue.data_type` | `Min`, `Max`, `Min_001`, `Max_001`, `Min_002`, `Max_002`, `Probability`, `ID`, `Seed` → `Value`, `Value_001`, `Value_002`, `Value_003` |
| `GeometryNodeCollectionInfo` | `NodeGeometryCollectionInfo.transform_space` | `Collection`, `Separate Children`, `Reset Children` → `Instances` |
| `GeometryNodeObjectInfo` | `NodeGeometryObjectInfo.transform_space` | `Object`, `As Instance` → `Transform`, `Location`, `Rotation`, `Scale`, `Geometry` |
| `GeometryNodeTransform` | none (mode is the `Mode` menu input) | `Geometry`, `Mode`, `Translation`, `Rotation`, `Scale`, `Transform` → `Geometry` |
| `GeometryNodeTranslateInstances` | none | `Instances`, `Selection`, `Translation`, `Local Space` → `Instances` |
| `GeometryNodeRealizeInstances` | `custom1` bit 0 = realize to point domain | `Geometry`, `Selection`, `Realize All`, `Depth` → `Geometry` |
| `GeometryNodeInstanceOnPoints` | none | `Points`, `Selection`, `Instance`, `Pick Instance`, `Instance Index`, `Rotation`, `Scale` → `Instances` |

Storage struct layouts:

| Struct | 5.0 sample layout **[sample]** | 5.2 layout **[5.2 source]** |
|---|---|---|
| `NodeGeometryExtrudeMesh` | `mode` uchar | same |
| `NodeGeometryMeshToPoints` | `mode` uchar | same |
| `NodeGeometrySeparateGeometry` | `domain` int8 | same |
| `NodeSwitch` | `input_type` uchar (1 byte) | `input_type` short (2 bytes) |
| `NodeFunctionCompare` | `operation` int8, `data_type` int8, `mode` int8, 1 pad | `operation` int8, `mode` int8, `data_type` short |
| `NodeRandomValue` | `data_type` uchar | same |
| `NodeGeometryCollectionInfo` | `transform_space` uchar | same |
| `NodeGeometryObjectInfo` | `transform_space` uchar | same |

`NodeSwitch` and `NodeFunctionCompare` change layout between 5.0 and 5.2: read them by member name
through the file's SDNA.

Enum values:

| Setting | Values |
|---|---|
| Extrude `mode` | 0 vertices, 1 edges, 2 faces (sample: 2) |
| Mesh to Points `mode` | 0 vertices, 1 edges, 2 faces, 3 corners (sample: 0, 2) |
| Separate `domain`; Set Shade Smooth `custom1` | 0 point, 1 edge, 2 face, 3 corner, 4 curve, 5 instance, 6 layer (sample Separate: 0, 5; Set Shade Smooth: 1, 2) |
| Switch `input_type`; Compare `data_type` | socket type codes of §3.2 (sample Switch: 10 geometry; Compare: 0 float) |
| Compare `operation` | 0 less than, 1 less or equal, 2 greater than, 3 greater or equal, 4 equal, 5 not equal, 6 brighter, 7 darker (sample: 0, 1, 2) |
| Compare `mode` (vectors) | 0 element-wise, 1 length, 2 average, 3 dot product, 4 direction |
| Math `custom1` | 0 add, 1 subtract, 2 multiply, 3 divide, 4 sine, 5 cosine, 6 tangent, 7 arcsine, 8 arccosine, 9 arctangent, 10 power, 11 logarithm, 12 minimum, 13 maximum, 14 round, 15 less than, 16 greater than, 17 modulo (truncated), 18 absolute, 19 arctan2, 20 floor, 21 ceil, 22 fraction, 23 square root, 24 inverse square root, 25 sign, 26 exponent, 27 radians, 28 degrees, 29 sinh, 30 cosh, 31 tanh, 32 truncate, 33 snap, 34 wrap, 35 compare, 36 multiply-add, 37 ping-pong, 38 smooth minimum, 39 smooth maximum, 40 floored modulo (sample: 0, 1, 2, 3, 15, 16) |
| Boolean Math `custom1` | 0 and, 1 or, 2 not, 3 nand, 4 nor, 5 xnor, 6 xor, 7 imply, 8 nimply (sample: 0) |
| Random Value `data_type` | 10 float, 11 integer, 48 vector, 50 boolean (sample: 11, 48, 50) |
| Collection/Object Info `transform_space` | 0 original, 1 relative (sample: 0) |
| Transform `Mode` menu input value | 0 components (translation/rotation/scale), 1 matrix (sample: 0) |

---

## 6. Object transforms

The object's world matrix is **not stored**; it must be computed. Members (all float unless noted)
**[sample]** for presence and layout:

| Member | Meaning |
|---|---|
| `loc[3]`, `dloc[3]` | location and delta location |
| `rot[3]`, `drot[3]` | Euler angles (radians) and delta, used when `rotmode` ≥ 1 |
| `quat[4]`, `dquat[4]` | quaternion (w, x, y, z) and delta, used when `rotmode` = 0 |
| `rotAxis[3]`, `rotAngle`, `drotAxis[3]`, `drotAngle` | axis-angle and delta, used when `rotmode` = −1 |
| `rotmode` (short) | 0 quaternion; 1 XYZ, 2 XZY, 3 YXZ, 4 YZX, 5 ZXY, 6 ZYX Euler; −1 axis-angle |
| `size[3]`, `dscale[3]` | scale and delta scale (`size` is the file name of "scale") |
| `parent` | parent object or null |
| `partype` (short) | low 4 bits: 0 object, 4 armature, 5 one vertex, 6 three vertices, 7 bone |
| `parentinv[4][4]` | parent-inverse matrix captured when parenting, column-major |
| `constraints` | ListBase; constraints also move objects (not covered here) |

Local matrix:

- Scale `S = diag(size ∘ dscale)` (component-wise product).
- Rotation `R = R_delta · R_main`, where both come from the same representation selected by
  `rotmode`: for Euler, `drot` and `rot` each converted with the object's order; for quaternion,
  `dquat` and `quat` each normalised first; for axis-angle, `(drotAxis, drotAngle)` and
  `(rotAxis, rotAngle)`.
- Euler order "ABC" means: rotate about A first, then B, then C, so the matrix is `R_C · R_B · R_A`
  (column vectors). XYZ gives `Rz · Ry · Rx`.
- `Local = T(loc + dloc) · R · S`.

World matrix:

- No parent: `World = Local`.
- Parent type 0 (object): `World = ParentWorld · parentinv · Local`.
- Other parent types add a parent-space offset (vertex, bone) before `parentinv`; they are
  outside the kit's scope.

Sample facts **[sample]**: all 1 217 objects use `rotmode` 1 (XYZ Euler); 320 have a parent, all
with `partype` 0; `OBCube.001` has `loc = (−9, 0, 0)`, `rot = (0, 0, π)`, `size = (1, 1, 1)`.
The formula is from Blender's object code **[5.2 source]**; confirm it with a reference case that
exports world matrices.

---

## 7. Mesh data (`Mesh`, 5.x attribute storage)

### 7.1 Counts and face offsets

| Member (file name) | Meaning |
|---|---|
| `totvert` | number of vertices (point domain) |
| `totedge` | number of edges |
| `totpoly` | number of faces |
| `totloop` | number of face corners |
| `poly_offset_indices` | `raw_data` block of `totpoly + 1` int32. Face `f` owns corners `offsets[f]` … `offsets[f+1] − 1`; `offsets[0] = 0`, `offsets[totpoly] = totloop`. |
| `attribute_storage` (inline `AttributeStorage`) | all generic attributes (§7.2) |
| `vdata`, `edata`, `pdata`, `ldata` (`CustomData`) | only non-generic layers remain here (§7.4) |
| `mat` / `totcol` | pointer array of `totcol` Material IDs (slot list) |
| `vertex_group_names` | ListBase of vertex-group names |
| `active_uv_map_attribute`, `default_uv_map_attribute`, `active_color_attribute`, `default_color_attribute` | strings naming attributes |
| `mvert`, `medge`, `mpoly`, `mloop`, `mface`, `fdata`, `totface` | pre-3.x legacy arrays; null/0 in 5.x files |

The offset rule held for all 147 meshes of the sample. **[sample]**

### 7.2 `AttributeStorage` and `Attribute`

`AttributeStorage` (24 bytes): `dna_attributes` → a struct block of `Attribute` with
`nr = dna_attributes_num`; `runtime` is stale. **[sample]**

`Attribute` (24 bytes) **[sample]**:

| Member | Meaning |
|---|---|
| `name` | string block (attribute name) |
| `data_type` (short) | element type (table below) |
| `domain` (int8) | 0 point, 1 edge, 2 face, 3 corner, 4 curve, 5 instance, 6 layer |
| `storage_type` (int8) | 0 = array (`data` → `AttributeArray`), 1 = single value (`data` → `AttributeSingle`) |
| `data` | the storage struct block |

`AttributeArray` (24 bytes in 5.0; 32 in 5.2): `data` → `raw_data` block of values, `sharing_info`
(stale), `size` (int64, element count). In 5.2 also `is_single` (int8): 1 means the array holds one
repeated value. **[sample]** for 5.0; **[5.2 source]** for `is_single`.

`AttributeSingle` (16 bytes): `data` → `raw_data` block holding exactly one element; the value
applies to every element of the domain. **[5.2 source]** 5.2 writes meshes with this storage when
an attribute holds a single value; the sample has only array storage.

Element types (`data_type`) and element sizes:

| Code | Type | Bytes per element | Layout |
|---:|---|---:|---|
| 0 | Bool | 1 | 0 / 1 **[sample]** |
| 1 | Int8 | 1 | signed |
| 2 | Int16_2D | 4 | 2 × int16 |
| 3 | Int32 | 4 | **[sample]** |
| 4 | Int32_2D | 8 | 2 × int32 **[sample]** |
| 5 | Float | 4 | **[sample]** |
| 6 | Float2 | 8 | **[sample]** |
| 7 | Float3 | 12 | **[sample]** |
| 8 | Float4x4 | 64 | 16 floats, column-major |
| 9 | ColorByte | 4 | RGBA bytes (sRGB) |
| 10 | ColorFloat | 16 | RGBA floats (linear) |
| 11 | Quaternion | 16 | 4 floats, w first |
| 12 | String | 256 | 255-byte buffer + 1 length byte |
| 13 | Float4 | 16 | 4 floats |

For every one of the 1 132 attribute arrays in the sample, `size` equals the size of the
attribute's domain and the raw block's `len` equals `size × bytes per element`. **[sample]**

### 7.3 Attribute names

Required topology and position (present in all 147 sample meshes) **[sample]**:

| Name | Type | Domain | Meaning |
|---|---|---|---|
| `position` | Float3 | point | vertex coordinates in object space |
| `.edge_verts` | Int32_2D | edge | the two vertex indices of each edge |
| `.corner_vert` | Int32 | corner | the vertex of each face corner |
| `.corner_edge` | Int32 | corner | the edge from this corner's vertex to the next corner's vertex in the same face (cyclic) |

The `.corner_edge` rule — the edge of corner `c` joins `corner_vert[c]` and `corner_vert` of the
next corner of the same face, wrapping to the face's first corner — held for every corner of every
sample mesh, and all indices were in range. **[sample]**

Other names in the sample **[sample]**:

| Name | Type | Domain | Meaning |
|---|---|---|---|
| `UVMap` | Float2 | corner | a UV map (UV maps are any Float2 corner attributes; this is the default name) |
| `sharp_face` | Bool | face | true = face shaded flat; absent = all smooth |
| `sharp_edge` | Bool | edge | true = edge marked sharp |
| `material_index` | Int32 | face | index into the material slots; absent = 0 |
| `crease_edge` | Float | edge | subdivision crease |
| `uv_seam` | Bool | edge | UV seam marks |
| `.select_vert`, `.select_edge`, `.select_poly` | Bool | point / edge / face | edit-mode selection |
| `.uv_select_vert`, `.uv_select_edge`, `.uv_select_face` | Bool | corner / corner / face | UV selection |

Names starting with `.` are internal. The meaning of `sharp_face`, `sharp_edge` and
`material_index` above is Blender's documented convention **[unverified]** against a render.

### 7.4 CustomData layers still present

Layers that are not generic attributes (e.g. vertex-group weights, type 2 on the point domain)
stay in `vdata`/`edata`/`pdata`/`ldata` as `CustomData` → `layers` → array of `CustomDataLayer`
(`type`, `name[68]`, `data` → array of the layer's element struct, one per domain element). In
5.x files `typemap` is written as zeros and `totlayer` counts the written layers. **[sample]**
(`totlayer = 0` and zero `typemap` in all sample meshes). Geometry Nodes evaluation of the kit's
node set does not need these layers.

---

## 8. Collections

`Collection` (`GR\0\0` blocks; 520 bytes in the sample) **[sample]**:

| Member | Meaning |
|---|---|
| `id.name` | `GR` + name |
| `gobject` | ListBase of `CollectionObject` (32 bytes): `ob` → Object; order is the collection's object order |
| `children` | ListBase of `CollectionChild` (32 bytes): `collection` → child Collection; order is the child order |
| `dupli_ofs[3]` | instance offset ("instance_offset" in Blender's code): the point of the collection placed at the origin when it is instanced |
| `flag` (uchar) | bit 0 hidden in viewport, bit 1 not selectable, bit 3 hidden in render, bit 5 scene master collection |

Sample: 169 collections; e.g. `GRac 1 1.001` holds `OBACOUT1.004`, `OBstand1.003`,
`OBPlane.061`; the scene's master collection (`GRScene Collection`, embedded in the Scene, flag
32) has children `GRCollection`, `GRgroud_roof_preset`, `GRfloor_preset`; all instance offsets
are zero. **[sample]**

An object instances a collection when `Object.dup_group` is set and `Object.transflag` has bit 8.
No object in the sample does this. **[5.2 source]**

---

## 9. Reference cases to capture

These pin the **[unverified]** items above:

1. A tree whose modifier sets every interface input type (bool, vector, color, rotation, string,
   menu, object, collection) — dump the modifier's IDProperties as saved by 5.2.2 (both the
   structured and the flat group).
2. An object parented to another with non-identity `parentinv`, delta transforms and each
   `rotmode` — export world matrices.
3. Join Geometry with three inputs linked in a known UI order — export the joined vertex order.
4. A muted link and a link into an unavailable socket — export the target's result.
5. A mesh saved by 5.2.2 whose `material_index` is constant — check for `storage_type = 1` or
   `is_single = 1`.
