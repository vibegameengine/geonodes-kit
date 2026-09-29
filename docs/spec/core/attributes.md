# Attributes

An attribute is a named array of values of one data type, stored on one domain of one component.
Its length is the size of that domain. Statements marked **verified** were observed in Blender 5.2.2
(headless, factory startup); the rest is read from the source and is pinned by the reference cases.

## Domains

| Domain | UI name | Exists on | Size |
|---|---|---|---|
| Point | Point / Vertex | mesh, curves, point cloud, grease pencil drawing | vertices / control points / points |
| Edge | Edge | mesh | edges |
| Face | Face | mesh | faces |
| Face Corner | Face Corner | mesh | corners (sum of face sizes) |
| Curve | Spline | curves, grease pencil drawing | curves |
| Instance | Instance | instances | instances |
| Layer | Layer | grease pencil | layers |

Volumes have no attributes.

Grease pencil: Layer-domain attributes live on the grease pencil itself; Point and Curve attributes
live on each layer's drawing (a curves geometry). A field evaluated on the Point or Curve domain of one
layer that reads a name which is not on that drawing but is on the Layer domain gets **that layer's
value** for every element.

## Data types

| Type | Value | Default value | Notes |
|---|---|---|---|
| bool | true / false | false | |
| int8 | signed 8-bit | 0 | used by built-ins such as `curve_type`, `handle_type_left` |
| int32 ("int") | signed 32-bit | 0 | |
| float | 32-bit IEEE | 0.0 | |
| float2 | 2 × float | (0, 0) | UV maps are float2 on Face Corner |
| float3 ("vector") | 3 × float | (0, 0, 0) | |
| float color | RGBA, 4 × float, scene linear, straight alpha | (0, 0, 0, 0) | verified |
| byte color | RGBA, 4 × uint8, RGB sRGB-encoded, alpha linear | (0, 0, 0, 0) | |
| quaternion ("rotation") | w, x, y, z floats | identity (1, 0, 0, 0) | verified |
| float4x4 ("matrix") | 16 floats, column-major, translation in the 4th column | **all zeros** | verified (join fill and missing Named Attribute read); the *Matrix socket* default is identity, the *attribute* default is zero |
| string | text | empty | never propagated by Join / Realize |

Internal types that appear on built-in attributes only: 2D int32 (`.edge_verts`), 2D int16 (packed
custom normals), float4.

The *default value* is what a missing attribute reads as, what new elements get when a node adds
elements without a source, and what Join fills in (see `geometry-set.md`).

## Built-in attributes

Built-in attributes have a fixed domain and type. A procedural write (Store Named Attribute, Capture
into a name) that asks for a built-in name with another domain or type **fails**: nothing is written
and the node reports a warning. Some built-ins have validators that clamp every written value.

When a generic (non-built-in) attribute is written with a domain or type different from the stored
one, the stored attribute is replaced by a new one of the requested kind. Elements not covered by the
write's selection start from the old values read with interpolation and conversion to the new kind
(or from the built-in default for built-ins, or the type default when there were no old values).

### Mesh

| Name | Domain | Type | Notes |
|---|---|---|---|
| `position` | Point | float3 | always present |
| `.edge_verts` | Edge | 2D int32 | the two vertex indices of each edge; written values clamped to ≥ 0 |
| `.corner_vert` | Face Corner | int32 | vertex of each corner; clamped to ≥ 0 |
| `.corner_edge` | Face Corner | int32 | edge from this corner to the next corner of the face; clamped to ≥ 0 |
| `material_index` | Face | int32 | clamped to [0, 32767] |
| `sharp_face` | Face | bool | |
| `sharp_edge` | Edge | bool | |

Face sizes/offsets are part of the topology, not an attribute. Vertex groups appear as float Point
attributes named after the group. `custom_normal` and UV maps are ordinary (non-built-in) attributes
with conventional names.

### Curves

| Name | Domain | Type | Default when absent | Validator |
|---|---|---|---|---|
| `position` | Point | float3 | — (always present) | |
| `radius` | Point | float | read as 0.01 by curve algorithms; a Named Attribute / Radius field reads 0 when absent | |
| `tilt` | Point | float | 0 | |
| `handle_left`, `handle_right` | Point | float3 | 0 | |
| `handle_type_left`, `handle_type_right` | Point | int8 | 0 (Free) | clamped to the handle type range |
| `nurbs_weight` | Point | float | 1.0 | |
| `custom_normal` | Point | float3 | — | |
| `nurbs_order` | Curve | int8 | 4 | clamped to ≥ 1 |
| `normal_mode` | Curve | int8 | 0 (Minimum Twist) | clamped to the mode range |
| `knots_mode` | Curve | int8 | 0 (Normal) | clamped to the mode range |
| `curve_type` | Curve | int8 | 0 (Catmull Rom) | clamped to the type range |
| `resolution` | Curve | int32 | 12 | clamped to ≥ 1 |
| `cyclic` | Curve | bool | false | |
| `material_index` | Curve | int32 | 0 | clamped to [0, 32767] |

### Point cloud

| Name | Domain | Type | Notes |
|---|---|---|---|
| `position` | Point | float3 | always present |
| `radius` | Point | float | read as 0.01 by point-cloud algorithms when absent |

### Instances

| Name | Domain | Type | Notes |
|---|---|---|---|
| `instance_transform` | Instance | float4x4 | always present |
| `.reference_index` | Instance | int32 | always present, index into the reference list |

