# Geometry set

The value that travels along a Geometry socket. It is a container of independent components plus a
name. Everything a geometry node does is expressed as reading and replacing components.

Status of the statements below:

- **verified** — observed in Blender 5.2.2 (headless, factory startup) while writing this spec.
- everything else is read from the source and must be pinned by the reference cases at the end.

## Components

A geometry set holds **at most one component of each kind**:

| Kind | Holds | Attribute domains |
|---|---|---|
| Mesh | vertices, edges, faces, face corners | Point, Edge, Face, Face Corner |
| Curves | control points grouped into curves (splines) | Point, Curve (UI: "Spline") |
| Point cloud | loose points | Point |
| Instances | a list of instances and a list of references | Instance |
| Volume | named grids | none (no attribute domains) |
| Grease pencil | layers; each layer has a drawing that is a curves geometry | Layer; per drawing Point and Curve |

There is also an internal editing-hints component with no user-visible data; a JS implementation can
ignore it.

A component may be present but hold "nothing". The meaning of *empty* differs per kind and matters
for Join Geometry:

- Mesh, Curves, Point cloud, Grease pencil: empty only when the component holds no data at all. A mesh
  with zero vertices is **not** empty.
- Instances: empty when it holds zero instances.

A geometry set also carries a **name** (a string, used by nodes such as Geometry to Instance and
Join Geometry). Nothing else from the set is needed for geometry evaluation.

A geometry set with no components is the default value of a Geometry socket.

## Instances component

An instances component is two parallel structures:

1. **References**: an ordered list. Each reference is one of
   - nothing (an empty instance),
   - an object,
   - a collection,
   - a geometry set (which may itself contain an instances component — nesting has no depth limit).
2. **Instances**: `N` elements on the Instance domain. Every instance has
   - `instance_transform` — a 4×4 float matrix (built-in, cannot be removed),
   - `.reference_index` — an int, index into the reference list (built-in, hidden from procedural
     access),
   - any number of generic attributes on the Instance domain (for example `id`).

Reading the attribute name `position` on the Instance domain returns the translation column of
`instance_transform`; `position` is not stored for instances.

### Reference identity

When references are merged (Join Geometry of several instance components), two references are the
same reference when they point at the **same object, the same collection, or the same geometry-set
data** — identity of the shared data, not equality of contents. Two separately generated but
identical cubes are two references; one cube socket fanned out to two instance-producing nodes and
joined afterwards is one reference (verified: `gs-join-instance-references` has 2 references).

### Nesting and transforms

When nested instances are realized, the world transform of a leaf element is the product of the
transforms from the outside in: `outer_instance_transform × inner_instance_transform × point`
(column vectors). Instance order after realizing is depth-first: the instances of the outer component
in index order, and for each one the whole content of its reference before the next outer instance.

## Join Geometry

Node: **Join Geometry**. One multi-input Geometry socket, one Geometry output.

### Input order

The inputs of a multi-input socket are the links connected to it, in **link order**: the link that was
connected most recently comes first; in the node editor it is the topmost one. In a `.blend` each link
into a multi-input socket stores a sort number; links are taken **highest sort number first**
(verified: the geometry on the last-connected link came first in the output).

Links that are muted, links from sockets that are not available, and links coming out of a reroute
chain that has no input are skipped and do not occupy a position.

If no inputs remain the result is an empty geometry set. The result's name is the name of the first
input (an empty string if there is none).

### Per kind

Each component kind is joined independently of the others. For a kind:

1. Collect that kind's component from every input, in input order, skipping missing and *empty*
   components.
2. If none remain, the result has no component of this kind.
3. If exactly one remains, the result holds **that component unchanged** — all its attributes of all
   types (including string attributes), materials, everything.
4. Otherwise the components are merged as described below.

### Merging meshes, point clouds, curves and grease pencil

Elements are **concatenated in input order**. For meshes, vertices, edges, faces and corners of input
`k` follow those of inputs `0..k-1`, and every index stored in the topology (edge vertices, corner
vertex, corner edge, face start) is offset by the counts of the earlier inputs (verified). Curves
concatenate points and curves (and custom NURBS knots) the same way. Grease pencil concatenates
layers.

