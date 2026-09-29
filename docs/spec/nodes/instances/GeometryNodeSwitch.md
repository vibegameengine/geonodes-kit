# Switch (`GeometryNodeSwitch`)

Outputs the `True` input when `Switch` is true, else the `False` input. Works for every socket type
of a Geometry Nodes tree.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Switch` | bool | false | single value or field |
| in | `False` | `input_type` | type default | |
| in | `True` | `input_type` | type default | |
| out | `Output` | `input_type` | | |

## Properties

`input_type`. In a Geometry Nodes tree it can be: `FLOAT`, `INT`, `BOOLEAN`, `VECTOR`, `RGBA`,
`ROTATION`, `MATRIX`, `STRING`, `MENU`, `OBJECT`, `IMAGE`, `GEOMETRY`, `COLLECTION`, `MATERIAL`,
`BUNDLE`, `CLOSURE`, `FONT`, `SOUND`. The other items of the shared socket-type enum (`SHADER`,
`TEXTURE`, `SCENE`, `TEXT`, `MASK`, `INT_VECTOR`) are not available in Geometry Nodes.

The inventory reports `GEOMETRY` as the RNA default, but a node created with `nodes.new` is
initialised to **`FLOAT`**.

Type defaults of `False` / `True`: float 0, int 0, bool false, vector (0,0,0), colour
(0.8, 0.8, 0.8, 1.0), rotation identity (Euler 0,0,0), matrix identity, string "", data-blocks none, geometry empty, bundle / closure empty.

## Behaviour

### Single condition

When `Switch` is a single value (not a field that depends on geometry context), the node forwards
the chosen input **as is**, whatever it is: a single value, a field, a geometry, a data-block, a
bundle. The other input is **not evaluated** at all (lazy evaluation): nodes that only feed the
unchosen input do not run, so they produce no warnings and cost nothing.

A field that does not depend on context (e.g. a constant computed by function nodes) counts as a
single value.

### Field condition

When `Switch` is a field that depends on context (e.g. derived from Index or Position):

- For the field-capable types (`FLOAT`, `INT`, `BOOLEAN`, `VECTOR`, `RGBA`, `ROTATION`, `MATRIX`,
  `STRING`, `MENU`) both inputs are evaluated and the output is a new field that, per element,
  takes the `True` value where the condition is true and the `False` value elsewhere. It is
  evaluated wherever the consuming node evaluates it (same domain and context for condition and
  values).
- For the other types (geometry, data-blocks, bundles, closures) switching per element is impossible.
  The node shows the error "Type cannot be switched by a field" and uses the condition field
  evaluated **once without any geometry context**: context inputs then read their defaults (Index 0,
  Position (0,0,0), attributes their type default). E.g. `Index >= 1` becomes `0 >= 1`, false, so
  the `False` input is output.

## Reference cases

Value cases store the output as the attribute `r` on the vertices of a Mesh Line (1 vertex, or 3 for
the field cases).

| id | expected |
|---|---|
| switch-new-node-float | `r` = 1.5 (new node: FLOAT, Switch false) |
| switch-float-true | 2.5 |
| switch-int | -4 |
| switch-bool | true (the False input) |
| switch-vector | (4, 5, 6) |
| switch-color-default | (0.8, 0.8, 0.8, 1.0) |
| switch-rotation | quaternion of Euler (0,0,0.5) = (cos 0.25, 0, 0, sin 0.25) |
| switch-field-condition | 10, 20, 20 |
| switch-field-values | 0, 1, 2 (the Index field passes through the single-true switch) |
| switch-geometry | the 2x2 grid (4 vertices), no mesh line |
| switch-geometry-field-condition | the 5-vertex mesh line; the node reports "Type cannot be switched by a field" |

```json
[
  {
    "id": "switch-new-node-float",
    "description": "A new Switch is FLOAT and false: outputs the False input",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 1, "Offset": [1, 0, 0]}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {}, "inputs": {"False": 1.5, "True": 2.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["sw", "Output"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "switch-float-true",
    "description": "FLOAT Switch true",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 1, "Offset": [1, 0, 0]}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "FLOAT"}, "inputs": {"Switch": true, "False": 1.5, "True": 2.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["sw", "Output"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "switch-int",
    "description": "INT Switch true",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 1, "Offset": [1, 0, 0]}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "INT"}, "inputs": {"Switch": true, "False": 3, "True": -4}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["sw", "Output"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "switch-bool",
    "description": "BOOLEAN Switch false",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 1, "Offset": [1, 0, 0]}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "BOOLEAN"}, "inputs": {"Switch": false, "False": true, "True": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["sw", "Output"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "switch-vector",
    "description": "VECTOR Switch true",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 1, "Offset": [1, 0, 0]}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "VECTOR"}, "inputs": {"Switch": true, "False": [1, 2, 3], "True": [4, 5, 6]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["sw", "Output"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "switch-color-default",
    "description": "RGBA Switch with unset inputs: the default colour (0.8, 0.8, 0.8, 1)",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 1, "Offset": [1, 0, 0]}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "RGBA"}, "inputs": {"Switch": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_COLOR", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["sw", "Output"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "switch-rotation",
    "description": "ROTATION Switch true with Euler (0,0,0.5)",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 1, "Offset": [1, 0, 0]}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "ROTATION"}, "inputs": {"Switch": true, "True": [0, 0, 0.5]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "QUATERNION", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["sw", "Output"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "switch-field-condition",
    "description": "FLOAT Switch with a field condition Index >= 1 over 3 vertices: 10, 20, 20",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 3, "Offset": [1, 0, 0]}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "cmp", "type": "FunctionNodeCompare", "properties": {"data_type": "INT", "operation": "GREATER_EQUAL"}, "inputs": {"B": 1}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "FLOAT"}, "inputs": {"False": 10, "True": 20}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["idx", "Index"], "to": ["cmp", "A"]},
        {"from": ["cmp", "Result"], "to": ["sw", "Switch"]},
        {"from": ["line", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["sw", "Output"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "switch-field-values",
    "description": "FLOAT Switch with a single true condition and a field value: the True field (Index) passes through",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 3, "Offset": [1, 0, 0]}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "FLOAT"}, "inputs": {"Switch": true, "False": -1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["idx", "Index"], "to": ["sw", "True"]},
        {"from": ["line", "Mesh"], "to": ["store", "Geometry"]},
        {"from": ["sw", "Output"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "switch-geometry",
    "description": "GEOMETRY Switch true: the True geometry (a 2x2 grid) is output, the False one (a mesh line) is not",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 5}},
        {"name": "grid", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "GEOMETRY"}, "inputs": {"Switch": true}}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["sw", "False"]},
        {"from": ["grid", "Mesh"], "to": ["sw", "True"]}
      ],
      "output": ["sw", "Output"]
    }
  },
  {
    "id": "switch-geometry-field-condition",
    "description": "GEOMETRY Switch driven by a field (Index >= 1): error, and the field evaluated without context gives false, so the False geometry is output",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 5}},
        {"name": "grid", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "cmp", "type": "FunctionNodeCompare", "properties": {"data_type": "INT", "operation": "GREATER_EQUAL"}, "inputs": {"B": 1}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "GEOMETRY"}}
      ],
      "links": [
        {"from": ["idx", "Index"], "to": ["cmp", "A"]},
        {"from": ["cmp", "Result"], "to": ["sw", "Switch"]},
        {"from": ["line", "Mesh"], "to": ["sw", "False"]},
        {"from": ["grid", "Mesh"], "to": ["sw", "True"]}
      ],
      "output": ["sw", "Output"]
    }
  }
]
```