Reading `position` on the Instance domain yields the translation of `instance_transform`.

### Grease pencil

No built-in attributes on the Layer domain. Drawings carry the curves built-ins.

### Conventional generic names

- `id` (int32) on Point or Instance — a stable random identity. Read by the implicit ID input and by
  Random Value (see `random-value.md`). Not built-in.
- `fill_id` (int32, Curve) — grease pencil fills; renumbered on join.

### Reserved names

- Names starting with `.` are internal. Names starting with `.corner`, `.edge`, `.select`,
  `.sculpt`, `.hide`, `.uv`, the name `.reference_index`, and names starting with `.uv_pin.` cannot be
  read or written by Named Attribute, Store Named Attribute or Remove Named Attribute: those nodes
  output their default / leave the geometry unchanged and show an info message.
- Names starting with `.a_` are anonymous attributes (see `fields.md`); they cannot be accessed by
  name and are removed from the final output of a tree.

## Reading an attribute with a domain and type

Every attribute read inside field evaluation asks for a name, a target domain and a target type:

1. If the name does not exist on the component → the read yields nothing and the field input
   evaluates to the **type's default** for every element.
2. If it exists on another domain → its values are **interpolated** to the target domain (below). If
   the pair of domains has no interpolation (e.g. curves Point ↔ Edge does not exist) → nothing.
3. If it has another type → each value is **converted** (below). If the types are not convertible →
   nothing.

Domain interpolation happens before type conversion, so interpolation runs in the stored type.

## Implicit type conversion

The same conversion table is used for attribute reads, attribute writes into a differently typed
attribute, links between sockets of different types, and muted-node pass-through.

Conventions: truncation means rounding toward zero; "Euler XYZ" means the rotation built from Euler
angles in radians, XYZ order.

### From float

| To | Result |
|---|---|
| int32 | truncation (−2.7 → −2, verified) |
| int8 | clamp to [−128, 127], then truncation |
| bool | `value > 0` (−2.7 → false, verified) |
| float2 / float3 / float4 | the value in every component (verified for float3) |
| float color | (v, v, v, 1) (verified) |
| byte color | encode (v, v, v, 1) (see byte color below) |
| quaternion | Euler XYZ (v, v, v) |

### From int32

| To | Result |
|---|---|
| float | nearest float |
| int8 | clamp to [−128, 127] (−300 → −128, verified) |
| bool | `value > 0` (−3 → false, verified) |
| float2 / float3 / float4 | the value as float in every component |
| float color | (v, v, v, 1) |
| byte color | encode (v, v, v, 1) |

No conversion from int32 to quaternion or float4x4.

### From int8

Same as int32 (bool is `value > 0`).

### From bool

| To | Result |
|---|---|
| float | 0.0 / 1.0 |
| int8, int32 | 0 / 1 |
| float2 / float3 / float4 | all 0 / all 1 |
| float color | (0,0,0,1) / (1,1,1,1) |
| byte color | encode of the above |

### From float2

float: `(x + y) / 2`; int32: truncation of that; int8: clamp then truncation of that; bool: any
component ≠ 0; float3: (x, y, 0); float4: (x, y, 0, 0); float color: (x, y, 0, 1); quaternion:
Euler XYZ (x, y, 0).

### From float3

float: `(x + y + z) / 3` (evaluated as `((x + y) + z) / 3` in float; (1, 2, 4.5) → 2.5, verified);
int32: truncation of that (→ 2, verified); int8: clamp then truncation of that; bool: any component
≠ 0; float2: (x, y) (verified); float4: (x, y, z, 0); float color: (x, y, z, 1); quaternion: Euler XYZ
(x, y, z) — (0.3, −0.2, 1.1) → w 0.83094239, x 0.17835893, y −0.00643555, z 0.52695483 (verified).

### From float4

float: mean of the four; int32 / int8: from that mean; bool: any ≠ 0; float2: (x, y); float3: (x, y,
z); float color: (x, y, z, w); quaternion: w = x-component, x = y-component … (the four values taken
in order as w, x, y, z).

### From float color

| To | Result |
|---|---|
| float | luminance `0.2126·r + 0.7152·g + 0.0722·b` (verified coefficients: pure red → 0.2126, green → 0.7152, blue → 0.0722; alpha ignored) |
| int32 | truncation of the luminance |
| int8 | clamp then truncation of the luminance |
| bool | luminance > 0 |
| float2 | (r, g) |
| float3 | (r, g, b) |
| float4 | (r, g, b, a) |
| byte color | encode |

The luminance coefficients come from the colour-management configuration; the values above are those
of Blender's default configuration.

### From byte color

bool: any of the **encoded** r, g, b bytes > 0 (alpha ignored); float color: decode; every other
target: decode, then the float color rule.

### Byte color encode / decode

- **Encode** (float color → byte color), per channel:
  - r, g, b: linear → sRGB transfer: `c < 0.0031308` → `max(c, 0) · 12.92`; otherwise
    `1.055 · c^(1/2.4) − 0.055`;
  - alpha: kept linear;
  - each of the four results → byte: `≤ 0` → 0; `> 1 − 0.5/255` → 255; otherwise
    `truncation(255 · v + 0.5)`.
  - Example (verified): (0.5, 0.2, 1.0, 0.25) → bytes (188, 124, 255, 64).
