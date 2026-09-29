# Node specifications

Behaviour specifications for Geometry Nodes of Blender 5.2.2, written by analysts under
[`../../process.md`](../../process.md). Each file describes one node, named by its `idname`, and ends
with reference cases. The `mesh/` folder has its own [README](mesh/README.md).

## Files

### `instances/`

| File | Node |
|---|---|
| [GeometryNodeInstanceOnPoints.md](instances/GeometryNodeInstanceOnPoints.md) | Instance on Points |
| [GeometryNodeCollectionInfo.md](instances/GeometryNodeCollectionInfo.md) | Collection Info |
| [GeometryNodeObjectInfo.md](instances/GeometryNodeObjectInfo.md) | Object Info |
| [GeometryNodeTranslateInstances.md](instances/GeometryNodeTranslateInstances.md) | Translate Instances |
| [GeometryNodeRealizeInstances.md](instances/GeometryNodeRealizeInstances.md) | Realize Instances |
| [GeometryNodeTransform.md](instances/GeometryNodeTransform.md) | Transform Geometry |
| [GeometryNodeJoinGeometry.md](instances/GeometryNodeJoinGeometry.md) | Join Geometry |
| [GeometryNodeSwitch.md](instances/GeometryNodeSwitch.md) | Switch |

### `math/`

| File | Node |
|---|---|
| [ShaderNodeMath.md](math/ShaderNodeMath.md) | Math |
| [FunctionNodeCompare.md](math/FunctionNodeCompare.md) | Compare |
| [FunctionNodeBooleanMath.md](math/FunctionNodeBooleanMath.md) | Boolean Math |
| [ShaderNodeCombineXYZ.md](math/ShaderNodeCombineXYZ.md) | Combine XYZ |
| [ShaderNodeSeparateXYZ.md](math/ShaderNodeSeparateXYZ.md) | Separate XYZ |
| [GeometryNodeInputPosition.md](math/GeometryNodeInputPosition.md) | Position |

## Source areas consulted (analysts only)

Blender tag `v5.2.2`, read outside this repository for the `instances/` and `math/` files:

- `source/blender/nodes/geometry/nodes/`: the node files for Instance on Points, Collection Info,
  Object Info, Translate Instances, Realize Instances, Transform Geometry, Join Geometry, Switch,
  Position.
- `source/blender/nodes/function/nodes/`: Compare, Boolean Math.
- `source/blender/nodes/shader/nodes/`: Math, Separate/Combine XYZ.
- `source/blender/nodes/intern/`: math operation table, socket availability of the Math node, the
  field-capable socket types, multi-input link handling in the lazy-function graph.
- `source/blender/nodes/NOD_socket_declarations.hh`: socket default values.
- `source/blender/functions/`: the registered float math functions and their shortcuts.
- `source/blender/geometry/`: realize instances, join geometries, transform, per-real-geometry
  iteration.
- `source/blender/blenkernel/`: instances and instance references, collection-to-instance
  conversion, collection object cache order, attribute domain and type priority, implicit type
  conversions, attribute field inputs (instance position), mesh / curves transform, custom normal
  join and transform, multi-input link sort index, geometry set component order.
- `source/blender/blenlib/`: safe math helpers, wrap / ping-pong / smooth-min, sign, angle between
  vectors, vector normalization threshold, matrix decomposition, natural string compare, the lookup3
  style hash used for ids.

Not available in the sparse checkout and therefore not verified from source: colour-management luma
coefficients (`imbuf`), object and collection visibility handling in the dependency graph, file
versioning of `realize_to_point_domain`.

## Reference case format

Cases are JSON objects inside ```` ```json ```` fences (one object or an array), read by
`tools/blender/cases.py`:

- `id`, `description`;
- `tree.nodes`: `name`, `type` (idname), optional `properties` (set in listed order, before inputs;
  order matters for Compare, whose `data_type` update can coerce `operation`), optional `inputs`
  keyed by socket **identifier** exactly as in `coverage/nodes-5.2.2.json` (not the label; e.g. the
  Points node's output is `Geometry`, the Math inputs are `Value`, `Value_001`, `Value_002`);
- `tree.links`: `from` = [node, output identifier], `to` = [node, input identifier]. Links are created
  in list order, which fixes the order of multi-input sockets (last created is evaluated first, see
  Join Geometry);
- `tree.output`: [node, output identifier] fed to the group output.

Conventions used here:

- Sockets that exist only for some property values (Compare `C`, `Angle`, `Epsilon`; Math
  `Value_002`; the typed Switch sockets) use the identifiers they get when those properties are set.
- A menu socket (Transform Geometry `Mode`) is set by item name, as the inventory prints it
  (`"Components"`, `"Matrix"`).
- Fields are observed by storing them with Store Named Attribute on a small geometry (a one-point
  point cloud or a mesh line); the case lists the attribute name.
- NaN is produced inside a tree as `exp(100) - exp(100)` because Blender's division by zero returns 0.
- Expected values in the tables are analyst predictions; the captured Blender output is the reference.

### `scene`

Cases that need objects or collections carry a top-level `scene` array. Each entry creates one
collection and its objects:

```text
"scene": [
  { "collection": "Parts",
    "objects": [
      { "name": "A", "mesh": "cube" | "plane" | "empty",
        "location": [x, y, z], "rotation": [x, y, z], "scale": [x, y, z] }
    ] }
]
```

`rotation` is XYZ Euler in radians; omitted transform keys mean identity. Objects are linked to the
collection in list order, which is the collection's object order. A string value on an Object or
Collection input socket names the data-block in `bpy.data`. The modifier object created by the runner
sits at the origin with identity transform and is named after the case id.

Not expressible yet (cases that need it are listed in tables outside the JSON fences): child
collections, collection instance offsets, a transformed modifier object, materials, hidden objects.

## Open questions (behaviour not pinned down)

- **Luma coefficients**: the imbuf source was not available. Captured output shows
  Kr = 0.2126, Kg = 0.7152, Kb = 0.0722 (default configuration); a non-default colour configuration
  would change them.
- **Switch with a field condition on a non-field type**: the condition is evaluated once without
  context; which value context inputs other than Index / Position read there is inferred, not traced.
- **String attributes through Instance on Points**: that path does not filter them out, but whether
  instances accept a string attribute was not verified.
- **Custom normals in Realize Instances / Join** when free normals are mixed with meshes without
  custom normals: the domain choice is pinned, the exact normal values contributed by a mesh without
  custom normals (its evaluated vertex / face / corner normals) are not captured by any case yet.
- **Math `MULTIPLY_ADD`** may or may not be fused (FMA); allow 1 ulp.
- **Sign of zero**: `CEIL(-0.5)` is -0.0 in the C library but the captured attribute reads 0.0; whether
  Blender or the exporter drops the sign is unknown, so no case asserts it.
- **Volume** behaviour (Join drops all volumes when there are two or more; Realize keeps only the
  first, untransformed) cannot be checked until the exporter reports volumes.
- **Grease Pencil** in Instance on Points, Transform and Realize is specified but has no runnable
  case: the exporter does not read Grease Pencil and no primitive node creates it.
- Which objects count as "not evaluated" for Collection / Object Info (viewport-disabled, excluded
  collections) was not traced.
