# Set Shade Smooth (`GeometryNodeSetShadeSmooth`)

Marks faces or edges as smooth or sharp by writing the mesh's built-in `sharp_face` or
`sharp_edge` attribute.

## Sockets

| Direction | Identifier | Name | Type | Default |
|---|---|---|---|---|
| in | `Geometry` | Mesh | geometry | |
| in | `Selection` | Selection | bool field | true |
| in | `Shade Smooth` | Shade Smooth | bool field | true |
| out | `Geometry` | Mesh | geometry | |

The geometry socket's identifier is `Geometry` although its label is "Mesh".

Property `domain`: `EDGE`, `FACE`. A newly added node is set to **`FACE`**. (The inventory reports
`EDGE` as the property's RNA default; that is not what a new node gets.)

## Semantics of the attributes

- `sharp_face` (bool, face domain): true means the face is flat-shaded. A missing attribute means
  every face is smooth.
- `sharp_edge` (bool, edge domain): true means the edge splits normals. A missing attribute means
  no edge is sharp.
- The node writes `sharp = NOT Shade Smooth`:
  - `FACE`: writes `sharp_face`;
  - `EDGE`: writes `sharp_edge`.
- The other attribute is never touched: `FACE` mode does not change `sharp_edge`, and `EDGE` mode
  does not change `sharp_face`.

## What is computed

Selection and Shade Smooth are evaluated on the mesh on the chosen domain.

1. If the domain has zero elements, nothing happens (the attribute is not created).
2. If both fields are constant (they do not depend on the geometry):
   - Selection constant false: nothing happens.
   - Selection constant true and Shade Smooth constant true: the attribute is **removed**
     (all smooth / no sharp edges).
   - Selection constant true and Shade Smooth constant false: every element becomes sharp (the
     attribute is set to true everywhere).
3. Otherwise, for each selected element, `attribute = NOT Shade Smooth` of that element.
   Unselected elements keep their current value; if the attribute did not exist, unselected
   elements get false. This path always leaves the attribute present, even when the selection is
   empty: a constant-false Selection combined with a Shade Smooth that varies per element creates
   the attribute with all false values if it was missing.

The node recurses into instances and only changes meshes; other components pass through.

## Observable consequences

- Grid (all faces `sharp_face = true`) through Set Shade Smooth with defaults: `sharp_face` is gone
  and every face reads smooth.
- A field Shade Smooth that happens to be true everywhere leaves the attribute **present** with all
  false values, unlike the constant case above. An exporter that lists attributes sees the
  difference.

## Reference cases

```json
[
  {
    "id": "set-shade-smooth-face-defaults",
    "description": "Grid with the node at defaults (FACE, all selected, smooth): sharp_face removed",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "smooth", "type": "GeometryNodeSetShadeSmooth" }
      ],
      "links": [{ "from": ["grid", "Mesh"], "to": ["smooth", "Geometry"] }],
      "output": ["smooth", "Geometry"]
    }
  },
  {
    "id": "set-shade-smooth-face-partial",
    "description": "Grid, FACE, faces with index < 1.5 made smooth: sharp_face = [false, false, true, true]",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 1.5 } },
        { "name": "smooth", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "FACE" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["smooth", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["smooth", "Selection"] }
      ],
      "output": ["smooth", "Geometry"]
    }
  },
  {
    "id": "set-shade-smooth-face-field-all-true",
    "description": "Grid, FACE, Shade Smooth = (index > -1), a field that is true everywhere: sharp_face stays present, all false",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "all", "type": "ShaderNodeMath", "properties": { "operation": "GREATER_THAN" }, "inputs": { "Value_001": -1 } },
        { "name": "smooth", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "FACE" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["smooth", "Geometry"] },
        { "from": ["index", "Index"], "to": ["all", "Value"] },
        { "from": ["all", "Value"], "to": ["smooth", "Shade Smooth"] }
      ],
      "output": ["smooth", "Geometry"]
    }
  },
  {
    "id": "set-shade-smooth-edge-sharp-partial",
    "description": "Grid, EDGE, edges with index < 3 made sharp (Shade Smooth false): sharp_edge created, other edges false, sharp_face untouched",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 2.5 } },
        { "name": "smooth", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "EDGE" }, "inputs": { "Shade Smooth": false } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["smooth", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["smooth", "Selection"] }
      ],
      "output": ["smooth", "Geometry"]
    }
  },
  {
    "id": "set-shade-smooth-edge-keeps-unselected",
    "description": "Cube: EDGE all sharp, then EDGE edges with index < 4 smooth: sharp_edge false on 0..3, true elsewhere",
    "tree": {
      "nodes": [
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "sharp", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "EDGE" }, "inputs": { "Shade Smooth": false } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "pick", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 3.5 } },
        { "name": "smooth", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "EDGE" } }
      ],
      "links": [
        { "from": ["cube", "Mesh"], "to": ["sharp", "Geometry"] },
        { "from": ["sharp", "Geometry"], "to": ["smooth", "Geometry"] },
        { "from": ["index", "Index"], "to": ["pick", "Value"] },
        { "from": ["pick", "Value"], "to": ["smooth", "Selection"] }
      ],
      "output": ["smooth", "Geometry"]
    }
  },
  {
    "id": "set-shade-smooth-selection-false",
    "description": "Grid, FACE, Selection false: unchanged, sharp_face still true on all faces",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "smooth", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "FACE" }, "inputs": { "Selection": false } }
      ],
      "links": [{ "from": ["grid", "Mesh"], "to": ["smooth", "Geometry"] }],
      "output": ["smooth", "Geometry"]
    }
  },
  {
    "id": "set-shade-smooth-no-faces",
    "description": "Mesh Line (no faces), FACE, Shade Smooth false: no sharp_face attribute is created",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine" },
        { "name": "smooth", "type": "GeometryNodeSetShadeSmooth", "properties": { "domain": "FACE" }, "inputs": { "Shade Smooth": false } }
      ],
      "links": [{ "from": ["line", "Mesh"], "to": ["smooth", "Geometry"] }],
      "output": ["smooth", "Geometry"]
    }
  }
]
```