- **Decode** (byte color → float color): r, g, b: `c = byte / 255`, then `c < 0.04045` →
  `c / 12.92`, otherwise `((c + 0.055) / 1.055)^2.4`; alpha: `byte · (1/255)`. Example (verified):
  (188, 124, 255, 64) → (0.50288647, 0.20155630, 1.0, 0.25098041).
- Blender evaluates the `c^(1/2.4)` of the encode with a fast approximation whose relative error is
  about 1e-7; a byte can differ from the exact formula only when `255 · v + 0.5` lands within that
  error of an integer.

### Between rotation and matrix

- float4x4 → quaternion: the upper-left 3×3 with each column normalised, converted to a quaternion
  (scale and translation discarded; a degenerate matrix gives the identity).
- quaternion → float4x4: the rotation matrix, no translation, unit scale.
- quaternion → float3: Euler XYZ angles; → float2: the first two Euler angles; → float4: (w, x, y, z).

### Not convertible

String, geometry, object, collection, material, image, menu and the other ID types convert to nothing
and nothing converts to them. float4x4 converts only to quaternion. Quaternion converts only to float2,
float3, float4 and float4x4.

### Socket types

Sockets use the base types float (Float), int32 (Integer), bool (Boolean), float3 (Vector — also for
2D and 4D vector sockets), float color (Color), quaternion (Rotation), float4x4 (Matrix), string
(String). Valid socket-to-socket conversions are exactly the table above restricted to these types:

| From \ To | Float | Integer | Boolean | Vector | Color | Rotation | Matrix |
|---|---|---|---|---|---|---|---|
| Float | = | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Integer | ✓ | = | ✓ | ✓ | ✓ | – | – |
| Boolean | ✓ | ✓ | = | ✓ | ✓ | – | – |
| Vector | ✓ | ✓ | ✓ | = | ✓ | ✓ | – |
| Color | ✓ | ✓ | ✓ | ✓ | = | – | – |
| Rotation | – | – | – | ✓ | – | = | ✓ |
| Matrix | – | – | – | – | – | ✓ | = |

What a link between non-convertible sockets delivers is in `evaluation.md`.

## Domain interpolation

When a value stored (or computed) on one domain is needed on another domain of the same component.

### General rules

- **Averaging** ("mix") means: sum the contributing values in the stated order, starting from zero,
  then multiply by `1 / count` computed in float. Per type:
  - float, float2, float3, float4: component-wise, in float.
  - int32 (and 2D int32): sum in double precision, multiply by the float `1 / count`, then round to
    nearest with halves away from zero.
  - int8 (and 2D int16): sum in float, same rounding.
  - float color: component-wise average of all four channels.
  - byte color: average of the stored (encoded) bytes, computed in float, converted back by
    truncation.
  - quaternion: average of the rotation vectors (exponential map: axis × angle), converted back.
  - float4x4: decomposed into translation, rotation and scale; translation and scale averaged,
    rotation averaged through the exponential map; recomposed.
  - bool: never averaged — the explicit bool rules below apply.
  - string: no interpolation (read yields nothing).
- **Elements that receive no contribution** (loose vertices, loose edges) get (verified for float and
  bool in `attr-interp-loose`): 0 / zeros for numeric
  types, float color (0, 0, 0, 1), byte color (0, 0, 0, 255), float4x4 identity, false for bool.
- **Single-value shortcut**: when the source is one value for every element, the target is that same
  value everywhere, except in the cases where the target domain has elements with no contribution
  (face/corner → point with vertices not used by any face, face/corner → edge with edges not used by
  any face, edge → point with vertices not used by any edge). In those cases the normal rules run and
  the uncovered elements get the no-contribution value.

### Mesh

For every pair, "order" is the order in which contributions are summed; it matters for float
rounding.

| From → To | Non-bool | Bool |
|---|---|---|
| Point → Edge | `mix2`: `0.5·a + 0.5·b` of the two edge vertices (first, second). int: `round(0.5·a + 0.5·b)` evaluated in float, halves away from zero — (0,1) → 1, (2,3) → 3 (verified) | both vertices true |
| Point → Face | average of the face's vertices in corner order | all vertices true |
| Point → Face Corner | the value of the corner's vertex (copy) | copy |
| Edge → Point | average of all edges using the vertex, in ascending edge index | any edge true |
| Edge → Face | average of the face's edges in corner order | all edges true |
| Edge → Face Corner | average of two edges: the corner's own edge, then the edge of the previous corner in the face | both edges true |
| Face → Point | average of all faces using the vertex, in ascending face index | any face true |
| Face → Edge | average of all faces using the edge, in ascending face index | any face true |
| Face → Face Corner | the face's value (copy) | copy |
| Face Corner → Point | for every face using the vertex (ascending face index), the value of the **first** corner of that face that uses the vertex; averaged | all corners of the vertex true; vertices with no corner are false |
| Face Corner → Edge | walking faces in index order and corners in face order, every corner adds its own value and the next corner's value to the corner's edge; averaged (an edge shared by two faces averages four values) | all those corners true; loose edges false |
| Face Corner → Face | average of the face's corners in order | all corners true |

Verified on a 3×2 grid with point values 0..5 (`attr-interp-point-to-all`), on a cube for the corner
rules (`attr-interp-corner`) and for int rounding (`attr-interp-int-rounding`): face averages 1.5 and 3.5; edge averages
0.5, 2.5, 4.5, 1.0, 3.0, 2.0, 4.0; int edges 1, 3, 5, 1, 3, 2, 4; bool point `[F,F,T,T,T,T]` →
faces `[F,T]`, edges `[F,T,T,F,T,F,T]`.

