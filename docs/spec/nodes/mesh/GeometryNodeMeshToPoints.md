# Mesh to Points (`GeometryNodeMeshToPoints`)

Creates one point-cloud point per selected mesh element of the chosen domain.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Mesh` | geometry | | |
| in | `Selection` | bool field | true | evaluated on the mode's domain |
| in | `Position` | vector field | implicit **Position** field | the inventory lists (0,0,0), but an unlinked socket reads the position |
| in | `Radius` | float field | 0.05 | UI minimum 0 |
| out | `Points` | geometry | | |

Property `mode`: `VERTICES` (default), `EDGES`, `FACES`, `CORNERS`, mapping to the mesh domains
Point, Edge, Face, Corner.

## What is computed

All fields are evaluated on the mesh, on the mode's domain:

- `Selection` gives the elements to convert. Output point `j` comes from the `j`-th selected element
  in **ascending element index**. No other ordering is applied.
- `Position` gives each point's position. The unlinked default is the vertex position adapted to
  the domain (see README, "Mesh domain interpolation"):
  - Vertices: the vertex position;
  - Edges: the midpoint of the two vertices;
  - Faces: the arithmetic mean of the face's corner vertex positions (not the area centroid);
  - Corners: the position of the corner's vertex.
- `Radius` gives the `radius` attribute, after `max(radius, 0)`: negative values become 0; NaN stays
  NaN.

## Output geometry

- The output keeps only the new point cloud (plus instances, see below). The input mesh is
  removed, and **any point cloud, curves or volume already in the input are dropped**, even in modes
  where nothing is converted.
- If the input has no mesh, or the mesh has zero elements on the mode's domain (for example Faces on
  a mesh without faces), the output has **no point cloud**.
- If the domain is non-empty but nothing is selected, the output has a point cloud with 0 points
  (the attributes exist with length 0).
- The node recurses into instances: each mesh inside instance references is converted in place;
  the instances component itself is kept.

## Attribute propagation

Every attribute of the mesh is carried to the points, **adapted to the mode's domain** with the
mesh domain interpolation (README) and then gathered by the selection, keeping its name and type.
Exceptions:

- Skipped: the mesh's built-in attributes that a point cloud does not have: `material_index`,
  `sharp_face`, `sharp_edge`, `.edge_verts`, `.corner_vert`, `.corner_edge`.
- Skipped: `position` and `radius` (written from the inputs above, so a mesh attribute named
  `radius` is replaced), `.select_edge`, `.select_poly`.
- Renamed: `.select_vert` becomes `.selection`.
- Vertex groups arrive as float point attributes with the group name.
- UV maps (float2 corner attributes) and every other generic attribute are carried.
- An attribute that cannot be adapted to the domain (its source domain is empty) is skipped.
- Anonymous attributes that nothing downstream reads may be dropped; this is not observable.

Examples:
- Vertices mode: a corner UV map becomes, per point, the mean of the UVs of the corners at that
  vertex (one corner per face using the vertex); a loose vertex gets (0,0).
- Faces mode: a point attribute becomes the mean over the face's corners' vertices; a bool point
  attribute is true only if all the face's vertices are true.
- Edges mode: a face attribute becomes the mean over the faces using the edge; a loose edge gets
  zero (false for bool: an edge is true if any adjacent face is true).
- Corners mode: a point attribute is copied from the corner's vertex; a face attribute from the
  corner's face.

## Edge cases

- Empty mesh: no point cloud in the output.
- A position field that reads other attributes is evaluated on the mesh before conversion, on the
  chosen domain.

## Reference cases

Existing in `reference/cases/cases.json`: `grid-to-points-faces`.

```json
[
  {
    "id": "mesh-to-points-vertices-grid",
    "description": "Vertices mode on a 3 by 2 grid with a vertex float, a face int and the UV map stored",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 3, "Vertices Y": 2 } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "vf", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "POINT" }, "inputs": { "Name": "vf" } },
        { "name": "fi", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "INT", "domain": "FACE" }, "inputs": { "Name": "fi" } },
        { "name": "uv", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT_VECTOR", "domain": "CORNER" }, "inputs": { "Name": "uv" } },
        { "name": "points", "type": "GeometryNodeMeshToPoints", "properties": { "mode": "VERTICES" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["vf", "Geometry"] },
        { "from": ["index", "Index"], "to": ["vf", "Value"] },
        { "from": ["vf", "Geometry"], "to": ["fi", "Geometry"] },
        { "from": ["index", "Index"], "to": ["fi", "Value"] },
        { "from": ["fi", "Geometry"], "to": ["uv", "Geometry"] },
        { "from": ["grid", "UV Map"], "to": ["uv", "Value"] },
        { "from": ["uv", "Geometry"], "to": ["points", "Mesh"] }
      ],
      "output": ["points", "Points"]
    }
  },
  {
    "id": "mesh-to-points-edges-grid",
    "description": "Edges mode on a 3 by 2 grid with the same stored attributes: midpoints in edge order",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 3, "Vertices Y": 2 } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "vf", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "POINT" }, "inputs": { "Name": "vf" } },
        { "name": "fi", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "INT", "domain": "FACE" }, "inputs": { "Name": "fi" } },
        { "name": "points", "type": "GeometryNodeMeshToPoints", "properties": { "mode": "EDGES" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["vf", "Geometry"] },
        { "from": ["index", "Index"], "to": ["vf", "Value"] },
        { "from": ["vf", "Geometry"], "to": ["fi", "Geometry"] },
        { "from": ["index", "Index"], "to": ["fi", "Value"] },
        { "from": ["fi", "Geometry"], "to": ["points", "Mesh"] }
      ],
      "output": ["points", "Points"]
    }
  },
  {
    "id": "mesh-to-points-corners-grid",
    "description": "Corners mode on a 3 by 2 grid with the UV map stored and radius 0.2",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 3, "Vertices Y": 2 } },
        { "name": "uv", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT_VECTOR", "domain": "CORNER" }, "inputs": { "Name": "uv" } },
        { "name": "points", "type": "GeometryNodeMeshToPoints", "properties": { "mode": "CORNERS" }, "inputs": { "Radius": 0.2 } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["uv", "Geometry"] },
        { "from": ["grid", "UV Map"], "to": ["uv", "Value"] },
        { "from": ["uv", "Geometry"], "to": ["points", "Mesh"] }
      ],
      "output": ["points", "Points"]
    }
  },
  {
    "id": "mesh-to-points-faces-selection-radius-field",
    "description": "Faces mode on a 4 by 4 grid, odd faces only, radius = index - 4 (negative radii clamp to 0)",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 4, "Vertices Y": 4 } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "odd", "type": "ShaderNodeMath", "properties": { "operation": "MODULO" }, "inputs": { "Value_001": 2 } },
        { "name": "radius", "type": "ShaderNodeMath", "properties": { "operation": "SUBTRACT" }, "inputs": { "Value_001": 4 } },
        { "name": "points", "type": "GeometryNodeMeshToPoints", "properties": { "mode": "FACES" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["points", "Mesh"] },
        { "from": ["index", "Index"], "to": ["odd", "Value"] },
        { "from": ["odd", "Value"], "to": ["points", "Selection"] },
        { "from": ["index", "Index"], "to": ["radius", "Value"] },
        { "from": ["radius", "Value"], "to": ["points", "Radius"] }
      ],
      "output": ["points", "Points"]
    }
  },
  {
    "id": "mesh-to-points-faces-no-faces",
    "description": "Faces mode on a Mesh Line joined with a Points node: no point cloud at all in the output",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 3 } },
        { "name": "cloud", "type": "GeometryNodePoints", "inputs": { "Count": 2 } },
        { "name": "join", "type": "GeometryNodeJoinGeometry" },
        { "name": "points", "type": "GeometryNodeMeshToPoints", "properties": { "mode": "FACES" } }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["join", "Geometry"] },
        { "from": ["cloud", "Geometry"], "to": ["join", "Geometry"] },
        { "from": ["join", "Geometry"], "to": ["points", "Mesh"] }
      ],
      "output": ["points", "Points"]
    }
  },
  {
    "id": "mesh-to-points-empty-selection",
    "description": "Vertices mode with Selection false: a point cloud with zero points",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "points", "type": "GeometryNodeMeshToPoints", "inputs": { "Selection": false } }
      ],
      "links": [{ "from": ["grid", "Mesh"], "to": ["points", "Mesh"] }],
      "output": ["points", "Points"]
    }
  },
  {
    "id": "mesh-to-points-builtins-skipped",
    "description": "Vertices mode on a cube after Set Material Index and Set Shade Smooth (edge): material_index and sharp_edge must not appear on the points",
    "tree": {
      "nodes": [
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "mat", "type": "GeometryNodeSetMaterialIndex", "inputs": { "Material Index": 3 } },
        { "name": "sharp", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "EDGE" }, "inputs": { "Shade Smooth": false } },
        { "name": "points", "type": "GeometryNodeMeshToPoints" }
      ],
      "links": [
        { "from": ["cube", "Mesh"], "to": ["mat", "Geometry"] },
        { "from": ["mat", "Geometry"], "to": ["sharp", "Geometry"] },
        { "from": ["sharp", "Geometry"], "to": ["points", "Mesh"] }
      ],
      "output": ["points", "Points"]
    }
  }
]
```

Note on `mesh-to-points-faces-selection-radius-field`: Math MODULO gives 1.0 for odd indices and
0.0 for even ones, which converts to true/false.
