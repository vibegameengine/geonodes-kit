# Separate XYZ (`ShaderNodeSeparateXYZ`)

Splits a vector into its three components. A pure field function.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Vector` | vector (float3) | (0, 0, 0) | unlinked components limited to [-10000, 10000] |
| out | `X` | float | | `Vector.x` |
| out | `Y` | float | | `Vector.y` |
| out | `Z` | float | | `Vector.z` |

No properties. Components are copied bit-exactly. Outputs that are not linked are not computed, which
is not observable.

A non-vector link is converted implicitly first: a float `f` becomes `(f, f, f)`, a colour becomes
`(r, g, b)`, a bool becomes `(1,1,1)` or `(0,0,0)`, an int `n` becomes `(n, n, n)`.

## Reference cases

| id | expected |
|---|---|
| separate-basic-x | `x` = 1 |
| separate-basic-z | `z` = 3.5 |
| separate-from-float | `z` = 0.25 |
| separate-from-position | `x` = -1, -1, 1, 1 in vertex order |

```json
[
  {
    "id": "separate-basic-x",
    "description": "Separate XYZ of a constant vector, X stored",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "s", "type": "ShaderNodeSeparateXYZ", "inputs": {"Vector": [1, -2, 3.5]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "x"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["s", "X"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "separate-basic-z",
    "description": "Separate XYZ of a constant vector, Z stored",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "s", "type": "ShaderNodeSeparateXYZ", "inputs": {"Vector": [1, -2, 3.5]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "z"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["s", "Z"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "separate-from-float",
    "description": "A float linked into Vector becomes (f, f, f)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "f", "type": "ShaderNodeMath", "properties": {"operation": "ADD"}, "inputs": {"Value": 0.25, "Value_001": 0}},
        {"name": "s", "type": "ShaderNodeSeparateXYZ"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "z"}}
      ],
      "links": [
        {"from": ["f", "Value"], "to": ["s", "Vector"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["s", "Z"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "separate-from-position",
    "description": "X of Position on a 2x2 grid of size 2",
    "tree": {
      "nodes": [
        {"name": "grid", "type": "GeometryNodeMeshGrid", "inputs": {"Size X": 2, "Size Y": 2, "Vertices X": 2, "Vertices Y": 2}},
        {"name": "pos", "type": "GeometryNodeInputPosition"},
        {"name": "s", "type": "ShaderNodeSeparateXYZ"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "x"}}
      ],
      "links": [
        {"from": ["grid", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["pos", "Position"], "to": ["s", "Vector"]},
        {"from": ["s", "X"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  }
]
```
