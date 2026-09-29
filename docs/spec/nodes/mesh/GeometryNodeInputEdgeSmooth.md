# Is Edge Smooth (`GeometryNodeInputEdgeSmooth`)

Field input that reads whether edges are smooth (not marked sharp).

## Sockets

| Direction | Identifier | Type |
|---|---|---|
| out | `Smooth` | bool field |

No inputs, no properties.

## Definition

`Smooth = NOT sharp_edge`, where `sharp_edge` is the mesh's built-in bool edge attribute.

- It reads only `sharp_edge`. Face shading (`sharp_face`) does not affect it: an edge between two
  flat-shaded faces still reads smooth unless `sharp_edge` is set.
- On other domains, `sharp_edge` is adapted with the mesh domain interpolation for booleans
  **before** the negation (README, "Mesh domain interpolation"):
  - Point: `sharp` is true if **any** edge using the vertex is sharp. `Smooth` on a vertex is true
    only if all its edges are smooth; a vertex with no edges reads true.
  - Face: `sharp` is true only if **every** edge of the face is sharp. So `Smooth` on a face is true
    unless all its edges are sharp.
  - Corner: `sharp` is true only if **both** edges meeting at the corner (the corner's edge and the
    previous corner's edge in the face) are sharp.
- A mesh without `sharp_edge` reads `Smooth = true` everywhere.
- On a geometry context with no mesh, the field reads true.

## Reference cases

```json
[
  {
    "id": "is-edge-smooth-cube-default",
    "description": "Cube without sharp_edge: Smooth stored on edges is true everywhere",
    "tree": {
      "nodes": [
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "smooth", "type": "GeometryNodeInputEdgeSmooth" },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "EDGE" }, "inputs": { "Name": "smooth" } }
      ],
      "links": [
        { "from": ["cube", "Mesh"], "to": ["store", "Geometry"] },
        { "from": ["smooth", "Smooth"], "to": ["store", "Value"] }
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "is-edge-smooth-partial-edges-and-faces",
    "description": "Grid with edges of index < 7 marked sharp; Smooth stored on edges, faces and corners",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 6.5 } },
        { "name": "set", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "EDGE" }, "inputs": { "Shade Smooth": false } },
        { "name": "smooth", "type": "GeometryNodeInputEdgeSmooth" },
        { "name": "onedge", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "EDGE" }, "inputs": { "Name": "smooth_edge" } },
        { "name": "onface", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "FACE" }, "inputs": { "Name": "smooth_face" } },
        { "name": "oncorner", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "CORNER" }, "inputs": { "Name": "smooth_corner" } },
        { "name": "onpoint", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "POINT" }, "inputs": { "Name": "smooth_point" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["set", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["set", "Selection"] },
        { "from": ["set", "Geometry"], "to": ["onedge", "Geometry"] },
        { "from": ["smooth", "Smooth"], "to": ["onedge", "Value"] },
        { "from": ["onedge", "Geometry"], "to": ["onface", "Geometry"] },
        { "from": ["smooth", "Smooth"], "to": ["onface", "Value"] },
        { "from": ["onface", "Geometry"], "to": ["oncorner", "Geometry"] },
        { "from": ["smooth", "Smooth"], "to": ["oncorner", "Value"] },
        { "from": ["oncorner", "Geometry"], "to": ["onpoint", "Geometry"] },
        { "from": ["smooth", "Smooth"], "to": ["onpoint", "Value"] }
      ],
      "output": ["onpoint", "Geometry"]
    }
  }
]
```

Note for the second case: each Store Named Attribute evaluates `Smooth` on the geometry it
receives; the stored attributes are all differently named, so earlier stores do not change what
later ones read.
