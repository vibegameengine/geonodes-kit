# Compare (`FunctionNodeCompare`)

Compares A with B and outputs a boolean. A pure field function: single in, single out; field in,
field out.

## Properties

| Property | Values | Default on a new node |
|---|---|---|
| `data_type` | `FLOAT`, `INT`, `VECTOR`, `RGBA`, `STRING`, `OBJECT`, `IMAGE`, `COLLECTION`, `MATERIAL`, `FONT`, `SOUND` | `FLOAT` |
| `operation` | `LESS_THAN`, `LESS_EQUAL`, `GREATER_THAN`, `GREATER_EQUAL`, `EQUAL`, `NOT_EQUAL`, `BRIGHTER`, `DARKER` | **`GREATER_THAN`** |
| `mode` | `ELEMENT`, `LENGTH`, `AVERAGE`, `DOT_PRODUCT`, `DIRECTION` (only used for `VECTOR`) | `ELEMENT` |

- The inventory reports `EQUAL` as the RNA default of `operation`, but a node created with
  `nodes.new` is initialised to **`GREATER_THAN`**, `FLOAT`, `ELEMENT`.
- The RNA enum for `data_type` lists every socket type, but only the eleven above can be chosen;
  `BOOLEAN`, `ROTATION`, `MATRIX`, `MENU`, `GEOMETRY` and the rest are rejected.
- Allowed operations per type:
  - `FLOAT`, `INT`, `VECTOR`: the six ordering/equality operations (no BRIGHTER/DARKER).
  - `RGBA`: `EQUAL`, `NOT_EQUAL`, `BRIGHTER`, `DARKER`.
  - `STRING` and the data-block types: `EQUAL`, `NOT_EQUAL`.
- Changing `data_type` (through RNA, which includes Python assignment) coerces an operation the new
  type does not allow to `EQUAL`: switching to `RGBA` with an ordering operation, to `STRING` or a
  data-block with anything but EQUAL/NOT_EQUAL, or away from `RGBA` with BRIGHTER/DARKER. Set
  `data_type` **before** `operation` in a reference case.

## Sockets

Inputs appear by data type, mode and operation:

| Identifier | Type | Default | Present when |
|---|---|---|---|
| `A` | the data type | type default (see below) | always |
| `B` | the data type | type default | always |
| `C` | float | 0.9 | `VECTOR` and mode `DOT_PRODUCT` |
| `Angle` | float (angle) | 0.0872665 (5 degrees) | `VECTOR` and mode `DIRECTION` |
| `Epsilon` | float | 0.001 | data type `FLOAT`, `VECTOR` or `RGBA`, and operation `EQUAL` or `NOT_EQUAL` |
| out `Result` | bool | | always |

Type defaults of A and B: float 0, int 0, vector (0, 0, 0), color (0.8, 0.8, 0.8, 1.0), string "",
data-block none.

Inputs of another type connected by a link go through the implicit conversions of Geometry Nodes
(e.g. a float into an `INT` compare is truncated toward zero, `2.7 -> 2`, `-2.7 -> -2`; a color into
a float compare becomes its luminance; a vector into a float compare becomes the component average).

## FLOAT

| Operation | Result |
|---|---|
| `LESS_THAN` | `A < B` |
| `LESS_EQUAL` | `A <= B` |
| `GREATER_THAN` | `A > B` |
| `GREATER_EQUAL` | `A >= B` |
| `EQUAL` | `|A - B| <= Epsilon` |
| `NOT_EQUAL` | `|A - B| > Epsilon` |