Inputs whose element count is zero are dropped before merging: a mesh with no vertices, a point cloud
with no points, a curves geometry with no curves, a grease pencil with no layers. If only one input is
left after dropping, the result is a copy of that input; attributes that existed only on the dropped
inputs are not added (verified: `gs-join-empty-mesh`). If none is left, the result has no component of this kind.

Positions are not transformed by Join Geometry.

#### Which attributes the result has, and their kind

The set of attribute names is the union over all inputs of that kind, except:

- string attributes are never merged (dropped);
- attributes that are built-in on a *different* component kind are not carried over (not relevant to
  Join, where all inputs are the same kind).

When one name has different domains or types in different inputs, the result uses one domain and one
type chosen as follows.

**Type — the "most complex" wins**, in this order from least to most complex:

bool < int8 < int32 < float < 2D int16 (internal) < 2D int32 (internal) < float2 < float3 < float4
(internal) < byte color < quaternion < float color < float4x4

Example (verified): `t` is int32 on the first mesh and float on the second → the joined `t` is float.

**Domain — the highest priority wins**, from lowest to highest:

Instance < Layer < Curve < Face < Edge < Point < Face Corner

Example (verified): `d` on the Face domain of one mesh and on the Point domain of another → the joined
`d` is on the Point domain; the first mesh's face values are interpolated to its points (see
`attributes.md`, face → point).

Each input's values are then read **converted to the chosen domain** (domain interpolation) and **to
the chosen type** (implicit conversion, see `attributes.md`).

#### Missing attributes

An input that lacks an attribute contributes the **default value of the result type** for all of its
elements:

| Type | Fill value |
|---|---|
| bool | false |
| int8, int32 | 0 |
| float | 0 |
| float2 / float3 | all zeros |
| float color | (0, 0, 0, 0) — verified |
| byte color | (0, 0, 0, 0) |
| quaternion | identity (w = 1, x = y = z = 0) — verified |
| float4x4 | **all sixteen entries zero**, not identity — verified |

Exceptions, where a non-zero fill applies:

- Point clouds: missing `radius` → 0.01 (verified).
- Curves: missing `radius` → 1.0 (verified); missing `handle_left` / `handle_right` → (0, 0, 0) (these are only
  created if at least one input has handle positions); missing curve `custom_normal` → (0, 0, 1).
- Curves: a missing **built-in** curve attribute takes its built-in default: `resolution` 12 (verified),
  `nurbs_weight` 1.0, `nurbs_order` 4, every other built-in (`cyclic`, `curve_type`, `tilt`,
  `handle_type_left/right`, `normal_mode`, `knots_mode`, `material_index`) 0 / false.
- `id` (all kinds): Join keeps original ids. The result has `id` on the Point domain (Instance domain
  for instances) if any input has an attribute named `id`; an input whose `id` is missing — or is not
  an int32 attribute on the Point domain — contributes 0 for each of its points.

If after filling every input has the same single value everywhere for an attribute, the result stores
that value; this is only a storage optimisation and does not change values.

#### Materials (meshes)

The result's material list is the list of **unique** materials in order of first appearance while
walking the inputs in order and each input's material slots in slot order. An input with no material
slots contributes one "no material" entry (once for all such inputs). Face `material_index` values are
remapped from each input's own slot numbering to positions in the joined list.

- An input without a `material_index` attribute is treated as all faces using slot 0.
- If the joined list has at most one entry, the result has **no** `material_index` attribute at all,
  even if inputs had one.
- Out-of-range source indices: when the source attribute stores one value for all faces, an
  out-of-range value maps to the new position of that input's first slot; when it stores values per
  face, an out-of-range value becomes 0. (Two different outcomes — pin with a reference case.)

Point clouds take the material list of the first input. Curves: parameters (and materials) of the first
input. Grease pencil: the union of materials in order of first appearance, and every stroke's
`material_index` that is within its input's range is remapped.

#### Vertex groups (meshes, curves)

Vertex groups behave as float Point attributes for merging. The result keeps the first input's vertex
groups in their order, then appends groups whose names were not seen yet, in input order.

#### Curves specifics

