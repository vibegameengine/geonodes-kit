# Translate Instances (`GeometryNodeTranslateInstances`)

Moves each top-level instance.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Instances` | geometry | | only the instances component is modified |
| in | `Selection` | bool field | true | Instance domain |
| in | `Translation` | vector field | (0, 0, 0) | Instance domain |
| in | `Local Space` | bool field | **true** | Instance domain, per instance |
| out | `Instances` | geometry | | |

No properties.

## Behaviour

Fields are evaluated on the Instance domain of the **top-level** instances component (so instance
attributes and the Position field, which reads the instance translation, are available). For every
selected instance `i` with transform `M` (4x4) and translation `t`:

- `Local Space` true: `M := M * T(t)`. The translation is expressed in the instance's own axes, so it
  is rotated and **scaled** by the instance: new location = old location + `M3x3 * t`.
- `Local Space` false: `M := M` with `t` added to its translation column (world/parent space).

Unselected instances, nested instances inside referenced geometry, references and instance
attributes are untouched. Other components (mesh, curves, ...) pass through unchanged. Without an
instances component the geometry passes through unchanged.

## Reference cases

Two cube instances at x = 0 and x = 1, rotated 90 degrees about Z and scaled by 2, translated by
(1, 0, 0).

| id | expected instance translations |
|---|---|
| translate-local | (0, 2, 0), (1, 2, 0) |
| translate-global | (1, 0, 0), (2, 0, 0) |
| translate-selection | (0, 0, 0) unchanged, (1, 2, 0) |
| translate-local-field | (0, 2, 0) local, (2, 0, 0) global |
| translate-nested-untouched | the one top-level instance at (0, 0, 5); inside its geometry the two cube instances stay at (0,0,0) and (1,0,0) |

```json
[
  {
    "id": "translate-local",
    "description": "Local Space: (1,0,0) is rotated 90 degrees about Z and scaled by 2",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 2, "Offset": [1, 0, 0]}},
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "iop", "type": "GeometryNodeInstanceOnPoints", "inputs": {"Rotation": [0, 0, 1.5707964], "Scale": [2, 2, 2]}},
        {"name": "tr", "type": "GeometryNodeTranslateInstances", "inputs": {"Translation": [1, 0, 0], "Local Space": true}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["iop", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["iop", "Instance"]},
        {"from": ["iop", "Instances"], "to": ["tr", "Instances"]}
      ],
      "output": ["tr", "Instances"]
    }
  },
  {
    "id": "translate-global",
    "description": "Global space: (1,0,0) is added to the translation",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 2, "Offset": [1, 0, 0]}},
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "iop", "type": "GeometryNodeInstanceOnPoints", "inputs": {"Rotation": [0, 0, 1.5707964], "Scale": [2, 2, 2]}},
        {"name": "tr", "type": "GeometryNodeTranslateInstances", "inputs": {"Translation": [1, 0, 0], "Local Space": false}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["iop", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["iop", "Instance"]},
        {"from": ["iop", "Instances"], "to": ["tr", "Instances"]}
      ],
      "output": ["tr", "Instances"]
    }
  },
  {
    "id": "translate-selection",
    "description": "Only instance 1 is selected",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 2, "Offset": [1, 0, 0]}},
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "iop", "type": "GeometryNodeInstanceOnPoints", "inputs": {"Rotation": [0, 0, 1.5707964], "Scale": [2, 2, 2]}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "sel", "type": "FunctionNodeCompare", "properties": {"data_type": "INT", "operation": "EQUAL"}, "inputs": {"B": 1}},
        {"name": "tr", "type": "GeometryNodeTranslateInstances", "inputs": {"Translation": [1, 0, 0]}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["iop", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["iop", "Instance"]},
        {"from": ["iop", "Instances"], "to": ["tr", "Instances"]},
        {"from": ["idx", "Index"], "to": ["sel", "A"]},
        {"from": ["sel", "Result"], "to": ["tr", "Selection"]}
      ],
      "output": ["tr", "Instances"]
    }
  },
  {
    "id": "translate-local-field",
    "description": "Local Space as a field: instance 0 local, instance 1 global",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 2, "Offset": [1, 0, 0]}},
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "iop", "type": "GeometryNodeInstanceOnPoints", "inputs": {"Rotation": [0, 0, 1.5707964], "Scale": [2, 2, 2]}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "loc", "type": "FunctionNodeCompare", "properties": {"data_type": "INT", "operation": "EQUAL"}, "inputs": {"B": 0}},
        {"name": "tr", "type": "GeometryNodeTranslateInstances", "inputs": {"Translation": [1, 0, 0]}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["iop", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["iop", "Instance"]},
        {"from": ["iop", "Instances"], "to": ["tr", "Instances"]},
        {"from": ["idx", "Index"], "to": ["loc", "A"]},
        {"from": ["loc", "Result"], "to": ["tr", "Local Space"]}
      ],
      "output": ["tr", "Instances"]
    }
  },
  {
    "id": "translate-nested-untouched",
    "description": "Only the single top-level instance moves; the two nested cube instances keep their transforms",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 2, "Offset": [1, 0, 0]}},
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "inner", "type": "GeometryNodeInstanceOnPoints"},
        {"name": "g2i", "type": "GeometryNodeGeometryToInstance"},
        {"name": "tr", "type": "GeometryNodeTranslateInstances", "inputs": {"Translation": [0, 0, 5], "Local Space": false}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["inner", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["inner", "Instance"]},
        {"from": ["inner", "Instances"], "to": ["g2i", "Geometry"]},
        {"from": ["g2i", "Instances"], "to": ["tr", "Instances"]}
      ],
      "output": ["tr", "Instances"]
    }
  }
]
```
