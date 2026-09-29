# Separate Geometry (`GeometryNodeSeparateGeometry`)

Splits a geometry in two: `Selection` keeps the selected elements, `Inverted` keeps the rest.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Geometry` | geometry | | any components |
| in | `Selection` | bool field | true | evaluated per component on the chosen domain |
| out | `Selection` | geometry | | what the selection keeps |
| out | `Inverted` | geometry | | computed with the selection negated (`NOT selection`) |

Property `domain`: `POINT` (default), `EDGE`, `FACE`, `CURVE`, `INSTANCE`, `LAYER`.

`Inverted` is exactly what `Selection` would give with the field replaced by its negation. Both
outputs are computed from the same input independently.

## Which components a domain touches

| Domain | Mesh | Point cloud | Curves | Grease Pencil | Instances |
|---|---|---|---|---|---|
| POINT | yes (vertices) | yes | yes (points) | yes (stroke points, per layer) | recursed into |
| EDGE | yes (edges) | no | no | no | recursed into |
| FACE | yes (faces) | no | no | no | recursed into |
| CURVE | no | no | yes (curves) | yes (strokes, per layer) | recursed into |
| LAYER | no | no | no | yes (layers) | recursed into |
| INSTANCE | no | no | no | no | top level only |

- A component the domain does not touch is passed **unchanged to both outputs**. For example,
  `EDGE` on a geometry with a mesh and a point cloud puts the same point cloud in both outputs.
- For every domain except `INSTANCE`, the node also processes geometry nested inside instances (at
  any depth); the instances themselves are kept in both outputs.
- For `INSTANCE`, only the top-level instances component is filtered; nested geometry and the
  top-level realized components are untouched and go to both outputs.

Curves and Grease Pencil behaviour is outside the mesh area and is specified elsewhere; this file
covers mesh, point cloud and instances.

## Mesh

The selection is evaluated on the mesh for the chosen domain. Then:

### Kept elements

| Domain | Vertices kept | Edges kept | Faces kept |
|---|---|---|---|
| POINT | selected vertices | edges whose **both** vertices are kept | faces whose **every** vertex is kept |
| EDGE | vertices used by at least one selected edge | selected edges | faces whose **every** edge is selected |
| FACE | vertices used by a selected face | edges used by a selected face | selected faces |

Consequences:
- EDGE drops loose vertices, even when a per-element field selects every edge.
- FACE drops loose vertices and loose edges, even when a per-element field selects every face.
- POINT keeps loose vertices that are selected.
- The exception is a selection that is a constant `true` (an unlinked socket, or a field that does
  not depend on the geometry): the mesh is then returned as it is, loose elements included. Pin with
  `separate-mesh-edge-all-drops-loose-vertex` and `separate-mesh-edge-constant-true-keeps-loose`.

### Result

- If the selection is a constant (not varying per element): `true` returns the mesh unchanged;
  `false` removes the mesh component (not an empty mesh).
- If the domain has zero elements, the mesh is returned unchanged.
- If no vertex is kept, the mesh component is **removed**.
- If every vertex, edge and face is kept, the mesh is returned unchanged.
- Otherwise a new mesh is built:
  - kept vertices, edges and faces keep their **relative order** (ascending original index) and are
    renumbered densely;
  - each kept face keeps its corners in the original order; corners are renumbered face by face;
  - edge vertex indices and corner vertex/edge indices are remapped to the new numbering;
  - every attribute on every domain is copied from its source element (point from vertex, edge
    from edge, face from face, corner from corner); vertex-group weights too;
  - materials and other mesh-level settings are copied.

No new elements are created and nothing is interpolated.

## Point cloud (POINT only)

- Constant/all selected: unchanged.
- Nothing selected: the point-cloud component is **removed**.
- Otherwise: a new point cloud with the selected points in ascending original order, every point
  attribute gathered (including `position` and `radius`).

## Instances (INSTANCE only)

- The selection is evaluated on the instance domain of the top-level instances.
- Nothing selected: the instances component is removed.
- Otherwise the selected instances are kept in ascending order, with every instance attribute
  (transforms and all others) gathered.
- References that no kept instance uses are removed. The remaining references keep their relative
  order, and the kept instances' reference indices are renumbered to match.

## Edge cases

- Geometry without any component the domain touches: both outputs equal the input.
- A field that reads attributes is evaluated per component (and per nested geometry), on that
  component's own data.

## Reference cases

```json
[
  {
    "id": "separate-mesh-point-grid",
    "description": "POINT domain on a 3 by 3 grid, vertices with index < 5 (with vertex, edge, face, corner attributes stored); both outputs joined in order Selection, Inverted",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "vf", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "POINT" }, "inputs": { "Name": "vf" } },
        { "name": "ef", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "ef" } },
        { "name": "ff", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "FACE" }, "inputs": { "Name": "ff" } },
        { "name": "cf", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "CORNER" }, "inputs": { "Name": "cf" } },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 4.5 } },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "POINT" } },
        { "name": "move", "type": "GeometryNodeTransform", "inputs": { "Translation": [0, 0, 1] } },
        { "name": "join", "type": "GeometryNodeJoinGeometry" }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["vf", "Geometry"] },
        { "from": ["index", "Index"], "to": ["vf", "Value"] },
        { "from": ["vf", "Geometry"], "to": ["ef", "Geometry"] },
        { "from": ["index", "Index"], "to": ["ef", "Value"] },
        { "from": ["ef", "Geometry"], "to": ["ff", "Geometry"] },
        { "from": ["index", "Index"], "to": ["ff", "Value"] },
        { "from": ["ff", "Geometry"], "to": ["cf", "Geometry"] },
        { "from": ["index", "Index"], "to": ["cf", "Value"] },
        { "from": ["cf", "Geometry"], "to": ["separate", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["separate", "Selection"] },
        { "from": ["separate", "Inverted"], "to": ["move", "Geometry"] },
        { "from": ["separate", "Selection"], "to": ["join", "Geometry"] },
        { "from": ["move", "Geometry"], "to": ["join", "Geometry"] }
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "separate-mesh-point-selection-only",
    "description": "POINT domain on a 3 by 3 grid, vertices with index < 5, Selection output alone",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 4.5 } },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "POINT" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["separate", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["separate", "Selection"] }
      ],
      "output": ["separate", "Selection"]
    }
  },
  {
    "id": "separate-mesh-point-inverted-only",
    "description": "POINT domain on a 3 by 3 grid, vertices with index < 5, Inverted output alone",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 4.5 } },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "POINT" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["separate", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["separate", "Selection"] }
      ],
      "output": ["separate", "Inverted"]
    }
  },
  {
    "id": "separate-mesh-edge-grid",
    "description": "EDGE domain on a 3 by 3 grid, edges with index < 7 (all edges along Y plus one along X), Selection output",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 6.5 } },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "EDGE" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["separate", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["separate", "Selection"] }
      ],
      "output": ["separate", "Selection"]
    }
  },
  {
    "id": "separate-mesh-edge-all-drops-loose-vertex",
    "description": "EDGE domain, all selected, on a grid joined with a loose vertex: the loose vertex disappears",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "cloud", "type": "GeometryNodePoints", "inputs": { "Position": [3, 0, 0] } },
        { "name": "verts", "type": "GeometryNodePointsToVertices" },
        { "name": "join", "type": "GeometryNodeJoinGeometry" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "all", "type": "ShaderNodeMath", "properties": { "operation": "GREATER_THAN" }, "inputs": { "Value_001": -1 } },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "EDGE" } }
      ],
      "links": [
        { "from": ["cloud", "Geometry"], "to": ["verts", "Points"] },
        { "from": ["grid", "Mesh"], "to": ["join", "Geometry"] },
        { "from": ["verts", "Mesh"], "to": ["join", "Geometry"] },
        { "from": ["join", "Geometry"], "to": ["separate", "Geometry"] },
        { "from": ["index", "Index"], "to": ["all", "Value"] },
        { "from": ["all", "Value"], "to": ["separate", "Selection"] }
      ],
      "output": ["separate", "Selection"]
    }
  },
  {
    "id": "separate-mesh-edge-constant-true-keeps-loose",
    "description": "EDGE domain with the unlinked Selection (constant true) on a grid joined with a loose vertex: the mesh is unchanged",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "cloud", "type": "GeometryNodePoints", "inputs": { "Position": [3, 0, 0] } },
        { "name": "verts", "type": "GeometryNodePointsToVertices" },
        { "name": "join", "type": "GeometryNodeJoinGeometry" },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "EDGE" } }
      ],
      "links": [
        { "from": ["cloud", "Geometry"], "to": ["verts", "Points"] },
        { "from": ["grid", "Mesh"], "to": ["join", "Geometry"] },
        { "from": ["verts", "Mesh"], "to": ["join", "Geometry"] },
        { "from": ["join", "Geometry"], "to": ["separate", "Geometry"] }
      ],
      "output": ["separate", "Selection"]
    }
  },
  {
    "id": "separate-mesh-face-grid",
    "description": "FACE domain on a 4 by 3 grid, faces 1 and 4 (not adjacent), Selection output with corner UVs stored",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 4, "Vertices Y": 3 } },
        { "name": "uv", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT_VECTOR", "domain": "CORNER" }, "inputs": { "Name": "uv" } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "sub", "type": "ShaderNodeMath", "properties": { "operation": "SUBTRACT" }, "inputs": { "Value_001": 1 } },
        { "name": "mod", "type": "ShaderNodeMath", "properties": { "operation": "FLOORED_MODULO" }, "inputs": { "Value_001": 3 } },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 0.5 } },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "FACE" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["uv", "Geometry"] },
        { "from": ["grid", "UV Map"], "to": ["uv", "Value"] },
        { "from": ["uv", "Geometry"], "to": ["separate", "Geometry"] },
        { "from": ["index", "Index"], "to": ["sub", "Value"] },
        { "from": ["sub", "Value"], "to": ["mod", "Value"] },
        { "from": ["mod", "Value"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["separate", "Selection"] }
      ],
      "output": ["separate", "Selection"]
    }
  },
  {
    "id": "separate-mesh-constant-false",
    "description": "FACE domain with Selection false: Selection output has no mesh component",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "FACE" }, "inputs": { "Selection": false } }
      ],
      "links": [{ "from": ["grid", "Mesh"], "to": ["separate", "Geometry"] }],
      "output": ["separate", "Selection"]
    }
  },
  {
    "id": "separate-pointcloud-point",
    "description": "POINT domain on a 5-point cloud offset by index along every axis, radius set to the index, points with index < 2.5 selected: Inverted output keeps points 3 and 4",
    "tree": {
      "nodes": [
        { "name": "cloud", "type": "GeometryNodePoints", "inputs": { "Count": 5 } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "spread", "type": "GeometryNodeSetPosition" },
        { "name": "rad", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "POINT" }, "inputs": { "Name": "radius" } },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 2.5 } },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "POINT" } }
      ],
      "links": [
        { "from": ["cloud", "Geometry"], "to": ["spread", "Geometry"] },
        { "from": ["index", "Index"], "to": ["spread", "Offset"] },
        { "from": ["spread", "Geometry"], "to": ["rad", "Geometry"] },
        { "from": ["index", "Index"], "to": ["rad", "Value"] },
        { "from": ["rad", "Geometry"], "to": ["separate", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["separate", "Selection"] }
      ],
      "output": ["separate", "Inverted"]
    }
  },
  {
    "id": "separate-edge-domain-leaves-pointcloud",
    "description": "EDGE domain, Selection false, on a grid joined with a point cloud: mesh removed, point cloud untouched",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "cloud", "type": "GeometryNodePoints", "inputs": { "Count": 3 } },
        { "name": "join", "type": "GeometryNodeJoinGeometry" },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "EDGE" }, "inputs": { "Selection": false } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["join", "Geometry"] },
        { "from": ["cloud", "Geometry"], "to": ["join", "Geometry"] },
        { "from": ["join", "Geometry"], "to": ["separate", "Geometry"] }
      ],
      "output": ["separate", "Selection"]
    }
  },
  {
    "id": "separate-instances",
    "description": "INSTANCE domain on 4 cube instances (one shared reference), instances with index < 1.5 selected: Inverted output keeps instances 2 and 3",
    "tree": {
      "nodes": [
        { "name": "cloud", "type": "GeometryNodePoints", "inputs": { "Count": 4 } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "spread", "type": "GeometryNodeSetPosition" },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "inst", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 1.5 } },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "INSTANCE" } }
      ],
      "links": [
        { "from": ["cloud", "Geometry"], "to": ["spread", "Geometry"] },
        { "from": ["index", "Index"], "to": ["spread", "Offset"] },
        { "from": ["spread", "Geometry"], "to": ["inst", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["inst", "Instance"] },
        { "from": ["inst", "Instances"], "to": ["separate", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["separate", "Selection"] }
      ],
      "output": ["separate", "Inverted"]
    }
  },
  {
    "id": "separate-instances-unused-references",
    "description": "INSTANCE domain on Geometry to Instance of a grid, a cube and a line (3 instances, 3 references), instance 1 dropped: references renumbered to [grid, line]",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "line", "type": "GeometryNodeMeshLine" },
        { "name": "toinst", "type": "GeometryNodeGeometryToInstance" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "COMPARE" }, "inputs": { "Value_001": 1, "Value_002": 0.5 } },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "INSTANCE" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["toinst", "Geometry"] },
        { "from": ["cube", "Mesh"], "to": ["toinst", "Geometry"] },
        { "from": ["line", "Mesh"], "to": ["toinst", "Geometry"] },
        { "from": ["toinst", "Instances"], "to": ["separate", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["separate", "Selection"] }
      ],
      "output": ["separate", "Inverted"]
    }
  },
  {
    "id": "separate-point-inside-instances",
    "description": "POINT domain on instances of a 3 by 3 grid: the nested grids are cut, the instances stay",
    "tree": {
      "nodes": [
        { "name": "cloud", "type": "GeometryNodePoints", "inputs": { "Count": 2 } },
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "inst", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 4.5 } },
        { "name": "separate", "type": "GeometryNodeSeparateGeometry", "properties": { "domain": "POINT" } }
      ],
      "links": [
        { "from": ["cloud", "Geometry"], "to": ["inst", "Points"] },
        { "from": ["grid", "Mesh"], "to": ["inst", "Instance"] },
        { "from": ["inst", "Instances"], "to": ["separate", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["separate", "Selection"] }
      ],
      "output": ["separate", "Selection"]
    }
  }
]
```

In `separate-mesh-face-grid`, `floored_mod(index - 1, 3) < 0.5` selects faces 1 and 4 of the six.