"Faces using the vertex" lists a face once per corner that uses the vertex, so a face that uses a
vertex twice contributes twice.

### Curves

| From → To | Non-bool | Bool |
|---|---|---|
| Point → Curve | average of the curve's points in order | all points true |
| Curve → Point | copy of the curve's value | copy |

A single value is always broadcast.

### Point cloud, instances

One domain each; no interpolation.

### Grease pencil

Point ↔ Curve within a drawing follow the curves rules. Layer → Point/Curve broadcasts the layer's
value (see Domains). There is no Point/Curve → Layer interpolation.

## Reference cases

Cases are in the format of `reference/cases/cases.json` and run with `tools/blender/cases.py`;
socket identifiers are those of `coverage/nodes-5.2.2.json`. Links are created in the listed order,
so for a multi-input socket (Join Geometry) **the last listed link ends up first**. Every case below
was captured with Blender 5.2.2 while writing this spec; the "Blender result" column is what the
capture contained (attributes not mentioned are the node's usual output). The exporter reports an
empty `mesh` entry for results that have no mesh; ignore it.

| Case | Blender result |
|---|---|
| `attr-interp-point-to-all` | `face_f` `[1.5,3.5]`; `edge_f` `[0.5,2.5,4.5,1,3,2,4]`; `corner_f` `[0,2,3,1,2,4,5,3]`; `edge_i` `[1,3,5,1,3,2,4]`; `face_i` `[2,4]`; `face_b` `[F,T]`; `edge_b` `[F,T,T,F,T,F,T]`; `corner_b` `[F,T,T,F,T,T,T,T]` |
| `attr-interp-loose` | `ff_point` `[7,7,7,7,0,0,0]`; `ff_edge` `[7,7,7,7,0]`; `fb_point` `[T,T,T,T,F,F,F]`; `fb_edge` `[T,T,T,T,F]` |
| `attr-interp-corner` | `c_edge` `[3,9,7.5,11.5,11,13.5,7.5,13.5,16,12,15.5,18]`; `c_point` `[6.666667,9.333334,10.666667,12.666667,10.666667,12.666667,14,15.333334]`; `c_face` `[1.5,5.5,9.5,13.5,17.5,21.5]` |
| `attr-interp-int-rounding` | `pi_edge` `[-1,2,0,1]`; `pi_face` `[1]` |
| `attr-interp-byte-color` | `bc_face` (0.6866854, 0.5394797, 0.3915726, 1.0) |
| `attr-interp-quaternion` | `q_face` (0.9305076, 0, 0, 0.3662725) — rotation about Z by 0.75, the mean of 0, 0.5, 1, 1.5 |
| `attr-interp-curves` | `pf_curve` `[3.5]`; `cf_point` `[5×8]` |
| `attr-conversions` | `lum_r/g/b` 0.2126 / 0.7152 / 0.0722; `c_mix_as_byte` = `b_mix` (bytes 188,124,255,64; decoded 0.5028865, 0.2015563, 1.0, 0.2509804); `b_small_as_color` (0.0021247, 0.0097212, 0.8962696, 1); `f_neg_as_int` −2; `f_neg_as_bool` false; `i_neg_as_bool` false; `v_as_float` 2.5; `v_as_int` 2; `f_neg_as_color` (−2.7,−2.7,−2.7,1); `euler_as_rotation` (0.8309424, 0.1783589, −0.0064356, 0.5269548); `f_neg_as_vector` (−2.7,−2.7,−2.7); `i_big_as_int8` −128; `v_as_float2` (1, 2) |
| `attr-missing-read` | float 0, int 0, bool false, vector 0, colour (0,0,0,0), rotation (1,0,0,0), matrix all zeros |
| `attr-reserved-name` | `ev` `[0,0,0,0]` |
| `attr-instance-position` | `p` equals the grid vertex positions |

```json
[
  {
    "id": "attr-interp-point-to-all",
    "description": "Grid 3x2: point values 0..5 as FLOAT, INT and BOOL (Index >= 2) read on Face, Edge and Face Corner",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 3, "Vertices Y": 2}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "pf", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "pf"}},
        {"name": "pi", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "pi"}},
        {"name": "cmp", "type": "FunctionNodeCompare", "properties": {"data_type": "INT", "operation": "GREATER_EQUAL"}, "inputs": {"B": 2}},
        {"name": "pb", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "pb"}},
        {"name": "rf", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT"}, "inputs": {"Name": "pf"}},
        {"name": "ri", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "INT"}, "inputs": {"Name": "pi"}},
        {"name": "rb", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "BOOLEAN"}, "inputs": {"Name": "pb"}},
        {"name": "ff", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "FACE"}, "inputs": {"Name": "face_f"}},
        {"name": "ef", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "EDGE"}, "inputs": {"Name": "edge_f"}},
        {"name": "cf", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "CORNER"}, "inputs": {"Name": "corner_f"}},
        {"name": "ei", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "EDGE"}, "inputs": {"Name": "edge_i"}},
        {"name": "fi", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "FACE"}, "inputs": {"Name": "face_i"}},
        {"name": "fb", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "FACE"}, "inputs": {"Name": "face_b"}},
        {"name": "eb", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "EDGE"}, "inputs": {"Name": "edge_b"}},
        {"name": "cb", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "CORNER"}, "inputs": {"Name": "corner_b"}}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["pf", "Geometry"]},
        {"from": ["idx", "Index"], "to": ["pf", "Value"]},
        {"from": ["pf", "Geometry"], "to": ["pi", "Geometry"]},
        {"from": ["idx", "Index"], "to": ["pi", "Value"]},
        {"from": ["idx", "Index"], "to": ["cmp", "A"]},
        {"from": ["pi", "Geometry"], "to": ["pb", "Geometry"]},
        {"from": ["cmp", "Result"], "to": ["pb", "Value"]},
        {"from": ["pb", "Geometry"], "to": ["ff", "Geometry"]},
        {"from": ["rf", "Attribute"], "to": ["ff", "Value"]},
        {"from": ["ff", "Geometry"], "to": ["ef", "Geometry"]},
        {"from": ["rf", "Attribute"], "to": ["ef", "Value"]},
        {"from": ["ef", "Geometry"], "to": ["cf", "Geometry"]},
        {"from": ["rf", "Attribute"], "to": ["cf", "Value"]},
        {"from": ["cf", "Geometry"], "to": ["ei", "Geometry"]},
        {"from": ["ri", "Attribute"], "to": ["ei", "Value"]},
        {"from": ["ei", "Geometry"], "to": ["fi", "Geometry"]},
        {"from": ["ri", "Attribute"], "to": ["fi", "Value"]},
        {"from": ["fi", "Geometry"], "to": ["fb", "Geometry"]},
        {"from": ["rb", "Attribute"], "to": ["fb", "Value"]},
        {"from": ["fb", "Geometry"], "to": ["eb", "Geometry"]},
        {"from": ["rb", "Attribute"], "to": ["eb", "Value"]},
        {"from": ["eb", "Geometry"], "to": ["cb", "Geometry"]},
        {"from": ["rb", "Attribute"], "to": ["cb", "Value"]}
      ],
      "output": ["cb", "Geometry"]
    }
  },
  {
    "id": "attr-interp-loose",
    "description": "Grid 2x2 joined with a two-vertex Mesh Line and one loose vertex; ff = 7 on Face and fb = true on Face read on Point and Edge",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 2}},
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 1, "Position": [5, 5, 5]}},
        {"name": "p2v", "type": "GeometryNodePointsToVertices"},
        {"name": "join", "type": "GeometryNodeJoinGeometry"},
        {"name": "sf", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "FACE"}, "inputs": {"Name": "ff", "Value": 7.0}},
        {"name": "sb", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "FACE"}, "inputs": {"Name": "fb", "Value": true}},
        {"name": "rf", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT"}, "inputs": {"Name": "ff"}},
        {"name": "rb", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "BOOLEAN"}, "inputs": {"Name": "fb"}},
        {"name": "fp", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "ff_point"}},
        {"name": "fe", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "EDGE"}, "inputs": {"Name": "ff_edge"}},
        {"name": "bp", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "fb_point"}},
        {"name": "be", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "EDGE"}, "inputs": {"Name": "fb_edge"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["p2v", "Points"]},
        {"from": ["p2v", "Mesh"], "to": ["join", "Geometry"]},
        {"from": ["line", "Mesh"], "to": ["join", "Geometry"]},
        {"from": ["g", "Mesh"], "to": ["join", "Geometry"]},
        {"from": ["join", "Geometry"], "to": ["sf", "Geometry"]},
        {"from": ["sf", "Geometry"], "to": ["sb", "Geometry"]},
        {"from": ["sb", "Geometry"], "to": ["fp", "Geometry"]},
        {"from": ["rf", "Attribute"], "to": ["fp", "Value"]},
        {"from": ["fp", "Geometry"], "to": ["fe", "Geometry"]},
        {"from": ["rf", "Attribute"], "to": ["fe", "Value"]},
        {"from": ["fe", "Geometry"], "to": ["bp", "Geometry"]},
        {"from": ["rb", "Attribute"], "to": ["bp", "Value"]},
        {"from": ["bp", "Geometry"], "to": ["be", "Geometry"]},
        {"from": ["rb", "Attribute"], "to": ["be", "Value"]}
      ],
      "output": ["be", "Geometry"]
    }
  },
  {
    "id": "attr-interp-corner",
    "description": "Cube: c = Index on Face Corner read on Edge, Point and Face",
    "tree": {
      "nodes": [
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "sc", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "CORNER"}, "inputs": {"Name": "c"}},
        {"name": "rc", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT"}, "inputs": {"Name": "c"}},
        {"name": "se", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "EDGE"}, "inputs": {"Name": "c_edge"}},
        {"name": "sp", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "c_point"}},
        {"name": "sf", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "FACE"}, "inputs": {"Name": "c_face"}}
      ],
      "links": [
        {"from": ["cube", "Mesh"], "to": ["sc", "Geometry"]},
        {"from": ["idx", "Index"], "to": ["sc", "Value"]},
        {"from": ["sc", "Geometry"], "to": ["se", "Geometry"]},
        {"from": ["rc", "Attribute"], "to": ["se", "Value"]},
        {"from": ["se", "Geometry"], "to": ["sp", "Geometry"]},
        {"from": ["rc", "Attribute"], "to": ["sp", "Value"]},
        {"from": ["sp", "Geometry"], "to": ["sf", "Geometry"]},
        {"from": ["rc", "Attribute"], "to": ["sf", "Value"]}
      ],
      "output": ["sf", "Geometry"]
    }
  },
  {
    "id": "attr-interp-int-rounding",
    "description": "Grid 2x2: pi = Index - 1 on Point read on Edge and Face; halves round away from zero",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "sub", "type": "FunctionNodeIntegerMath", "properties": {"operation": "SUBTRACT"}, "inputs": {"Value_001": 1}},
        {"name": "sp", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "pi"}},
        {"name": "r", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "INT"}, "inputs": {"Name": "pi"}},
        {"name": "se", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "EDGE"}, "inputs": {"Name": "pi_edge"}},
        {"name": "sf", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "FACE"}, "inputs": {"Name": "pi_face"}}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["sp", "Geometry"]},
        {"from": ["idx", "Index"], "to": ["sub", "Value"]},
        {"from": ["sub", "Value"], "to": ["sp", "Value"]},
        {"from": ["sp", "Geometry"], "to": ["se", "Geometry"]},
        {"from": ["r", "Attribute"], "to": ["se", "Value"]},
        {"from": ["se", "Geometry"], "to": ["sf", "Geometry"]},
        {"from": ["r", "Attribute"], "to": ["sf", "Value"]}
      ],
      "output": ["sf", "Geometry"]
    }
  },
  {
    "id": "attr-interp-byte-color",
    "description": "Grid 2x2: byte colour on Point from Random Value vectors, read on Face as float colour",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "FLOAT_VECTOR"}},
        {"name": "sb", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BYTE_COLOR", "domain": "POINT"}, "inputs": {"Name": "bc"}},
        {"name": "r", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT_COLOR"}, "inputs": {"Name": "bc"}},
        {"name": "sf", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "FACE"}, "inputs": {"Name": "bc_face"}}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["sb", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["sb", "Value"]},
        {"from": ["sb", "Geometry"], "to": ["sf", "Geometry"]},
        {"from": ["r", "Attribute"], "to": ["sf", "Value"]}
      ],
      "output": ["sf", "Geometry"]
    }
  },
  {
    "id": "attr-interp-quaternion",
    "description": "Grid 2x2: rotation about Z by Index * 0.5 on Point, read on Face",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "mul", "type": "ShaderNodeMath", "properties": {"operation": "MULTIPLY"}, "inputs": {"Value_001": 0.5}},
        {"name": "xyz", "type": "ShaderNodeCombineXYZ"},
        {"name": "eul", "type": "FunctionNodeEulerToRotation"},
        {"name": "sq", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "QUATERNION", "domain": "POINT"}, "inputs": {"Name": "q"}},
        {"name": "r", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "QUATERNION"}, "inputs": {"Name": "q"}},
        {"name": "sf", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "QUATERNION", "domain": "FACE"}, "inputs": {"Name": "q_face"}}
      ],
      "links": [
        {"from": ["idx", "Index"], "to": ["mul", "Value"]},
        {"from": ["mul", "Value"], "to": ["xyz", "Z"]},
        {"from": ["xyz", "Vector"], "to": ["eul", "Euler"]},
        {"from": ["g", "Mesh"], "to": ["sq", "Geometry"]},
        {"from": ["eul", "Rotation"], "to": ["sq", "Value"]},
        {"from": ["sq", "Geometry"], "to": ["sf", "Geometry"]},
        {"from": ["r", "Attribute"], "to": ["sf", "Value"]}
      ],
      "output": ["sf", "Geometry"]
    }
  },
  {
    "id": "attr-interp-curves",
    "description": "Curve Circle with 8 points: Index on Point read on Curve, and 5 on Curve read on Point",
    "tree": {
      "nodes": [
        {"name": "c", "type": "GeometryNodeCurvePrimitiveCircle", "inputs": {"Resolution": 8}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "sp", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "pf"}},
        {"name": "r", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT"}, "inputs": {"Name": "pf"}},
        {"name": "sc", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "CURVE"}, "inputs": {"Name": "pf_curve"}},
        {"name": "sc2", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "CURVE"}, "inputs": {"Name": "cf", "Value": 5.0}},
        {"name": "r2", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT"}, "inputs": {"Name": "cf"}},
        {"name": "sp2", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "cf_point"}}
      ],
      "links": [
        {"from": ["c", "Curve"], "to": ["sp", "Geometry"]},
        {"from": ["idx", "Index"], "to": ["sp", "Value"]},
        {"from": ["sp", "Geometry"], "to": ["sc", "Geometry"]},
        {"from": ["r", "Attribute"], "to": ["sc", "Value"]},
        {"from": ["sc", "Geometry"], "to": ["sc2", "Geometry"]},
        {"from": ["sc2", "Geometry"], "to": ["sp2", "Geometry"]},
        {"from": ["r2", "Attribute"], "to": ["sp2", "Value"]}
      ],
      "output": ["sp2", "Geometry"]
    }
  },
  {
    "id": "attr-conversions",
    "description": "One point: attributes of several types read through Named Attribute of another type and stored again",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "s1", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "POINT"}, "inputs": {"Name": "c_red", "Value": [1, 0, 0, 1]}},
        {"name": "s2", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "POINT"}, "inputs": {"Name": "c_green", "Value": [0, 1, 0, 1]}},
        {"name": "s3", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "POINT"}, "inputs": {"Name": "c_blue", "Value": [0, 0, 1, 1]}},
        {"name": "s4", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "POINT"}, "inputs": {"Name": "c_mix", "Value": [0.5, 0.2, 1, 0.25]}},
        {"name": "s5", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BYTE_COLOR", "domain": "POINT"}, "inputs": {"Name": "b_mix", "Value": [0.5, 0.2, 1, 0.25]}},
        {"name": "s6", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BYTE_COLOR", "domain": "POINT"}, "inputs": {"Name": "b_small", "Value": [0.002, 0.01, 0.9, 1]}},
        {"name": "s7", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "f_neg", "Value": -2.7}},
        {"name": "s8", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "i_neg", "Value": -3}},
        {"name": "s9", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "i_big", "Value": -300}},
        {"name": "s10", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "v", "Value": [1, 2, 4.5]}},
        {"name": "s11", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "euler", "Value": [0.3, -0.2, 1.1]}},
        {"name": "s12", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "lum_r"}},
        {"name": "r12", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT"}, "inputs": {"Name": "c_red"}},
        {"name": "s13", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "lum_g"}},
        {"name": "r13", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT"}, "inputs": {"Name": "c_green"}},
        {"name": "s14", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "lum_b"}},
        {"name": "r14", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT"}, "inputs": {"Name": "c_blue"}},
        {"name": "s15", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BYTE_COLOR", "domain": "POINT"}, "inputs": {"Name": "c_mix_as_byte"}},
        {"name": "r15", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT_COLOR"}, "inputs": {"Name": "c_mix"}},
        {"name": "s16", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "POINT"}, "inputs": {"Name": "b_mix_as_color"}},
        {"name": "r16", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT_COLOR"}, "inputs": {"Name": "b_mix"}},
        {"name": "s17", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "POINT"}, "inputs": {"Name": "b_small_as_color"}},
        {"name": "r17", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT_COLOR"}, "inputs": {"Name": "b_small"}},
        {"name": "s18", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "f_neg_as_int"}},
        {"name": "r18", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "INT"}, "inputs": {"Name": "f_neg"}},
        {"name": "s19", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "f_neg_as_bool"}},
        {"name": "r19", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "BOOLEAN"}, "inputs": {"Name": "f_neg"}},
        {"name": "s20", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "i_neg_as_bool"}},
        {"name": "r20", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "BOOLEAN"}, "inputs": {"Name": "i_neg"}},
        {"name": "s21", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "v_as_float"}},
        {"name": "r21", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT"}, "inputs": {"Name": "v"}},
        {"name": "s22", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "v_as_int"}},
        {"name": "r22", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "INT"}, "inputs": {"Name": "v"}},
        {"name": "s23", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "POINT"}, "inputs": {"Name": "f_neg_as_color"}},
        {"name": "r23", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT_COLOR"}, "inputs": {"Name": "f_neg"}},
        {"name": "s24", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "QUATERNION", "domain": "POINT"}, "inputs": {"Name": "euler_as_rotation"}},
        {"name": "r24", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "QUATERNION"}, "inputs": {"Name": "euler"}},
        {"name": "s25", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "f_neg_as_vector"}},
        {"name": "r25", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR"}, "inputs": {"Name": "f_neg"}},
        {"name": "s26", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT8", "domain": "POINT"}, "inputs": {"Name": "i_big_as_int8"}},
        {"name": "r26", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "INT"}, "inputs": {"Name": "i_big"}},
        {"name": "s27", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT2", "domain": "POINT"}, "inputs": {"Name": "v_as_float2"}},
        {"name": "r27", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR"}, "inputs": {"Name": "v"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s1", "Geometry"]},
        {"from": ["s1", "Geometry"], "to": ["s2", "Geometry"]},
        {"from": ["s2", "Geometry"], "to": ["s3", "Geometry"]},
        {"from": ["s3", "Geometry"], "to": ["s4", "Geometry"]},
        {"from": ["s4", "Geometry"], "to": ["s5", "Geometry"]},
        {"from": ["s5", "Geometry"], "to": ["s6", "Geometry"]},
        {"from": ["s6", "Geometry"], "to": ["s7", "Geometry"]},
        {"from": ["s7", "Geometry"], "to": ["s8", "Geometry"]},
        {"from": ["s8", "Geometry"], "to": ["s9", "Geometry"]},
        {"from": ["s9", "Geometry"], "to": ["s10", "Geometry"]},
        {"from": ["s10", "Geometry"], "to": ["s11", "Geometry"]},
        {"from": ["s11", "Geometry"], "to": ["s12", "Geometry"]},
        {"from": ["r12", "Attribute"], "to": ["s12", "Value"]},
        {"from": ["s12", "Geometry"], "to": ["s13", "Geometry"]},
        {"from": ["r13", "Attribute"], "to": ["s13", "Value"]},
        {"from": ["s13", "Geometry"], "to": ["s14", "Geometry"]},
        {"from": ["r14", "Attribute"], "to": ["s14", "Value"]},
        {"from": ["s14", "Geometry"], "to": ["s15", "Geometry"]},
        {"from": ["r15", "Attribute"], "to": ["s15", "Value"]},
        {"from": ["s15", "Geometry"], "to": ["s16", "Geometry"]},
        {"from": ["r16", "Attribute"], "to": ["s16", "Value"]},
        {"from": ["s16", "Geometry"], "to": ["s17", "Geometry"]},
        {"from": ["r17", "Attribute"], "to": ["s17", "Value"]},
        {"from": ["s17", "Geometry"], "to": ["s18", "Geometry"]},
        {"from": ["r18", "Attribute"], "to": ["s18", "Value"]},
        {"from": ["s18", "Geometry"], "to": ["s19", "Geometry"]},
        {"from": ["r19", "Attribute"], "to": ["s19", "Value"]},
        {"from": ["s19", "Geometry"], "to": ["s20", "Geometry"]},
        {"from": ["r20", "Attribute"], "to": ["s20", "Value"]},
        {"from": ["s20", "Geometry"], "to": ["s21", "Geometry"]},
        {"from": ["r21", "Attribute"], "to": ["s21", "Value"]},
        {"from": ["s21", "Geometry"], "to": ["s22", "Geometry"]},
        {"from": ["r22", "Attribute"], "to": ["s22", "Value"]},
        {"from": ["s22", "Geometry"], "to": ["s23", "Geometry"]},
        {"from": ["r23", "Attribute"], "to": ["s23", "Value"]},
        {"from": ["s23", "Geometry"], "to": ["s24", "Geometry"]},
        {"from": ["r24", "Attribute"], "to": ["s24", "Value"]},
        {"from": ["s24", "Geometry"], "to": ["s25", "Geometry"]},
        {"from": ["r25", "Attribute"], "to": ["s25", "Value"]},
        {"from": ["s25", "Geometry"], "to": ["s26", "Geometry"]},
        {"from": ["r26", "Attribute"], "to": ["s26", "Value"]},
        {"from": ["s26", "Geometry"], "to": ["s27", "Geometry"]},
        {"from": ["r27", "Attribute"], "to": ["s27", "Value"]}
      ],
      "output": ["s27", "Geometry"]
    }
  },
  {
    "id": "attr-missing-read",
    "description": "Named Attribute of a missing name for every socket type stored on a Grid 2x2",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "n_FLOAT", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT"}, "inputs": {"Name": "nope"}},
        {"name": "n_INT", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "INT"}, "inputs": {"Name": "nope"}},
        {"name": "n_BOOLEAN", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "BOOLEAN"}, "inputs": {"Name": "nope"}},
        {"name": "n_FLOAT_VECTOR", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR"}, "inputs": {"Name": "nope"}},
        {"name": "n_FLOAT_COLOR", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT_COLOR"}, "inputs": {"Name": "nope"}},
        {"name": "n_QUATERNION", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "QUATERNION"}, "inputs": {"Name": "nope"}},
        {"name": "n_FLOAT4X4", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "FLOAT4X4"}, "inputs": {"Name": "nope"}},
        {"name": "s_FLOAT", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "m_float"}},
        {"name": "s_INT", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "m_int"}},
        {"name": "s_BOOLEAN", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "m_boolean"}},
        {"name": "s_FLOAT_VECTOR", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "m_float_vector"}},
        {"name": "s_FLOAT_COLOR", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "POINT"}, "inputs": {"Name": "m_float_color"}},
        {"name": "s_QUATERNION", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "QUATERNION", "domain": "POINT"}, "inputs": {"Name": "m_quaternion"}},
        {"name": "s_FLOAT4X4", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT4X4", "domain": "POINT"}, "inputs": {"Name": "m_float4x4"}}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["s_FLOAT", "Geometry"]},
        {"from": ["s_FLOAT", "Geometry"], "to": ["s_INT", "Geometry"]},
        {"from": ["s_INT", "Geometry"], "to": ["s_BOOLEAN", "Geometry"]},
        {"from": ["s_BOOLEAN", "Geometry"], "to": ["s_FLOAT_VECTOR", "Geometry"]},
        {"from": ["s_FLOAT_VECTOR", "Geometry"], "to": ["s_FLOAT_COLOR", "Geometry"]},
        {"from": ["s_FLOAT_COLOR", "Geometry"], "to": ["s_QUATERNION", "Geometry"]},
        {"from": ["s_QUATERNION", "Geometry"], "to": ["s_FLOAT4X4", "Geometry"]},
        {"from": ["n_FLOAT", "Attribute"], "to": ["s_FLOAT", "Value"]},
        {"from": ["n_INT", "Attribute"], "to": ["s_INT", "Value"]},
        {"from": ["n_BOOLEAN", "Attribute"], "to": ["s_BOOLEAN", "Value"]},
        {"from": ["n_FLOAT_VECTOR", "Attribute"], "to": ["s_FLOAT_VECTOR", "Value"]},
        {"from": ["n_FLOAT_COLOR", "Attribute"], "to": ["s_FLOAT_COLOR", "Value"]},
        {"from": ["n_QUATERNION", "Attribute"], "to": ["s_QUATERNION", "Value"]},
        {"from": ["n_FLOAT4X4", "Attribute"], "to": ["s_FLOAT4X4", "Value"]}
      ],
      "output": ["s_FLOAT4X4", "Geometry"]
    }
  },
  {
    "id": "attr-reserved-name",
    "description": "Named Attribute .edge_verts cannot be read: ev is all 0",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "r", "type": "GeometryNodeInputNamedAttribute", "properties": {"data_type": "INT"}, "inputs": {"Name": ".edge_verts"}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "EDGE"}, "inputs": {"Name": "ev"}}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["s", "Geometry"]},
        {"from": ["r", "Attribute"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "attr-instance-position",
    "description": "Position on the Instance domain is the instance translation",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "iop", "type": "GeometryNodeInstanceOnPoints"},
        {"name": "pos", "type": "GeometryNodeInputPosition"},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "INSTANCE"}, "inputs": {"Name": "p"}}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["iop", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["iop", "Instance"]},
        {"from": ["iop", "Instances"], "to": ["s", "Geometry"]},
        {"from": ["pos", "Position"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  }
]
```