- `fill_id` (int, Curve domain): non-zero values are renumbered so that fills from different inputs
  never collide. Within one input, the distinct non-zero fill ids are numbered in order of first
  appearance along the curves (0, 1, 2 …); the result value is
  `(number of distinct non-zero fill ids in all earlier inputs) + that number + 1`. Zero stays zero.
- Per-type curve counts are summed (no user-visible effect beyond consistency).

#### Grease pencil specifics

Layers are appended in input order with their names, transforms and drawings copied; layer
attributes merge on the Layer domain with the rules above.

### Merging instances

- Instances are concatenated in input order; transforms are copied unchanged.
- References: for each input in order, each of its references is looked up among the references
  already in the result by **identity** (see above); if found it is reused, otherwise appended. Each
  instance's `.reference_index` is rewritten to point at the reference in the result list.
- Attributes (all on the Instance domain, `instance_transform` included) merge with the type rule and
  missing-attribute fill above. `.reference_index` is not merged as an attribute, it is rebuilt.

### Volumes

A single volume component passes through. **When two or more inputs have a volume, the result has no
volume component at all** (verified: two Volume Cube outputs joined with a mesh gave a mesh and no
volume).

## Realizing instances (reference for nesting)

Join Geometry for mesh, point cloud, curves and grease pencil behaves exactly as realizing a temporary
set of identity-transform instances, one per input, while keeping original ids. The same rules
(attribute union, type and domain choice, fills, materials) therefore also describe Realize Instances,
with two additions that only matter there:

- element positions (and handle positions, custom normals) are transformed by the accumulated instance
  transform;
- attributes stored on the Instance domain of the instances being realized are carried onto the
  realized elements (Point domain for meshes and point clouds, Curve domain for curves, Layer domain
  for grease pencil) and act as the fill value for that instance's elements when the element geometry
  lacks the attribute.

The id generation of Realize Instances when ids are not kept is part of that node's spec, not this
one.

## Reference cases

