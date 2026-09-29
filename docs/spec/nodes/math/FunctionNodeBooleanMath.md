# Boolean Math (`FunctionNodeBooleanMath`)

Logical operation on one or two booleans. A pure field function (single in, single out; field in,
field out).

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Boolean` | bool | false | first operand, **A** |
| in | `Boolean_001` | bool | false | second operand, **B**; absent for `NOT` |
| out | `Boolean` | bool | | result |

## Properties

`operation`, default `AND`:

| Identifier | Result | A=0,B=0 | A=0,B=1 | A=1,B=0 | A=1,B=1 |
|---|---|---|---|---|---|
| `AND` | `A and B` | 0 | 0 | 0 | 1 |
| `OR` | `A or B` | 0 | 1 | 1 | 1 |
| `NOT` | `not A` (B unused) | 1 | 1 | 0 | 0 |
| `NAND` | `not (A and B)` | 1 | 1 | 1 | 0 |
| `NOR` | `not (A or B)` | 1 | 0 | 0 | 0 |
| `XNOR` | `A == B` | 1 | 0 | 0 | 1 |
| `XOR` | `A != B` | 0 | 1 | 1 | 0 |
| `IMPLY` | `(not A) or B` | 1 | 1 | 0 | 1 |
| `NIMPLY` | `A and not B` | 0 | 0 | 1 | 0 |

Non-boolean links are converted implicitly before the operation: float `x` becomes `x > 0`, int `n`
becomes `n > 0` (negative integers are **false**), vector becomes "not all components zero" (so
`(-1, 0, 0)` is true), colour becomes "luminance > 0". So a float -1 and an int -1 are **false**.

## Reference cases

One case per operation and input combination, id `bool-OP-AB` (`bool-NOT-A` for NOT), result stored
as the boolean point attribute `r` on a one-point point cloud. Expected values: the truth table
above. `bool-float-negative` and `bool-int-negative` link -1 into A of OR with B false: expected
false.

```json
[
  {
    "id": "bool-AND-00",
    "description": "Boolean Math AND with A false, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "AND"}, "inputs": {"Boolean": false, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-AND-01",
    "description": "Boolean Math AND with A false, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "AND"}, "inputs": {"Boolean": false, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-AND-10",
    "description": "Boolean Math AND with A true, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "AND"}, "inputs": {"Boolean": true, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-AND-11",
    "description": "Boolean Math AND with A true, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "AND"}, "inputs": {"Boolean": true, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-OR-00",
    "description": "Boolean Math OR with A false, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "OR"}, "inputs": {"Boolean": false, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-OR-01",
    "description": "Boolean Math OR with A false, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "OR"}, "inputs": {"Boolean": false, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-OR-10",
    "description": "Boolean Math OR with A true, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "OR"}, "inputs": {"Boolean": true, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-OR-11",
    "description": "Boolean Math OR with A true, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "OR"}, "inputs": {"Boolean": true, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NOT-0",
    "description": "Boolean Math NOT with A false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NOT"}, "inputs": {"Boolean": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NOT-1",
    "description": "Boolean Math NOT with A true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NOT"}, "inputs": {"Boolean": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NAND-00",
    "description": "Boolean Math NAND with A false, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NAND"}, "inputs": {"Boolean": false, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NAND-01",
    "description": "Boolean Math NAND with A false, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NAND"}, "inputs": {"Boolean": false, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NAND-10",
    "description": "Boolean Math NAND with A true, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NAND"}, "inputs": {"Boolean": true, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NAND-11",
    "description": "Boolean Math NAND with A true, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NAND"}, "inputs": {"Boolean": true, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NOR-00",
    "description": "Boolean Math NOR with A false, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NOR"}, "inputs": {"Boolean": false, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NOR-01",
    "description": "Boolean Math NOR with A false, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NOR"}, "inputs": {"Boolean": false, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NOR-10",
    "description": "Boolean Math NOR with A true, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NOR"}, "inputs": {"Boolean": true, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NOR-11",
    "description": "Boolean Math NOR with A true, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NOR"}, "inputs": {"Boolean": true, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-XNOR-00",
    "description": "Boolean Math XNOR with A false, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "XNOR"}, "inputs": {"Boolean": false, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-XNOR-01",
    "description": "Boolean Math XNOR with A false, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "XNOR"}, "inputs": {"Boolean": false, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-XNOR-10",
    "description": "Boolean Math XNOR with A true, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "XNOR"}, "inputs": {"Boolean": true, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-XNOR-11",
    "description": "Boolean Math XNOR with A true, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "XNOR"}, "inputs": {"Boolean": true, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-XOR-00",
    "description": "Boolean Math XOR with A false, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "XOR"}, "inputs": {"Boolean": false, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-XOR-01",
    "description": "Boolean Math XOR with A false, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "XOR"}, "inputs": {"Boolean": false, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-XOR-10",
    "description": "Boolean Math XOR with A true, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "XOR"}, "inputs": {"Boolean": true, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-XOR-11",
    "description": "Boolean Math XOR with A true, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "XOR"}, "inputs": {"Boolean": true, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-IMPLY-00",
    "description": "Boolean Math IMPLY with A false, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "IMPLY"}, "inputs": {"Boolean": false, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-IMPLY-01",
    "description": "Boolean Math IMPLY with A false, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "IMPLY"}, "inputs": {"Boolean": false, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-IMPLY-10",
    "description": "Boolean Math IMPLY with A true, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "IMPLY"}, "inputs": {"Boolean": true, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-IMPLY-11",
    "description": "Boolean Math IMPLY with A true, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "IMPLY"}, "inputs": {"Boolean": true, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NIMPLY-00",
    "description": "Boolean Math NIMPLY with A false, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NIMPLY"}, "inputs": {"Boolean": false, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NIMPLY-01",
    "description": "Boolean Math NIMPLY with A false, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NIMPLY"}, "inputs": {"Boolean": false, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NIMPLY-10",
    "description": "Boolean Math NIMPLY with A true, B false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NIMPLY"}, "inputs": {"Boolean": true, "Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-NIMPLY-11",
    "description": "Boolean Math NIMPLY with A true, B true",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "NIMPLY"}, "inputs": {"Boolean": true, "Boolean_001": true}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-float-negative",
    "description": "A float -1 linked into Boolean Math OR converts to false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "f", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}, "inputs": {"Value": 0, "Value_001": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "OR"}, "inputs": {"Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["f", "Value"], "to": ["b", "Boolean"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "bool-int-negative",
    "description": "An int -1 linked into Boolean Math OR converts to false (n > 0 rule)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "f", "type": "FunctionNodeIntegerMath", "properties": {"operation": "SUBTRACT"}, "inputs": {"Value": 0, "Value_001": 1}},
        {"name": "b", "type": "FunctionNodeBooleanMath", "properties": {"operation": "OR"}, "inputs": {"Boolean_001": false}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["f", "Value"], "to": ["b", "Boolean"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["b", "Boolean"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  }
]
```
