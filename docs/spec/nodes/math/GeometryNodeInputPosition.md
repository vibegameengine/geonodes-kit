# Position (`GeometryNodeInputPosition`)

A field input: reads the built-in `position` of each element of the geometry the field is evaluated
on.

## Sockets

| Direction | Identifier | Type | Notes |
|---|---|---|---|
| out | `Position` | vector field (float3) | always a field, never a single value |

No inputs, no properties.

## Value per context

The field is evaluated by whichever node consumes it, on that node's component and domain.

| Component | Native domain | Value |
|---|---|---|
| Mesh | Point | vertex position |
| Point cloud | Point | point position |
| Curves | Point | **control point** position (for Bezier curves the control points, not the handles and not the evaluated points) |
| Grease Pencil | Point (per layer) | stroke point position in the **layer's local space** (the layer transform is not applied) |
| Instances | Instance | the **translation part** of each instance transform (column 4 of the matrix), not the geometry it references |

On instances, `position` is not a stored attribute in 5.2; it is derived from the transform. Writing
it (Set Position on instances) changes only the translation.

### Other domains (domain interpolation)

When the consumer evaluates on a domain other than Point, the point values are interpolated with
Blender's standard domain adaptation for float3 (the arithmetic mean):

- Mesh edge: the mean of its two vertex positions.
- Mesh face: the mean of the positions of its corners' vertices (not the area-weighted centroid).
- Mesh face corner: the position of the corner's vertex.
- Curves curve domain: the mean of the curve's control point positions.

### Missing data

Where the context has no position (e.g. the Grease Pencil layer domain, or an empty component), the
field evaluates to the default (0, 0, 0).

## Reference cases

Each case stores Position as the `FLOAT_VECTOR` attribute `p` on the named domain.

| id | expected `p` |
|---|---|
| position-mesh-point | the grid vertex positions in vertex order |
| position-mesh-face | vertex 0 moved from (-1,-1,0) to (0,-1,0): the single face gets (0.25, 0, 0), the plain mean |
| position-mesh-edge | (0.5,0,0), (1.5,0,0) |
| position-curve-bezier | the two control points (-1,0,0), (1,0,0); handles do not appear |
| position-curve-domain | (0, 0, 0.5) |
| position-instances | (0,0,0), (1,0,0), (2,0,0): translation only, rotation and scale ignored |

```json
[
  {
    "id": "position-mesh-point",
    "description": "Position on the Point domain of a 3x2 grid of size 2 x 1.5",
    "tree": {
      "nodes": [
        {"name": "grid", "type": "GeometryNodeMeshGrid", "inputs": {"Size X": 2, "Size Y": 1.5, "Vertices X": 3, "Vertices Y": 2}},
        {"name": "pos", "type": "GeometryNodeInputPosition"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "p"}}
      ],
      "links": [
        {"from": ["grid", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["pos", "Position"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "position-mesh-face",
    "description": "Face Position is the plain mean of the face's vertices",
    "tree": {
      "nodes": [
        {"name": "grid", "type": "GeometryNodeMeshGrid", "inputs": {"Size X": 2, "Size Y": 2, "Vertices X": 2, "Vertices Y": 2}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "is0", "type": "FunctionNodeCompare", "properties": {"data_type": "INT", "operation": "EQUAL"}, "inputs": {"B": 0}},
        {"name": "setp", "type": "GeometryNodeSetPosition", "inputs": {"Offset": [1, 0, 0]}},
        {"name": "pos", "type": "GeometryNodeInputPosition"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "FACE"}, "inputs": {"Name": "p"}}
      ],
      "links": [
        {"from": ["grid", "Mesh"], "to": ["setp", "Geometry"]},
        {"from": ["idx", "Index"], "to": ["is0", "A"]},
        {"from": ["is0", "Result"], "to": ["setp", "Selection"]},
        {"from": ["setp", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["pos", "Position"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "position-mesh-edge",
    "description": "Edge Position is the mean of its two vertices",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 3, "Offset": [1, 0, 0]}},
        {"name": "pos", "type": "GeometryNodeInputPosition"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "EDGE"}, "inputs": {"Name": "p"}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["pos", "Position"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "position-curve-bezier",
    "description": "Bezier Position reads control points, not handles",
    "tree": {
      "nodes": [
        {"name": "bez", "type": "GeometryNodeCurvePrimitiveBezierSegment"},
        {"name": "pos", "type": "GeometryNodeInputPosition"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "p"}}
      ],
      "links": [
        {"from": ["bez", "Curve"], "to": ["store", "Geometry"]},
        {"from": ["pos", "Position"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "position-curve-domain",
    "description": "Curve-domain Position is the mean of the control points",
    "tree": {
      "nodes": [
        {"name": "cl", "type": "GeometryNodeCurvePrimitiveLine"},
        {"name": "pos", "type": "GeometryNodeInputPosition"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "CURVE"}, "inputs": {"Name": "p"}}
      ],
      "links": [
        {"from": ["cl", "Curve"], "to": ["store", "Geometry"]},
        {"from": ["pos", "Position"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "position-instances",
    "description": "Instance-domain Position is the translation of each instance transform",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 3, "Offset": [1, 0, 0]}},
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "iop", "type": "GeometryNodeInstanceOnPoints", "inputs": {"Rotation": [0, 0, 0.5], "Scale": [2, 2, 2]}},
        {"name": "pos", "type": "GeometryNodeInputPosition"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "INSTANCE"}, "inputs": {"Name": "p"}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["iop", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["iop", "Instance"]},
        {"from": ["iop", "Instances"], "to": ["store", "Geometry"]},
        {"from": ["pos", "Position"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  }
]
```