Cases are in the format of `reference/cases/cases.json` and run with `tools/blender/cases.py`;
socket identifiers are those of `coverage/nodes-5.2.2.json`. Links are created in the listed order,
so for a multi-input socket (Join Geometry) **the last listed link ends up first**. Every case below
was captured with Blender 5.2.2 while writing this spec; the "Blender result" column is what the
capture contained (attributes not mentioned are the node's usual output). The exporter reports an
empty `mesh` entry for results that have no mesh; ignore it.

| Case | Blender result |
|---|---|
| `gs-join-order` | 10 vertices; the 3×2 grid's 6 vertices, 7 edges, 2 faces first, then the 2×2 grid with every index offset by 6 vertices / 7 edges / 2 faces / 8 corners |
| `gs-join-type-promotion` | `t` FLOAT Point `[3,3,3,3,1.5,1.5,1.5,1.5]` |
| `gs-join-domain-face-point` | `d` FLOAT **Point** `[4,4,4,4,9,9,9,9]` |
| `gs-join-domain-face-corner` | `d` FLOAT **Face Corner** `[4,4,4,4,9,9,9,9]` |
| `gs-join-missing-fill` | `fa` `[2.5×4, 0×4]`; `col` (0.5,0.5,0.5,0.5)×4 then (0,0,0,0)×4; `q` Euler(0.1,0.2,0.3) then identity (1,0,0,0); `m` translation (1,2,3) then **all-zero** matrices |
| `gs-join-pointcloud-radius` | 6 points, `radius` `[0.2, 0.2, 0.01, 0.01, 0.01, 0.01]` |
| `gs-join-curves-radius-resolution` | 2 curves, 6 points; `radius` `[0.5,0.5,1,1,1,1]`; `resolution` `[3, 12]`; `cyclic` `[false, true]` |
| `gs-join-empty-mesh` | the 2×2 grid only; no `only_on_empty` attribute |
| `gs-join-instance-references` | 12 instances, **2** references; `.reference_index` `[0×8, 1×4]` |
| `gs-join-volumes` | the grid only, no volume component |
| `gs-join-muted` | the 3×2 grid only (the first input) |

```json
[
  {
    "id": "gs-join-order",
    "description": "Join of Grid 3x2 and Grid 2x2; links into a multi-input are connected in list order, the last connected comes first, so the 3x2 grid is first",
    "tree": {
      "nodes": [
        {"name": "a", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 3, "Vertices Y": 2}},
        {"name": "b", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["b", "Mesh"], "to": ["join", "Geometry"]},
        {"from": ["a", "Mesh"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "gs-join-type-promotion",
    "description": "t is INT on the first grid and FLOAT on the second: joined t is FLOAT",
    "tree": {
      "nodes": [
        {"name": "a", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "sa", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "t", "Value": 3}},
        {"name": "b", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "sb", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "t", "Value": 1.5}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["a", "Mesh"], "to": ["sa", "Geometry"]},
        {"from": ["b", "Mesh"], "to": ["sb", "Geometry"]},
        {"from": ["sb", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["sa", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "gs-join-domain-face-point",
    "description": "d on Face of the first grid and on Point of the second: joined d is on Point",
    "tree": {
      "nodes": [
        {"name": "a", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "sa", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "FACE"}, "inputs": {"Name": "d", "Value": 4.0}},
        {"name": "b", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "sb", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "d", "Value": 9.0}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["a", "Mesh"], "to": ["sa", "Geometry"]},
        {"from": ["b", "Mesh"], "to": ["sb", "Geometry"]},
        {"from": ["sb", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["sa", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "gs-join-domain-face-corner",
    "description": "d on Face of the first grid and on Face Corner of the second: joined d is on Face Corner",
    "tree": {
      "nodes": [
        {"name": "a", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "sa", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "FACE"}, "inputs": {"Name": "d", "Value": 4.0}},
        {"name": "b", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "sb", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "CORNER"}, "inputs": {"Name": "d", "Value": 9.0}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["a", "Mesh"], "to": ["sa", "Geometry"]},
        {"from": ["b", "Mesh"], "to": ["sb", "Geometry"]},
        {"from": ["sb", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["sa", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "gs-join-missing-fill",
    "description": "Attributes present only on the first grid: the second grid gets 0, (0,0,0,0) colour, identity rotation and an all-zero matrix",
    "tree": {
      "nodes": [
        {"name": "a", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "s1", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "fa", "Value": 2.5}},
        {"name": "s2", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "POINT"}, "inputs": {"Name": "col", "Value": [0.5, 0.5, 0.5, 0.5]}},
        {"name": "rot", "type": "FunctionNodeEulerToRotation", "inputs": {"Euler": [0.1, 0.2, 0.3]}},
        {"name": "s3", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "QUATERNION", "domain": "POINT"}, "inputs": {"Name": "q"}},
        {"name": "mat", "type": "FunctionNodeCombineTransform", "inputs": {"Translation": [1, 2, 3]}},
        {"name": "s4", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT4X4", "domain": "POINT"}, "inputs": {"Name": "m"}},
        {"name": "b", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["a", "Mesh"], "to": ["s1", "Geometry"]},
        {"from": ["s1", "Geometry"], "to": ["s2", "Geometry"]},
        {"from": ["s2", "Geometry"], "to": ["s3", "Geometry"]},
        {"from": ["rot", "Rotation"], "to": ["s3", "Value"]},
        {"from": ["s3", "Geometry"], "to": ["s4", "Geometry"]},
        {"from": ["mat", "Transform"], "to": ["s4", "Value"]},
        {"from": ["b", "Mesh"], "to": ["join", "Geometry"]},
        {"from": ["s4", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "gs-join-pointcloud-radius",
    "description": "Point cloud without radius joined after one with radius 0.2: the missing radius is 0.01",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 2, "Radius": 0.2}},
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "m2p", "type": "GeometryNodeMeshToPoints"},
        {"name": "rm", "type": "GeometryNodeRemoveAttribute", "inputs": {"Name": "radius"}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["m2p", "Mesh"]},
        {"from": ["m2p", "Points"], "to": ["rm", "Geometry"]},
        {"from": ["rm", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["p", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "gs-join-curves-radius-resolution",
    "description": "Curve Line with radius 0.5 and resolution 3 joined with a Curve Circle without radius and resolution: fills 1.0 and 12",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeCurvePrimitiveLine"},
        {"name": "rad", "type": "GeometryNodeSetCurveRadius", "inputs": {"Radius": 0.5}},
        {"name": "res", "type": "GeometryNodeSetSplineResolution", "inputs": {"Resolution": 3}},
        {"name": "circle", "type": "GeometryNodeCurvePrimitiveCircle", "inputs": {"Resolution": 4}},
        {"name": "rm1", "type": "GeometryNodeRemoveAttribute", "inputs": {"Name": "radius"}},
        {"name": "rm2", "type": "GeometryNodeRemoveAttribute", "inputs": {"Name": "resolution"}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["line", "Curve"], "to": ["rad", "Curve"]},
        {"from": ["rad", "Curve"], "to": ["res", "Geometry"]},
        {"from": ["circle", "Curve"], "to": ["rm1", "Geometry"]},
        {"from": ["rm1", "Geometry"], "to": ["rm2", "Geometry"]},
        {"from": ["rm2", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["res", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "gs-join-empty-mesh",
    "description": "A 2x2 grid joined with a grid of zero vertices that carries only_on_empty: the result is the 2x2 grid without only_on_empty",
    "tree": {
      "nodes": [
        {"name": "a", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "e", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 0, "Vertices Y": 0}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "only_on_empty", "Value": 1.0}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["e", "Mesh"], "to": ["s", "Geometry"]},
        {"from": ["s", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["a", "Mesh"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "gs-join-instance-references",
    "description": "The same Cube instanced on two grids and a second Cube on a third: after the join there are two references",
    "tree": {
      "nodes": [
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "cube2", "type": "GeometryNodeMeshCube", "inputs": {"Size": [0.5, 0.5, 0.5]}},
        {"name": "g1", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "g2", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "g3", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "i1", "type": "GeometryNodeInstanceOnPoints"},
        {"name": "i2", "type": "GeometryNodeInstanceOnPoints"},
        {"name": "i3", "type": "GeometryNodeInstanceOnPoints"},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["g1", "Mesh"], "to": ["i1", "Points"]},
        {"from": ["g2", "Mesh"], "to": ["i2", "Points"]},
        {"from": ["g3", "Mesh"], "to": ["i3", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["i1", "Instance"]},
        {"from": ["cube", "Mesh"], "to": ["i2", "Instance"]},
        {"from": ["cube2", "Mesh"], "to": ["i3", "Instance"]},
        {"from": ["i3", "Instances"], "to": ["join", "Geometry"]},
        {"from": ["i2", "Instances"], "to": ["join", "Geometry"]},
        {"from": ["i1", "Instances"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "gs-join-volumes",
    "description": "Two volumes and a grid: the result has the grid and no volume",
    "tree": {
      "nodes": [
        {"name": "v1", "type": "GeometryNodeVolumeCube"},
        {"name": "v2", "type": "GeometryNodeVolumeCube"},
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["join", "Geometry"]},
        {"from": ["v2", "Volume"], "to": ["join", "Geometry"]},
        {"from": ["v1", "Volume"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "gs-join-muted",
    "description": "Muted Join Geometry passes only its first (last connected) input",
    "tree": {
      "nodes": [
        {"name": "a", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 3, "Vertices Y": 2}},
        {"name": "b", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "join", "type": "GeometryNodeJoinGeometry", "properties": {"mute": true}}
      ],
      "links": [
        {"from": ["b", "Mesh"], "to": ["join", "Geometry"]},
        {"from": ["a", "Mesh"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  }
]
```

Proposed cases that the current case runner cannot build yet (it has no way to create materials or
to set per-curve values without extra nodes); they need a runner extension or a hand-made `.blend`:

- **gs-join-materials** — Cube with Set Material `M1`; Cube with Set Material `M2` on faces 0–2 and
  `M1` on the rest; Grid without material; joined in that order. Expect material list
  `[M1, M2, none]` and remapped `material_index`.
- **gs-join-single-material-drops-index** — two Cubes with Set Material `M1`, one also with Set
  Material Index 3. Expect no `material_index` attribute on the result.
- **gs-join-material-index-out-of-range** — Cube with materials `[M1, M2]` and Set Material Index 7
  (single value) joined with Cube with `[M2]`; then the same with per-face indices `[0,7,…]`. Pins the
  two out-of-range outcomes.
- **gs-join-fill-id** — two curve sets with `fill_id` `[5,5,0,9]` and `[9,0]`; expect
  `[1,1,0,2,3,0]`.