- The epsilon is used exactly as given: no floor (unlike the Math node's Compare), so with
  `Epsilon = 0` equality is exact, and with a **negative** epsilon `EQUAL` is always false and
  `NOT_EQUAL` is true even for identical values.
- NaN: all six operations are false, including `NOT_EQUAL` (`|NaN| > eps` is false).
- `inf` vs `inf`: `|inf - inf|` is NaN, so `EQUAL` is **false** and `NOT_EQUAL` false.

## INT

Exact integer comparisons; `EQUAL` is `A == B`, `NOT_EQUAL` is `A != B`. No epsilon socket.

## VECTOR

The `mode` chooses what is compared. `len(v) = sqrt(v.x^2 + v.y^2 + v.z^2)`,
`avg(v) = (v.x + v.y + v.z) / 3`, `dot(a, b) = a.x*b.x + a.y*b.y + a.z*b.z`, `angle(a, b)` as
defined below.

| Mode | ordering operations (`<`, `<=`, `>`, `>=`) | `EQUAL` | `NOT_EQUAL` |
|---|---|---|---|
| `ELEMENT` | the relation must hold for **all three** components (`A < B` iff `A.x < B.x and A.y < B.y and A.z < B.z`) | every component `|A.i - B.i| <= Epsilon` | **any** component `|A.i - B.i| > Epsilon` |
| `LENGTH` | `len(A) op len(B)` | `|len(A) - len(B)| <= Epsilon` | `|len(A) - len(B)| > Epsilon` |
| `AVERAGE` | `avg(A) op avg(B)` | `|avg(A) - avg(B)| <= Epsilon` | `|avg(A) - avg(B)| > Epsilon` |
| `DOT_PRODUCT` | `dot(A, B) op C` | `|dot(A, B) - C| <= Epsilon` | `|dot(A, B) - C| >= Epsilon` **(note `>=`)** |
| `DIRECTION` | `angle(A, B) op Angle` | `|angle(A, B) - Angle| <= Epsilon` | `|angle(A, B) - Angle| > Epsilon` |

- Element-wise ordering is not the negation of the opposite ordering: `(0,0,0) < (1,1,0)` is false and
  `(0,0,0) >= (1,1,0)` is false too.
- `DOT_PRODUCT` + `NOT_EQUAL` uses `>=`, so when `|dot - C|` equals the epsilon exactly, **both EQUAL
  and NOT_EQUAL are true** (e.g. `A = B = (1,0,0)`, `C = 1`, `Epsilon = 0`).

### angle(A, B)

1. Normalize both vectors. A vector whose squared length is `<= 1e-35` (or contains NaN) normalizes to
   the **zero vector**.
2. With unit (or zero) vectors `a`, `b`: if `dot(a, b) >= 0`, `angle = 2 * asin(|a - b| / 2)`;
   otherwise `angle = pi - 2 * asin(|a + b| / 2)`. `asin` clamps its argument to [-1, 1]. This is the
   numerically stable form of `acos(dot(a, b))` and returns values in [0, pi].
3. Consequences for zero vectors: both zero gives angle 0; exactly one zero gives
   `2 * asin(0.5) = pi / 3 = 1.0471976`.

## RGBA

| Operation | Result |
|---|---|
| `EQUAL` | `|A.r - B.r| <= eps` and same for g and b; **alpha is ignored** |
| `NOT_EQUAL` | any of r, g, b differs by more than `eps`; alpha ignored |
| `BRIGHTER` | `luminance(A) > luminance(B)` |
| `DARKER` | `luminance(A) < luminance(B)` |

`luminance(c) = Kr * c.r + Kg * c.g + Kb * c.b` with the scene-linear luma coefficients of Blender's
colour management. With the default colour configuration these are **`Kr = 0.2126, Kg = 0.7152,
Kb = 0.0722`** (the Rec.709 luma weights as stored in the configuration, not the more precise
0.2126729 / 0.7151522 / 0.0721750 derived from the primaries). Captured Blender 5.2.2 output agrees:
pure red is *not* brighter than grey 0.2126 and pure blue is *not* darker than grey 0.0722, which
rules out the more precise values. Alpha is ignored. The same luminance is used by the implicit
color-to-float conversion.

## STRING

`EQUAL` is exact byte-wise equality (case-sensitive, no Unicode normalisation); `NOT_EQUAL` is its
negation.

## Data blocks (`OBJECT`, `IMAGE`, `COLLECTION`, `MATERIAL`, `FONT`, `SOUND`)

`EQUAL` is true when both inputs refer to the same original data-block (identity, not name or
content); two empty inputs are equal. `NOT_EQUAL` is the negation.

## Reference cases

Each case stores `Result` as the boolean point attribute `r` on a one-point point cloud. Vector,
colour and string inputs are set directly on A and B. Properties are listed with `data_type` first
except in `compare-coerce-op`, which deliberately sets the operation first. Expected values are
predictions:

| id | expected |
|---|---|
| compare-new-node-default | false (operation is GREATER_THAN) |
| compare-float-eq-eps | true |
| compare-float-eq-neg-eps | false |
| compare-float-ne-neg-eps | true |
| compare-float-nan-eq | false |
| compare-float-nan-ne | false |
| compare-int-le | true |
| compare-int-from-float-link | true (2.7 truncates to 2) |
| compare-vec-element-lt | false |
| compare-vec-element-ge | false |
| compare-vec-element-ne | true |
| compare-vec-length-eq | true |
| compare-vec-average-eq | true |
| compare-vec-dot-gt | true |
| compare-vec-dot-eq-at-eps | true |
| compare-vec-dot-ne-at-eps | **true** |
| compare-vec-dir-zero | true |
| compare-vec-dir-both-zero | true |
| compare-vec-dir-gt | true |
| compare-vec-dir-opposite | true |
| compare-color-eq-alpha | true |
| compare-color-brighter | true |
| compare-color-luma-r-at | false (captured) |
| compare-color-luma-r-below | true |
| compare-color-luma-r-hi | false |
| compare-color-luma-g-lo | true |
| compare-color-luma-g-hi | false |
| compare-color-luma-b-at | false (captured) |
| compare-color-luma-b-above | true |
| compare-color-luma-b-hi | false |
| compare-string-case | false |
| compare-coerce-op | true (operation reads back EQUAL; default colours are equal) |

A grey `(g, g, g)` has luminance `g` because the coefficients sum to 1, so each lo/hi pair brackets
one coefficient.

```json
[
  {
    "id": "compare-new-node-default",
    "description": "Compare with no properties set: a new node is GREATER_THAN, 0 > 0 is false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {}, "inputs": {}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-float-eq-eps",
    "description": "FLOAT EQUAL within the default epsilon",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "FLOAT", "operation": "EQUAL"}, "inputs": {"A": 1, "B": 1.0005, "Epsilon": 0.001}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-float-eq-neg-eps",
    "description": "FLOAT EQUAL with a negative epsilon is false even for equal values",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "FLOAT", "operation": "EQUAL"}, "inputs": {"A": 1, "B": 1, "Epsilon": -1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-float-ne-neg-eps",
    "description": "FLOAT NOT_EQUAL with a negative epsilon is true for equal values",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "FLOAT", "operation": "NOT_EQUAL"}, "inputs": {"A": 1, "B": 1, "Epsilon": -1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-float-nan-eq",
    "description": "FLOAT EQUAL with NaN is false",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "FLOAT", "operation": "EQUAL"}, "inputs": {"B": 0, "Epsilon": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["c", "A"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-float-nan-ne",
    "description": "FLOAT NOT_EQUAL with NaN is false too",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "FLOAT", "operation": "NOT_EQUAL"}, "inputs": {"B": 0, "Epsilon": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["c", "A"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-int-le",
    "description": "INT LESS_EQUAL on equal values",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "INT", "operation": "LESS_EQUAL"}, "inputs": {"A": 3, "B": 3}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-int-from-float-link",
    "description": "A float 2.7 linked into an INT compare is truncated to 2",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "f", "type": "ShaderNodeMath", "properties": {"operation": "ADD"}, "inputs": {"Value": 2.2, "Value_001": 0.5}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "INT", "operation": "EQUAL"}, "inputs": {"B": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["f", "Value"], "to": ["c", "A"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-element-lt",
    "description": "Element-wise LESS_THAN needs all three components",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "ELEMENT", "operation": "LESS_THAN"}, "inputs": {"A": [0, 0, 0], "B": [1, 1, 0]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-element-ge",
    "description": "Element-wise GREATER_EQUAL is not the negation of LESS_THAN",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "ELEMENT", "operation": "GREATER_EQUAL"}, "inputs": {"A": [0, 0, 0], "B": [1, 1, 0]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-element-ne",
    "description": "Element-wise NOT_EQUAL when any component differs",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "ELEMENT", "operation": "NOT_EQUAL"}, "inputs": {"A": [0, 0, 0], "B": [0, 0, 0.5], "Epsilon": 0.1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-length-eq",
    "description": "LENGTH EQUAL of (3,4,0) and (0,0,5)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "LENGTH", "operation": "EQUAL"}, "inputs": {"A": [3, 4, 0], "B": [0, 0, 5], "Epsilon": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-average-eq",
    "description": "AVERAGE EQUAL of (3,0,0) and (1,1,1)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "AVERAGE", "operation": "EQUAL"}, "inputs": {"A": [3, 0, 0], "B": [1, 1, 1], "Epsilon": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-dot-gt",
    "description": "DOT_PRODUCT GREATER_THAN C",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "DOT_PRODUCT", "operation": "GREATER_THAN"}, "inputs": {"A": [1, 0, 0], "B": [0.95, 0.31, 0], "C": 0.9}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-dot-eq-at-eps",
    "description": "DOT_PRODUCT EQUAL at exactly the epsilon",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "DOT_PRODUCT", "operation": "EQUAL"}, "inputs": {"A": [1, 0, 0], "B": [1, 0, 0], "C": 1.0, "Epsilon": 0.0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-dot-ne-at-eps",
    "description": "DOT_PRODUCT NOT_EQUAL uses >= so it is also true at the epsilon",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "DOT_PRODUCT", "operation": "NOT_EQUAL"}, "inputs": {"A": [1, 0, 0], "B": [1, 0, 0], "C": 1.0, "Epsilon": 0.0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-dir-zero",
    "description": "DIRECTION with one zero vector: the angle is pi/3",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "DIRECTION", "operation": "EQUAL"}, "inputs": {"A": [1, 0, 0], "B": [0, 0, 0], "Angle": 1.0471976, "Epsilon": 0.001}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-dir-both-zero",
    "description": "DIRECTION with two zero vectors: the angle is 0",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "DIRECTION", "operation": "EQUAL"}, "inputs": {"A": [0, 0, 0], "B": [0, 0, 0], "Angle": 0, "Epsilon": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-dir-gt",
    "description": "DIRECTION GREATER_THAN for perpendicular vectors",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "DIRECTION", "operation": "GREATER_THAN"}, "inputs": {"A": [1, 0, 0], "B": [0, 1, 0], "Angle": 1.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-vec-dir-opposite",
    "description": "DIRECTION of opposite vectors is pi",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "VECTOR", "mode": "DIRECTION", "operation": "EQUAL"}, "inputs": {"A": [1, 0, 0], "B": [-2, 0, 0], "Angle": 3.1415927, "Epsilon": 1e-06}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-color-eq-alpha",
    "description": "RGBA EQUAL ignores alpha",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "RGBA", "operation": "EQUAL"}, "inputs": {"A": [1, 0, 0, 1], "B": [1, 0, 0, 0], "Epsilon": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-color-brighter",
    "description": "Green is brighter than red",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "RGBA", "operation": "BRIGHTER"}, "inputs": {"A": [0, 1, 0, 1], "B": [1, 0, 0, 1]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-color-luma-r-at",
    "description": "Red is not brighter than grey 0.2126: Kr is 0.2126",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "RGBA", "operation": "BRIGHTER"}, "inputs": {"A": [1, 0, 0, 1], "B": [0.2126, 0.2126, 0.2126, 1]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-color-luma-r-below",
    "description": "Red is brighter than grey 0.2125",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "RGBA", "operation": "BRIGHTER"}, "inputs": {"A": [1, 0, 0, 1], "B": [0.2125, 0.2125, 0.2125, 1]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-color-luma-r-hi",
    "description": "Red is not brighter than grey 0.2128",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "RGBA", "operation": "BRIGHTER"}, "inputs": {"A": [1, 0, 0, 1], "B": [0.2128, 0.2128, 0.2128, 1]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-color-luma-g-lo",
    "description": "Green is brighter than grey 0.7151",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "RGBA", "operation": "BRIGHTER"}, "inputs": {"A": [0, 1, 0, 1], "B": [0.7151, 0.7151, 0.7151, 1]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-color-luma-g-hi",
    "description": "Green is not brighter than grey 0.7153",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "RGBA", "operation": "BRIGHTER"}, "inputs": {"A": [0, 1, 0, 1], "B": [0.7153, 0.7153, 0.7153, 1]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-color-luma-b-at",
    "description": "Blue is not darker than grey 0.0722: Kb is 0.0722",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "RGBA", "operation": "DARKER"}, "inputs": {"A": [0, 0, 1, 1], "B": [0.0722, 0.0722, 0.0722, 1]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-color-luma-b-above",
    "description": "Blue is darker than grey 0.0723",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "RGBA", "operation": "DARKER"}, "inputs": {"A": [0, 0, 1, 1], "B": [0.0723, 0.0723, 0.0723, 1]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-color-luma-b-hi",
    "description": "Blue is not darker than grey 0.0721",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "RGBA", "operation": "DARKER"}, "inputs": {"A": [0, 0, 1, 1], "B": [0.0721, 0.0721, 0.0721, 1]}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-string-case",
    "description": "STRING EQUAL is case-sensitive",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"data_type": "STRING", "operation": "EQUAL"}, "inputs": {"A": "abc", "B": "ABC"}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "compare-coerce-op",
    "description": "Operation LESS_THAN set before switching data_type to RGBA is coerced to EQUAL",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "c", "type": "FunctionNodeCompare", "properties": {"operation": "LESS_THAN", "data_type": "RGBA"}, "inputs": {}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["c", "Result"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  }
]
```
