# Instance on Points (`GeometryNodeInstanceOnPoints`)

Places a reference to the `Instance` geometry (or to one of its top-level instances) at every
selected point of the `Points` geometry. The output contains only instances: the point geometry
itself is consumed.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Points` | geometry | | mesh, point cloud, curves and Grease Pencil components are used as points |
| in | `Selection` | bool field | true | evaluated on the Point domain of each component |
| in | `Instance` | geometry | | what is referenced |
| in | `Pick Instance` | bool field | false | per point: pick one top-level instance of `Instance` instead of the whole geometry |
| in | `Instance Index` | int field | implicit **Index** field | which instance to pick; only read where Pick Instance is true |
| in | `Rotation` | rotation field (quaternion) | identity | a linked vector is converted as XYZ Euler |
| in | `Scale` | vector field | (1, 1, 1) | |
| out | `Instances` | geometry | | |

No properties. All fields are evaluated on the **Point** domain of the component being processed
(mesh vertices, point-cloud points, curve **control points**, Grease Pencil stroke points of one
layer).

## Which parts of `Points` are used

1. The node visits the top-level geometry and, recursively, **every geometry nested inside
   instances** of `Points` (object and collection references are first converted to their geometry).
   Each visited geometry is processed independently, exactly as a top-level one.
2. Within one visited geometry, instances are created from its components in this order:
   **mesh, point cloud, curves, Grease Pencil**. Volumes and existing instances are not points.
3. The instances created from those components are concatenated in that order into one instance
   list. The visited geometry then keeps only its edit data, its **existing instances first**, followed
   by the new instances. Its mesh, point cloud, curves, Grease Pencil and volume components are
   removed.

So for a `Points` input that is itself instances of a mesh, the output keeps the outer instances
unchanged and, inside each referenced geometry, replaces the mesh by instances placed on its
vertices. The positions of the outer instances are never used as points.

## One component -> instances

For a mesh, point cloud or curves component with `n` points:

- Evaluate `Selection`; the selected point indices in increasing order become instances
  `0 .. k-1`. If nothing is selected, the component contributes nothing.
- Instance `j` (from point `i`) gets the transform
  `T(position[i]) * R(Rotation[i]) * S(Scale[i])`, i.e. scale first, then rotate, then translate to
  the point position.
- Its reference:
  - Pick Instance false at point `i`: the whole `Instance` geometry (all its components, including
    its own instances). An empty `Instance` still yields an instance, referencing empty geometry.
  - Pick Instance true at point `i`: let `m` be the number of top-level instances in `Instance`.
    `index = Instance Index[i]` wrapped with a **floored** modulo into `[0, max(m, 1))`, so `-1` picks
    the last instance, `m` picks the first. If `m == 0` (no instances in `Instance`) the instance
    references **nothing** (an empty reference) but still exists. Otherwise it references the same
    thing as instance `index` of `Instance`, and its transform becomes
    `T(position) * R(rotation) * S(scale) * transform_of_picked_instance`. The picked instance's
    attributes are **not** copied.
  - With Pick Instance true (as a single value), the non-instance components of `Instance` are
    ignored and the node reports an info message "Realized geometry is not used when pick instances
    is true".

### Attribute propagation from points to instances

Every attribute of the point component is copied to the Instance domain of the new instances, taking
only the selected points, in selection order, with these rules:

- Attributes on other domains (mesh edge, face, corner; curve domain) are first interpolated to the
  Point domain with Blender's standard domain adaptation (averaging; booleans use the adaptation's
  own rule), then copied.
- `position` is not copied (it becomes the instance translation).
- Built-in attributes of the source are skipped unless they are also built-in on instances (none are),
  so these never propagate: mesh `material_index`, `sharp_face`, `sharp_edge`; point cloud `radius`;
  curves `radius`, `tilt`, `handle_left`, `handle_right`, `handle_type_left`, `handle_type_right`,
  `nurbs_weight`, `nurbs_order`, `normal_mode`, `custom_normal`, `knots_mode`, `curve_type`,
  `resolution`, `cyclic`, `material_index`.
- Generic attributes keep their name, data type and values. This includes an `id` attribute, UV maps
  (averaged to points) and vertex groups exposed as float attributes.
- Unlike Realize Instances and Join Geometry, this path does not filter out string attributes. Whether
  a string point attribute actually survives onto instances is not pinned; see the open questions in
  `../README.md`.

### Grease Pencil

For a Grease Pencil component the result is **nested**: one outer instance per layer.

- Layers are visited in layer order. A layer without an evaluated drawing is skipped entirely (no
  outer instance).
- A layer whose drawing has no strokes gets an outer instance with an **empty reference**, so the
  layer count and the instance count stay aligned.
- Otherwise the points of that layer's drawing are turned into instances as above (fields evaluated
  in the layer's point context, positions in layer-local space). If the selection selects no point of
  that layer, **no outer instance is added for it** (the alignment is lost).
- The outer instance for a layer references a geometry holding those inner instances, and its
  transform is the layer's local transform.
- Point and stroke attributes of the drawing are **not** propagated to the inner instances.
- Layer-domain attributes of the Grease Pencil are copied to the Instance domain of the outer
  instances.

## Output order and references

- Instances order: per visited geometry, existing instances first, then mesh-derived, point-cloud,
  curves, Grease Pencil in that order; inside each, the selected point order.
- Reference list (visible through `.reference_index` and the Python API): when Pick Instance may be
  true anywhere, the references of `Instance`'s own instances come first in their original order,
  then the whole-`Instance` reference, then the empty reference (identical references are shared).
  Afterwards, references no instance uses are removed, keeping the relative order of the rest.

## Edge cases

- `Points` without any usable component and without instances: the output is empty.
- Zero selected points: that component contributes no instances.
- A `Points` input that already contains instances but no real geometry at top level: the top-level
  instances pass through unchanged, and nested real geometry is processed.

## Reference cases

```json
[
  {
    "id": "iop-line-cubes",
    "description": "Cubes on the three vertices of a mesh line, default rotation and scale",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 3, "Offset": [1, 0, 0] } },
        { "name": "cube", "type": "GeometryNodeMeshCube", "inputs": { "Size": [0.2, 0.2, 0.2] } },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] }
      ],
      "output": ["iop", "Instances"]
    }
  },
  {
    "id": "iop-selection-rot-scale",
    "description": "Selection Index >= 1, rotation 90 degrees about Z, scale (2,1,1): transform order T*R*S",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 3, "Offset": [1, 0, 0] } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "idx", "type": "GeometryNodeInputIndex" },
        { "name": "cmp", "type": "FunctionNodeCompare", "properties": { "data_type": "INT", "operation": "GREATER_EQUAL" }, "inputs": { "B": 1 } },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints", "inputs": { "Rotation": [0, 0, 1.5707964], "Scale": [2, 1, 1] } }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] },
        { "from": ["idx", "Index"], "to": ["cmp", "A"] },
        { "from": ["cmp", "Result"], "to": ["iop", "Selection"] }
      ],
      "output": ["iop", "Instances"]
    }
  },
  {
    "id": "iop-attribute-propagation",
    "description": "Point cloud with radius and a generic float: generic float reaches instances, radius does not",
    "tree": {
      "nodes": [
        { "name": "pts", "type": "GeometryNodePoints", "inputs": { "Count": 2, "Radius": 0.3 } },
        { "name": "idx", "type": "GeometryNodeInputIndex" },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "INT", "domain": "POINT" }, "inputs": { "Name": "foo" } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" }
      ],
      "links": [
        { "from": ["pts", "Geometry"], "to": ["store", "Geometry"] },
        { "from": ["idx", "Index"], "to": ["store", "Value"] },
        { "from": ["store", "Geometry"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] }
      ],
      "output": ["iop", "Instances"]
    }
  },
  {
    "id": "iop-face-attribute-to-instances",
    "description": "Face attribute on a 3x3 grid is averaged to vertices and copied to the 9 instances",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 3, "Vertices Y": 3 } },
        { "name": "idx", "type": "GeometryNodeInputIndex" },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "FACE" }, "inputs": { "Name": "f" } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["store", "Geometry"] },
        { "from": ["idx", "Index"], "to": ["store", "Value"] },
        { "from": ["store", "Geometry"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] }
      ],
      "output": ["iop", "Instances"]
    }
  },
  {
    "id": "iop-pick-wrap",
    "description": "Pick Instance with Instance Index = Index - 1 over 5 points and 3 source instances: -1 wraps to the last",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 5, "Offset": [1, 0, 0] } },
        { "name": "src_line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 3, "Offset": [0, 0, 10] } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "src", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "src_idx", "type": "GeometryNodeInputIndex" },
        { "name": "src_scale", "type": "ShaderNodeMath", "properties": { "operation": "ADD" }, "inputs": { "Value_001": 1 } },
        { "name": "idx", "type": "GeometryNodeInputIndex" },
        { "name": "minus", "type": "FunctionNodeIntegerMath", "properties": { "operation": "SUBTRACT" }, "inputs": { "Value_001": 1 } },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints", "inputs": { "Pick Instance": true } }
      ],
      "links": [
        { "from": ["src_line", "Mesh"], "to": ["src", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["src", "Instance"] },
        { "from": ["src_idx", "Index"], "to": ["src_scale", "Value"] },
        { "from": ["src_scale", "Value"], "to": ["src", "Scale"] },
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["src", "Instances"], "to": ["iop", "Instance"] },
        { "from": ["idx", "Index"], "to": ["minus", "Value"] },
        { "from": ["minus", "Value"], "to": ["iop", "Instance Index"] }
      ],
      "output": ["iop", "Instances"]
    }
  },
  {
    "id": "iop-pick-without-instances",
    "description": "Pick Instance true but Instance holds only a mesh: every instance has an empty reference",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2 } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints", "inputs": { "Pick Instance": true } }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] }
      ],
      "output": ["iop", "Instances"]
    }
  },
  {
    "id": "iop-component-order",
    "description": "Points = join of a 2-vertex mesh line and a 1-point cloud: mesh-derived instances come first",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [1, 0, 0] } },
        { "name": "pts", "type": "GeometryNodePoints", "inputs": { "Count": 1, "Position": [0, 5, 0] } },
        { "name": "join", "type": "GeometryNodeJoinGeometry" },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" }
      ],
      "links": [
        { "from": ["pts", "Geometry"], "to": ["join", "Geometry"] },
        { "from": ["line", "Mesh"], "to": ["join", "Geometry"] },
        { "from": ["join", "Geometry"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] }
      ],
      "output": ["iop", "Instances"]
    }
  },
  {
    "id": "iop-points-inside-instances",
    "description": "Points input is an instance of a 2-vertex mesh line translated by (0,0,3): the outer instance is kept, its mesh becomes 2 cube instances",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [1, 0, 0] } },
        { "name": "g2i", "type": "GeometryNodeGeometryToInstance" },
        { "name": "move", "type": "GeometryNodeTranslateInstances", "inputs": { "Translation": [0, 0, 3] } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["g2i", "Geometry"] },
        { "from": ["g2i", "Instances"], "to": ["move", "Instances"] },
        { "from": ["move", "Instances"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] }
      ],
      "output": ["iop", "Instances"]
    }
  },
  {
    "id": "iop-empty-instance",
    "description": "Nothing linked to Instance: 3 instances referencing empty geometry",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 3 } },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" }
      ],
      "links": [{ "from": ["line", "Mesh"], "to": ["iop", "Points"] }],
      "output": ["iop", "Instances"]
    }
  }
]
```

Expected for `iop-pick-wrap`: points 0..4 pick source instances 2, 0, 1, 2, 0 (scales 3, 1, 2, 3, 1),
and each final transform is `T(point) * source_transform`, so point 0 ends at (0, 0, 20).

`iop-component-order` relies on the Join Geometry multi-input order (last linked first, see that
spec); the joined geometry has both a mesh and a point cloud regardless, and the mesh-derived
instances (x = 0, 1) come before the point-cloud one (y = 5).
