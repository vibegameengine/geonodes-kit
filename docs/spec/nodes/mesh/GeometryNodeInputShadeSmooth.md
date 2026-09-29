# Is Face Smooth (`GeometryNodeInputShadeSmooth`)

Field input that reads whether faces are smooth-shaded.

## Sockets

| Direction | Identifier | Type |
|---|---|---|
| out | `Smooth` | bool field |

No inputs, no properties.

## Definition

`Smooth = NOT sharp_face`, where `sharp_face` is the mesh's built-in bool face attribute.

- The value is read on the **face** domain and, when the field is evaluated on another domain,
  adapted with the mesh domain interpolation for booleans **before** the negation (README,
  "Mesh domain interpolation"):
  - Point: `sharp` is true if **any** face using the vertex is sharp; a vertex with no faces gets
    false. So `Smooth` on a vertex is true only if **all** its faces are smooth, and true for a
    vertex with no faces.
  - Edge: `sharp` is true if any face using the edge is sharp; loose edges get false, so they read
    smooth.
  - Corner: the value of the corner's face.
- A mesh without a `sharp_face` attribute reads `Smooth = true` everywhere.
- On a geometry context with no mesh (point cloud, curves, instances), the attribute is not found
  and the field reads true.

## Reference cases

Evaluate the field by storing it as a named attribute.

```json
[
  {
    "id": "is-face-smooth-grid",
    "description": "Grid (all faces sharp): Smooth stored on faces is false everywhere",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "smooth", "type": "GeometryNodeInputShadeSmooth" },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "FACE" }, "inputs": { "Name": "smooth" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["store", "Geometry"] },
        { "from": ["smooth", "Smooth"], "to": ["store", "Value"] }
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "is-face-smooth-partial-on-points",
    "description": "Grid with faces 0 and 1 set smooth, Smooth stored on points: only vertices whose every face is smooth read true",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 1.5 } },
        { "name": "set", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "FACE" } },
        { "name": "smooth", "type": "GeometryNodeInputShadeSmooth" },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "POINT" }, "inputs": { "Name": "smooth" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["set", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["set", "Selection"] },
        { "from": ["set", "Geometry"], "to": ["store", "Geometry"] },
        { "from": ["smooth", "Smooth"], "to": ["store", "Value"] }
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "is-face-smooth-partial-on-edges",
    "description": "Same mesh as above, Smooth stored on edges",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 1.5 } },
        { "name": "set", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "FACE" } },
        { "name": "smooth", "type": "GeometryNodeInputShadeSmooth" },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "EDGE" }, "inputs": { "Name": "smooth" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["set", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["set", "Selection"] },
        { "from": ["set", "Geometry"], "to": ["store", "Geometry"] },
        { "from": ["smooth", "Smooth"], "to": ["store", "Value"] }
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "is-face-smooth-no-attribute",
    "description": "Mesh Line (no faces, no sharp_face): Smooth stored on points is true everywhere",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine" },
        { "name": "smooth", "type": "GeometryNodeInputShadeSmooth" },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "POINT" }, "inputs": { "Name": "smooth" } }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["store", "Geometry"] },
        { "from": ["smooth", "Smooth"], "to": ["store", "Value"] }
      ],
      "output": ["store", "Geometry"]
    }
  }
]
```
