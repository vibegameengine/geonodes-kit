# Realize Instances (`GeometryNodeRealizeInstances`)

Turns instances into real geometry: every instanced mesh, point cloud, curves and Grease Pencil is
copied, transformed and merged with the top-level geometry of the same type. Selected instances can
be realized only down to a given nesting depth.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Geometry` | geometry | | |
| in | `Selection` | bool field | true | Instance domain of the **top-level** instances |
| in | `Realize All` | bool field | true | per top-level instance; overrides Depth |
| in | `Depth` | int field | 0 | per top-level instance; negative values count as 0 |
| out | `Geometry` | geometry | | |

## Properties

| Property | Type | Default on a new node | Meaning |
|---|---|---|---|
| `realize_to_point_domain` | bool | **false** | Where instance attributes land on realized **curves**: false = Curve domain, true = Point domain. Files saved with 5.0 or earlier load with it enabled (compatibility). Meshes and point clouds always use the Point domain; Grease Pencil always the Layer domain. |

## Top-level control

- Without an instances component the input is returned unchanged.
- Per top-level instance `i`: `depth_i = Realize All ? unlimited : max(Depth, 0)`.
  `realized_i = Selection[i] and depth_i != 0`. So `Realize All = false` with `Depth = 0` realizes
  nothing for that instance.
- Fields are evaluated on the top-level Instance domain.
- `depth_i = d` realizes the instance and `d - 1` further levels below it. At the level where the
  depth is used up, instance components found inside the referenced geometry are **kept as
  instances**, with their transforms pre-multiplied by the accumulated parent transform.

## Traversal and element order

Realization walks the geometry depth-first, starting at the top level with the identity transform
and a context id of 0. At each geometry set it visits the components **in this fixed order: mesh,
point cloud, instances, volume, curves, edit data, Grease Pencil**. When it meets the instances
component, it walks the (selected, at top level) instances in index order and, for each, recurses into
its referenced geometry with transform `parent * instance_transform`.

Each output type is concatenated in visiting order. Because instances are visited between point
clouds and curves:

- **Mesh and point cloud**: the top-level mesh / point cloud comes **first**, then the realized
  instances in instance order.
- **Curves and Grease Pencil**: the realized instances come **first**, then the top-level curves /
  Grease Pencil **last**.
- The same rule applies at every nesting level.

A reference to an object is realized from the object's evaluated geometry (local space). A reference
to a collection is realized as described in the Collection Info spec (child collections first in
collection order, then objects in collection order, with the instance-offset transforms). Empty
references produce nothing. Components with zero points (mesh with 0 vertices, point cloud with 0
points, curves with 0 curves, Grease Pencil with 0 layers) produce nothing.

### Output instances (partial realization)

The output instances component, if any, lists in this order:

1. Top-level instances that are **not** realized (unselected or depth 0), in their original order,
   with their own attributes.
2. Nested instance components where the depth ran out, in traversal order, each instance's transform
   pre-multiplied by the accumulated parent transform.

References are merged (identical references shared). Attributes: see below.

### Volumes

Only the **first volume** met in the traversal is kept, **without transform**, and every other volume
is dropped. Because instances are visited before the volume component, a volume inside an instance
wins over a top-level volume.

## Merging per type

### Single-source shortcut

If exactly one mesh (resp. point cloud, curves, Grease Pencil) is met in total, it is copied as a
whole (every attribute, on its original domain and type, including `id` **unchanged**) and
transformed as by Transform Geometry in Matrix mode (skipped when the transform is identity within
1e-6 per entry). Instance attributes are then added as **constant** attributes, only for names the
copy does not already have. The general rules below apply only when there are two or more sources.

### Mesh

- Vertices, edges, faces, corners are concatenated per source in traversal order; edge vertex indices,
  corner vertex / edge indices and face offsets are shifted by the running totals. Topology order
  within a source is unchanged.
- Positions are transformed by the accumulated transform.
- **Custom normals**: if no source has `custom_normal`, the result has none. If some source has
  corner-fan custom normals (int16 2D on corners) and no source has free normals, the result has
  corner-fan normals and sources without them get (0, 0) ("use automatic normal"). If any source has
  free (float3) custom normals, the result stores free normals on one domain: the common normal
  domain of all sources, or the Corner domain when sources disagree; every source contributes its
  evaluated normals on that domain transformed by the inverse transpose of its transform. Float3
  custom normals stored on the Edge domain are ignored.
- **Materials**: the result's material slots are the union of the sources' slots in order of first
  appearance (sources in first-appearance order over the *whole* input, including instances that are
  not realized). A source without material slots contributes one empty slot. `material_index` is
  remapped per source to the union's slots; indices outside a source's slot range map to 0. If the
  union has at most one slot, the result has no `material_index` attribute (all faces use slot 0).
- Vertex group names are merged, first mesh's groups first.
- The result takes mesh parameters (e.g. auto-smooth-style settings, texture space) from the first
  mesh in traversal order.
- The active/default UV map of the result is set from the attributes when not already defined.

### Point cloud

Points concatenated; positions transformed. `radius` is created when any source has one; sources
without it get **0.01**. Materials are taken from the first point cloud only.

### Curves

Curves and points concatenated; offsets shifted; custom NURBS knots concatenated. Positions and
`handle_left`/`handle_right` are transformed (sources without handles get (0,0,0)). `custom_normal`
(if any source has it) is transformed like mesh normals; sources without it get (0, 0, 1). `radius`
is created when any source has one; missing radius is **1.0**. Other built-in curve attributes
missing from a source (`resolution`, `cyclic`, `curve_type`, `nurbs_order`, `nurbs_weight`, `tilt`,
...) get the built-in default of the curves type. `fill_id` (int on the Curve domain) is renumbered:
per source, its distinct non-zero fill ids in first-appearance order become `offset + 1, offset + 2,
...` where `offset` is the running count of distinct fill ids of earlier sources; zero stays zero.
Parameters are taken from the first curves.

### Grease Pencil

Layers are concatenated (each source contributes all its layers, names kept, duplicates allowed); each
layer's local transform becomes `transform * layer_transform`; stroke geometry is copied unchanged.
Materials: union in first-appearance order; stroke `material_index` values inside a source's range are
remapped, others are left as they are. Instance attributes land on the Layer domain.

## Attributes

For each output type the set of attributes is gathered from every component that will be realized
of that type **and** from every instances component on the way (instance attributes), with these
rules:

- Names skipped: strings (never propagated), `instance_transform`, `.reference_index`; and built-in
  attributes of one component type that are not built-in on the destination type.
- Handled specially (not as generic attributes): mesh `position`, `.edge_verts`, `.corner_vert`,
  `.corner_edge`, `custom_normal`, `material_index`, `id`; point cloud `position`, `radius`, `id`;
  curves `position`, `radius`, `handle_left`, `handle_right`, `custom_normal`, `id`, `fill_id`.
- Instance-domain attributes map to Point (mesh, point cloud; curves when
  `realize_to_point_domain`), Curve (curves otherwise), Layer (Grease Pencil).
- When a name occurs with several domains the result uses the one with the **highest priority**:
  Corner > Point > Edge > Face > Curve > Layer > Instance. When it occurs with several types the result
  uses the **most complex**: bool < int8 < int32 < float < int16-2D < int32-2D < float2 < float3 <
  float4 < byte colour < quaternion < float colour < float4x4. Values are converted implicitly and
  interpolated to the chosen domain.

Values for each source element:

1. If the source geometry itself has the attribute, its values (interpolated/converted) are used.
2. Otherwise the value of the **innermost** enclosing instance that has the attribute (a nested
   instance's value overrides its parent's), constant over the whole source.
3. Otherwise the type's default (zero / false / identity quaternion / zero colour), or for curves the
   built-in default.

So instance attributes never override attributes the geometry already has.

### `id`

- If any realized component (mesh, point cloud, curves), or any instances component on the way, has an
  `id` attribute, the output mesh / point cloud / curves get an int point-domain `id`.
- Each instance gets an id `h = hash2(parent_id, local)` where `local` is the instance's own `id`
  attribute value if the instances component has an int `id` on the Instance domain, otherwise the
  instance index; `parent_id` is 0 at the top level.
- Each element gets `hash2(h, element_id)` where `element_id` is the source's point-domain int `id` if
  present, otherwise the element (vertex / point) index. Top-level (non-instanced) geometry uses
  `h = 0`.
- `hash2(kx, ky)` is Bob Jenkins' public-domain *lookup3* word hash for two 32-bit words: set
  `a = b = c = 0xdeadbeef + (2 << 2) + 13`, then `a += kx`, `b += ky`, apply lookup3's `final(a, b, c)`
  mix (rotations 14, 11, 25, 16, 4, 14, 24), return `c` (as a signed 32-bit int in the attribute).
- The single-source shortcut does **not** rehash: ids are copied as they are.
- In the output instances component (partial realization) the `id` attribute of instances is **not**
  carried over.

### Attributes of the output instances

Gathered from the instances components met up to the depth limit (strings, `id`,
`instance_transform`, `.reference_index` excluded). Per output instance: its own component's value, or
the innermost enclosing instance's value, or the default.

## Errors

If a merged count exceeds 2^31 - 1 elements the type is dropped and an error is shown ("Realized mesh
has too many elements." and similar).

## Reference cases

```json
[
  {
    "id": "realize-mesh-order",
    "description": "Top-level grid joined with two instanced cubes: grid vertices first, then cube 0, cube 1",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 2, "Vertices Y": 2 } },
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [5, 0, 0] } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "join", "type": "GeometryNodeJoinGeometry" },
        { "name": "real", "type": "GeometryNodeRealizeInstances" }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] },
        { "from": ["iop", "Instances"], "to": ["join", "Geometry"] },
        { "from": ["grid", "Mesh"], "to": ["join", "Geometry"] },
        { "from": ["join", "Geometry"], "to": ["real", "Geometry"] }
      ],
      "output": ["real", "Geometry"]
    }
  },
  {
    "id": "realize-curves-order",
    "description": "Top-level curve line plus two instanced curve lines: the instanced curves come first, the top-level curve last",
    "tree": {
      "nodes": [
        { "name": "top", "type": "GeometryNodeCurvePrimitiveLine", "inputs": { "End": [0, 0, 9] } },
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [5, 0, 0] } },
        { "name": "c", "type": "GeometryNodeCurvePrimitiveLine" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "join", "type": "GeometryNodeJoinGeometry" },
        { "name": "real", "type": "GeometryNodeRealizeInstances" }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["c", "Curve"], "to": ["iop", "Instance"] },
        { "from": ["iop", "Instances"], "to": ["join", "Geometry"] },
        { "from": ["top", "Curve"], "to": ["join", "Geometry"] },
        { "from": ["join", "Geometry"], "to": ["real", "Geometry"] }
      ],
      "output": ["real", "Geometry"]
    }
  },
  {
    "id": "realize-instance-attr-mesh",
    "description": "Instance attribute foo (float, = instance index) lands on the Point domain of the realized cubes",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [5, 0, 0] } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "idx", "type": "GeometryNodeInputIndex" },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "INSTANCE" }, "inputs": { "Name": "foo" } },
        { "name": "real", "type": "GeometryNodeRealizeInstances" }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] },
        { "from": ["iop", "Instances"], "to": ["store", "Geometry"] },
        { "from": ["idx", "Index"], "to": ["store", "Value"] },
        { "from": ["store", "Geometry"], "to": ["real", "Geometry"] }
      ],
      "output": ["real", "Geometry"]
    }
  },
  {
    "id": "realize-instance-attr-curves-domain",
    "description": "Same instance attribute on instanced curve lines, new node (realize_to_point_domain false): foo on the Curve domain",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [5, 0, 0] } },
        { "name": "c", "type": "GeometryNodeCurvePrimitiveLine" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "idx", "type": "GeometryNodeInputIndex" },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "INSTANCE" }, "inputs": { "Name": "foo" } },
        { "name": "real", "type": "GeometryNodeRealizeInstances" }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["c", "Curve"], "to": ["iop", "Instance"] },
        { "from": ["iop", "Instances"], "to": ["store", "Geometry"] },
        { "from": ["idx", "Index"], "to": ["store", "Value"] },
        { "from": ["store", "Geometry"], "to": ["real", "Geometry"] }
      ],
      "output": ["real", "Geometry"]
    }
  },
  {
    "id": "realize-depth-one",
    "description": "Instances of instances of a cube; Realize All false, Depth 1: output keeps the inner instances with composed transforms",
    "tree": {
      "nodes": [
        { "name": "inner_pts", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [1, 0, 0] } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "inner", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "outer_pts", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [0, 10, 0] } },
        { "name": "outer", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "real", "type": "GeometryNodeRealizeInstances", "inputs": { "Realize All": false, "Depth": 1 } }
      ],
      "links": [
        { "from": ["inner_pts", "Mesh"], "to": ["inner", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["inner", "Instance"] },
        { "from": ["outer_pts", "Mesh"], "to": ["outer", "Points"] },
        { "from": ["inner", "Instances"], "to": ["outer", "Instance"] },
        { "from": ["outer", "Instances"], "to": ["real", "Geometry"] }
      ],
      "output": ["real", "Geometry"]
    }
  },
  {
    "id": "realize-selection-kept-first",
    "description": "Selection = Index == 1 over two cube instances: instance 0 stays an instance, instance 1 becomes mesh",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [5, 0, 0] } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "idx", "type": "GeometryNodeInputIndex" },
        { "name": "cmp", "type": "FunctionNodeCompare", "properties": { "data_type": "INT", "operation": "EQUAL" }, "inputs": { "B": 1 } },
        { "name": "real", "type": "GeometryNodeRealizeInstances" }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] },
        { "from": ["idx", "Index"], "to": ["cmp", "A"] },
        { "from": ["cmp", "Result"], "to": ["real", "Selection"] },
        { "from": ["iop", "Instances"], "to": ["real", "Geometry"] }
      ],
      "output": ["real", "Geometry"]
    }
  },
  {
    "id": "realize-id-hash",
    "description": "Two instanced 2-vertex lines, instance id attribute 7 and 9: vertex ids are hash2(hash2(0, id), vertex_index)",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [5, 0, 0] } },
        { "name": "small", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [0, 1, 0] } },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "idx", "type": "GeometryNodeInputIndex" },
        { "name": "mul", "type": "FunctionNodeIntegerMath", "properties": { "operation": "MULTIPLY_ADD" }, "inputs": { "Value_001": 2, "Value_002": 7 } },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "INT", "domain": "INSTANCE" }, "inputs": { "Name": "id" } },
        { "name": "real", "type": "GeometryNodeRealizeInstances" }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["small", "Mesh"], "to": ["iop", "Instance"] },
        { "from": ["iop", "Instances"], "to": ["store", "Geometry"] },
        { "from": ["idx", "Index"], "to": ["mul", "Value"] },
        { "from": ["mul", "Value"], "to": ["store", "Value"] },
        { "from": ["store", "Geometry"], "to": ["real", "Geometry"] }
      ],
      "output": ["real", "Geometry"]
    }
  },
  {
    "id": "realize-attr-conflict",
    "description": "Instance attribute foo INT on instances and foo FLOAT on the faces of the cube: result foo is FLOAT on the Point domain, cube face values interpolated to points",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [5, 0, 0] } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "fidx", "type": "GeometryNodeInputIndex" },
        { "name": "fstore", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "FACE" }, "inputs": { "Name": "foo" } },
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 2, "Vertices Y": 2 } },
        { "name": "g2i", "type": "GeometryNodeGeometryToInstance" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "join", "type": "GeometryNodeJoinGeometry" },
        { "name": "istore", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "INT", "domain": "INSTANCE" }, "inputs": { "Name": "foo", "Value": 5 } },
        { "name": "real", "type": "GeometryNodeRealizeInstances" }
      ],
      "links": [
        { "from": ["cube", "Mesh"], "to": ["fstore", "Geometry"] },
        { "from": ["fidx", "Index"], "to": ["fstore", "Value"] },
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["fstore", "Geometry"], "to": ["iop", "Instance"] },
        { "from": ["grid", "Mesh"], "to": ["g2i", "Geometry"] },
        { "from": ["g2i", "Instances"], "to": ["join", "Geometry"] },
        { "from": ["iop", "Instances"], "to": ["join", "Geometry"] },
        { "from": ["join", "Geometry"], "to": ["istore", "Geometry"] },
        { "from": ["istore", "Geometry"], "to": ["real", "Geometry"] }
      ],
      "output": ["real", "Geometry"]
    }
  }
]
```

Expected highlights:

- `realize-mesh-order`: 4 grid vertices first, then 8 + 8 cube vertices (the join order does not
  matter here because the top-level mesh always precedes instance meshes).
- `realize-curves-order`: curves 0 and 1 are the instanced lines (at x = 0 and x = 5), curve 2 is the
  top-level line ending at (0,0,9).
- `realize-instance-attr-mesh`: `foo` is a float Point attribute, 0 on the first 8 vertices, 1 on the
  next 8.
- `realize-instance-attr-curves-domain`: `foo` on the Curve domain with values 0, 1; with
  `realize_to_point_domain = true` it would be on the Point domain (0, 0, 1, 1).
- `realize-depth-one`: no mesh; 4 instances referencing the cube, transforms
  `T(0,0,0)`, `T(1,0,0)`, `T(0,10,0)`, `T(1,10,0)` in that order.
- `realize-selection-kept-first`: a mesh (8 cube vertices at x = 5) plus one instance at x = 0.
- `realize-id-hash`: 4 vertices with `id = hash2(hash2(0, 7), 0)`, `hash2(hash2(0, 7), 1)`,
  `hash2(hash2(0, 9), 0)`, `hash2(hash2(0, 9), 1)`, stored as signed 32-bit ints.
- `realize-attr-conflict`: grid vertices get 5.0 from the grid instance; the cube vertices keep their
  own face `foo` interpolated to points (the instance value 5 does not override).

Additional proposed cases: `realize-single-source-id` (one instanced mesh that has an `id`: ids are
copied unchanged), `realize-volume-first` (Volume Cube top-level plus an instanced Volume Cube: only
one volume, untransformed; needs volume export), `realize-materials` (two meshes with different
materials via Set Material; needs materials, which the `scene` shape cannot declare yet),
`realize-pointcloud-radius-default` (two point clouds where one has no `radius` attribute: its points
get 0.01; needs a way to build a point cloud without `radius`, since Points and Mesh to Points always
write it).
