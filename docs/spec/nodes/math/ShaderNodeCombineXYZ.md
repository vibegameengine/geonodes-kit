# Combine XYZ (`ShaderNodeCombineXYZ`)

Builds a vector from three floats. A pure field function.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `X` | float | 0.0 | unlinked value limited to [-10000, 10000] |
| in | `Y` | float | 0.0 | same |
| in | `Z` | float | 0.0 | same |
| out | `Vector` | vector (float3) | | `(X, Y, Z)` |

No properties. Values are copied bit-exactly (NaN, inf and -0 pass through). Linked values are not
clamped to the socket range.

## Reference cases

The vector is stored as the `FLOAT_VECTOR` point attribute `v` on a one-point point cloud.

| id | expected `v` |
|---|---|
| combine-basic | (1, -2, 3.5) |
| combine-linked-large | (50000, 0, 0): a linked value is not clamped |

```json
[
  {
    "id": "combine-basic",
    "description": "Combine XYZ of constants",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "v", "type": "ShaderNodeCombineXYZ", "inputs": {"X": 1, "Y": -2, "Z": 3.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "v"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["v", "Vector"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "combine-linked-large",
    "description": "A linked 50000 is not clamped to the socket range",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "f", "type": "ShaderNodeMath", "properties": {"operation": "MULTIPLY"}, "inputs": {"Value": 5000, "Value_001": 10}},
        {"name": "v", "type": "ShaderNodeCombineXYZ"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "v"}}
      ],
      "links": [
        {"from": ["f", "Value"], "to": ["v", "X"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["v", "Vector"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  }
]
```
