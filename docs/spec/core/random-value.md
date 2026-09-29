# Random Value

Node **Random Value** (`FunctionNodeRandomValue`). A pure per-element function: the same ID, Seed and
bounds always give the same bits. Everything below was checked **bit for bit** against Blender 5.2.2
(Windows x86-64 build, headless, factory startup): an independent implementation written from this
description reproduced all 14 captured Float/Integer/Vector/Boolean cases exactly (12 elements each).

## Sockets and property

Property **Data Type**: Float (default), Integer, Vector, Boolean.

| Data Type | Inputs (identifier: default) | Output |
|---|---|---|
| Float | `Min`: 0.0, `Max`: 1.0, `ID`, `Seed`: 0 | `Value` Float |
| Integer | `Min`: 0, `Max`: 100, `ID`, `Seed`: 0 | `Value` Integer |
| Vector | `Min`: (0,0,0), `Max`: (1,1,1), `ID`, `Seed`: 0 | `Value` Vector |
| Boolean | `Probability`: 0.5 (UI range 0–1, not clamped in evaluation), `ID`, `Seed`: 0 | `Value` Boolean |

`ID` is an Integer input whose unlinked value is the implicit field **ID / Index**. All inputs accept
fields; the output is a field whenever any input is a context-dependent field (the unlinked ID always
is), otherwise a single value.

## The ID / Index input

When `ID` is unlinked, per element:

- on the **Point** domain (mesh vertices, curve points, point-cloud points, grease-pencil points) and
  on the **Instance** domain: the component's attribute named `id`, read as a 32-bit int on that
  domain, if the component has an attribute of that name; otherwise the element index;
- on every other domain (Edge, Face, Face Corner, Curve, Layer): always the element index, even when an
  `id` attribute exists (verified: Integer Random Value on the Face domain of a grid that had `id` on
  its points gave the same values as ID = face index).

Reading `id` uses the normal attribute read, so an `id` of another type is converted to int
(truncation for floats) and an `id` on another domain of a mesh is interpolated to the evaluated
domain (see `attributes.md`).

If the Random Value output (with ID unlinked) ends in an input that accepts only single values, that
input receives the type default (0 / false / zero vector), not a random number (verified: Integer
Random Value with Min = Max = 5 linked to Points Count gave no points). When ID and Seed are single
values (e.g. ID linked to an Integer node) the output is a single value computed as below (verified:
ID 5, Seed 0, Integer 0..20 → Count 15).

## Hash

All data types use **Bob Jenkins' lookup3 hash** (public domain, "lookup3.c", published at
burtleburtle.net) in its fixed-length form for 2 or 3 input words, on unsigned 32-bit arithmetic with
wrap-around:

1. Three state words `a`, `b`, `c` all start at `0xDEADBEEF + 4·n + 13`, where `n` is the number of
   input words: `0xDEADBF04` for two words, `0xDEADBF08` for three words.
2. Input words are added: the first to `a`, the second to `b`, the third (if any) to `c`.
3. lookup3's **final** mixing step is applied once (no preceding "mix" step for up to three words).
   Its seven stages each xor one word with another and subtract a left-rotation of it; the rotation
   amounts are 14, 11, 25, 16, 4, 14, 24 in that order — exactly the published `final()` macro.
4. The hash is the final `c`.

Signed integers (ID, Seed, Min, Max) enter as their 32-bit two's-complement bit patterns (−1 is
`0xFFFFFFFF`). Integer ID values that were produced by wrapping arithmetic are used as wrapped
(verified with ID = Index × 123456789).

Test vectors (independently reproduced, consistent with the captured node output):

| Words | Hash |
|---|---|
| (0, 0) | `0xDC3D74F9` |
| (0, 1) | `0xD7AF75CF` |
| (1, 0) | `0x4B85F272` |
| (12345, 0) | `0xB348092F` |
| (0, 12345) | `0x7F4DF706` |
| (0, 0, 0) | `0x9C6EEDFB` |
| (0, 0, 1) | `0x2F9225BA` |
| (0, 0, 2) | `0x0A9308CD` |
| (0, 1, 0) | `0xD1C42CD4` |

### Hash to a float in [0, 1]

`u(h)` = the 32-bit unsigned hash converted to the **nearest 32-bit float** (round to nearest, ties
to even), then divided by the 32-bit float nearest to 4294967295, which is exactly 4294967296 = 2³².
The division is therefore exact: `u(h) = round_f32(h) · 2⁻³²`.

- Both ends are reachable: `h = 0` gives 0.0; every `h ≥ 4294967168` (0xFFFFFF80) rounds up to 2³² and
  gives exactly **1.0**.
- Example: `u(0xDC3D74F9)` = 0.86031276 (bits `0x3F5C3D75`).

## Per data type

Throughout, "float arithmetic" means IEEE-754 binary32 with every operation rounded separately
(no fused multiply-add; the captured Windows x86-64 build matches this).

### Float

- `t = u(hash(Seed, ID))` — note the word order: **Seed first, ID second**.
- `Value = t · (Max − Min) + Min`, in float arithmetic: first `d = Max − Min`, then `p = t · d`, then
  `p + Min`.
- `Min > Max` is not special: the same formula runs and the result lies between Max and Min (verified
  with Min 5, Max −1).
- The result can equal Max exactly (when `t = 1`) and Min exactly (when `t = 0`); it can also round
  onto either bound.

### Vector

For component `i` = 0 (X), 1 (Y), 2 (Z):

- `t_i = u(hash(Seed, ID, i))` — three words: Seed, ID, component index.
- `Value_i = t_i · (Max_i − Min_i) + Min_i` in float arithmetic, per component, as for Float.

### Integer

1. If `Min > Max`, swap them (verified with Min 10, Max 3: results in 3..10).
2. `h = hash(ID, Seed)` — note the word order: **ID first, Seed second** (the reverse of Float).
3. `range = (Max − Min + 1)` computed on the unsigned 32-bit bit patterns with wrap-around.
4. If `range = 0` (only when Min = −2147483648 and Max = 2147483647): `offset = h`;
   otherwise `offset = h mod range` (unsigned remainder).
5. `Value = Min + offset`, on unsigned 32-bit patterns with wrap-around, reinterpreted as signed.

Both bounds are inclusive. Verified: Min 0, Max 100, Seed 0, IDs 0..11 →
`53, 11, 80, 70, 1, 26, 82, 35, 46, 68, 81, 43`; the full range with Seed 1 gives the hash itself
reinterpreted as signed (`1471116751, −1110382685, −109663456, 843101417, …`); Min −50, Max −40 with
negative IDs stays within −50..−40.

### Boolean

- `t = u(hash(ID, Seed))` — **ID first, Seed second**, like Integer.
- `Value = (t ≤ Probability)`, comparing the float `t` with the float Probability.
- Consequences: Probability ≥ 1 → always true; Probability < 0 → always false; Probability = 0 → true
  only where `h = 0`.
- Verified: Probability 0.5, Seed 0, IDs 0..11 → `F,T,T,F,F,F,F,F,T,F,F,F`; Probability 0.3, Seed 2 →
  `F,T,F,F,F,F,F,T,F,F,F,F`.

## Worked values (Float, Min 0, Max 1, Seed 0, ID = 0..5)

| ID | Value | Bits |
|---|---|---|
| 0 | 0.860312760 | `0x3F5C3D75` |
| 1 | 0.842521071 | `0x3F57AF76` |
| 2 | 0.974821210 | `0x3F798DE2` |
| 3 | 0.995642364 | `0x3F7EE26B` |
| 4 | 0.538894355 | `0x3F09F4FB` |
| 5 | 0.583045661 | `0x3F15427B` |

Float, Min −2.5, Max 7.25, Seed 12345, ID = 0..5: 4.32809973, 2.25076389, 5.03567791, 6.31369972,
2.13593102, 4.60413170.

Vector, default bounds, Seed 0: ID 0 → (0.611067653, 0.185823783, 0.0413060673); ID 1 →
(0.819399655, 0.607844830, 0.434176505).

## Edge cases

- The output only depends on (ID, Seed, bounds); element count, domain and geometry do not matter
  beyond choosing the ID.
- Seed is a plain 32-bit integer; negative seeds work as their bit patterns (verified Seed −3).
- Float bounds that are NaN or infinite propagate through the formula by IEEE rules (not captured).
- The Data Type property's enumeration (as listed by the Python API) contains more attribute types,
  but the node only defines sockets and behaviour for the four above; other values are unsupported.

## Reference cases

Cases are in the format of `reference/cases/cases.json` and run with `tools/blender/cases.py`;
socket identifiers are those of `coverage/nodes-5.2.2.json`. Links are created in the listed order,
so for a multi-input socket (Join Geometry) **the last listed link ends up first**. Every case below
was captured with Blender 5.2.2 while writing this spec; the "Blender result" column is what the
capture contained (attributes not mentioned are the node's usual output). The exporter reports an
empty `mesh` entry for results that have no mesh; ignore it.

| Case | Blender result |
|---|---|
| `rv-float-default` | `0x3F5C3D75, 0x3F57AF76, 0x3F798DE2, 0x3F7EE26B, 0x3F09F4FB, 0x3F15427B, …` (bit-identical to this spec) |
| `rv-float-range-seed` | bit-identical to the independent implementation of this spec |
| `rv-float-negative-id` | bit-identical to the independent implementation of this spec |
| `rv-float-big-id` | bit-identical to the independent implementation of this spec |
| `rv-float-id-attribute` | element k equals the rv-float-default value for ID 7k (bit-identical to this spec) |
| `rv-float-min-above-max` | bit-identical to the independent implementation of this spec |
| `rv-int-default` | `53, 11, 80, 70, 1, 26, 82, 35, 46, 68, 81, 43` |
| `rv-int-swapped` | `4, 4, 7, 4, 10, 4, 4, 3, 10, 3, 9, 9` |
| `rv-int-full-range` | bit-identical to the independent implementation of this spec |
| `rv-int-negative` | bit-identical to the independent implementation of this spec |
| `rv-vector-default` | bit-identical to the independent implementation of this spec |
| `rv-vector-range` | bit-identical to the independent implementation of this spec |
| `rv-bool-default` | `F,T,T,F,F,F,F,F,T,F,F,F` |
| `rv-bool-probability` | `F,T,F,F,F,F,F,T,F,F,F,F` |
| `rv-face-domain-ignores-id` | `r` on Face `[53, 11, 80, 70]` — face indices, the `id` attribute is ignored |
| `rv-into-single-context` | no points (Count received 0) |
| `rv-into-single-constant` | 15 points |

```json
[
  {
    "id": "rv-float-default",
    "description": "Float, Min 0, Max 1, Seed 0, ID = index (no id attribute), 12 points",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "FLOAT"}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-float-range-seed",
    "description": "Float, Min -2.5, Max 7.25, Seed 12345",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "FLOAT"}, "inputs": {"Min": -2.5, "Max": 7.25, "Seed": 12345}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-float-negative-id",
    "description": "Float, Seed -3, ID = Index - 6 (negative ids)",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "FLOAT"}, "inputs": {"Seed": -3}},
        {"name": "idx_rv", "type": "GeometryNodeInputIndex"},
        {"name": "sub6", "type": "FunctionNodeIntegerMath", "properties": {"operation": "SUBTRACT"}, "inputs": {"Value_001": 6}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["idx_rv", "Index"], "to": ["sub6", "Value"]},
        {"from": ["sub6", "Value"], "to": ["rv", "ID"]},
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-float-big-id",
    "description": "Float, Seed 7, ID = Index * 123456789 (wrapping int multiply)",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "FLOAT"}, "inputs": {"Seed": 7}},
        {"name": "idx_rv", "type": "GeometryNodeInputIndex"},
        {"name": "big", "type": "FunctionNodeIntegerMath", "properties": {"operation": "MULTIPLY"}, "inputs": {"Value_001": 123456789}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["idx_rv", "Index"], "to": ["big", "Value"]},
        {"from": ["big", "Value"], "to": ["rv", "ID"]},
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-float-id-attribute",
    "description": "Float with an id attribute = Index * 7 on the points: the attribute replaces the index",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "idx_id", "type": "GeometryNodeInputIndex"},
        {"name": "mul7", "type": "FunctionNodeIntegerMath", "properties": {"operation": "MULTIPLY"}, "inputs": {"Value_001": 7}},
        {"name": "sid", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "id"}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "FLOAT"}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["sid", "Geometry"]},
        {"from": ["idx_id", "Index"], "to": ["mul7", "Value"]},
        {"from": ["mul7", "Value"], "to": ["sid", "Value"]},
        {"from": ["sid", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-float-min-above-max",
    "description": "Float, Min 5, Max -1: no swap, the formula runs as is",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "FLOAT"}, "inputs": {"Min": 5.0, "Max": -1.0}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-int-default",
    "description": "Integer, Min 0, Max 100, Seed 0",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "INT"}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-int-swapped",
    "description": "Integer, Min 10, Max 3, Seed 4: bounds swapped, both inclusive",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "INT"}, "inputs": {"Min": 10, "Max": 3, "Seed": 4}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-int-full-range",
    "description": "Integer, Min -2147483648, Max 2147483647, Seed 1: range wraps to 0, hash used directly",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "INT"}, "inputs": {"Min": -2147483648, "Max": 2147483647, "Seed": 1}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-int-negative",
    "description": "Integer, Min -50, Max -40, ID = Index - 6",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "INT"}, "inputs": {"Min": -50, "Max": -40}},
        {"name": "idx_rv", "type": "GeometryNodeInputIndex"},
        {"name": "sub6", "type": "FunctionNodeIntegerMath", "properties": {"operation": "SUBTRACT"}, "inputs": {"Value_001": 6}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["idx_rv", "Index"], "to": ["sub6", "Value"]},
        {"from": ["sub6", "Value"], "to": ["rv", "ID"]},
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-vector-default",
    "description": "Vector, Min (0,0,0), Max (1,1,1), Seed 0",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "FLOAT_VECTOR"}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-vector-range",
    "description": "Vector, Min (-1,0,2), Max (1,5,3), Seed 9",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "FLOAT_VECTOR"}, "inputs": {"Min": [-1, 0, 2], "Max": [1, 5, 3], "Seed": 9}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-bool-default",
    "description": "Boolean, Probability 0.5, Seed 0",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "BOOLEAN"}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-bool-probability",
    "description": "Boolean, Probability 0.3, Seed 2",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 12}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "BOOLEAN"}, "inputs": {"Probability": 0.3, "Seed": 2}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "BOOLEAN", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-face-domain-ignores-id",
    "description": "Integer on the Face domain of a Grid 3x3 that has an id attribute on points: the face index is used",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 3, "Vertices Y": 3}},
        {"name": "idx_id", "type": "GeometryNodeInputIndex"},
        {"name": "mul7", "type": "FunctionNodeIntegerMath", "properties": {"operation": "MULTIPLY"}, "inputs": {"Value_001": 7}},
        {"name": "sid", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "id"}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "INT"}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "FACE"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["p", "Mesh"], "to": ["sid", "Geometry"]},
        {"from": ["idx_id", "Index"], "to": ["mul7", "Value"]},
        {"from": ["mul7", "Value"], "to": ["sid", "Value"]},
        {"from": ["sid", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["rv", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "rv-into-single-context",
    "description": "Random Value (implicit ID) linked to Points Count: the field depends on context, Count gets 0",
    "tree": {
      "nodes": [
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "INT"}, "inputs": {"Min": 5, "Max": 5}},
        {"name": "p", "type": "GeometryNodePoints"}
      ],
      "links": [
        {"from": ["rv", "Value"], "to": ["p", "Count"]}
      ],
      "output": ["p", "Geometry"]
    }
  },
  {
    "id": "rv-into-single-constant",
    "description": "Random Value with ID linked to Integer 5: a constant; Points Count = hash-derived value in 0..20",
    "tree": {
      "nodes": [
        {"name": "int", "type": "FunctionNodeInputInt", "properties": {"integer": 5}},
        {"name": "rv", "type": "FunctionNodeRandomValue", "properties": {"data_type": "INT"}, "inputs": {"Min": 0, "Max": 20}},
        {"name": "p", "type": "GeometryNodePoints"}
      ],
      "links": [
        {"from": ["int", "Integer"], "to": ["rv", "ID"]},
        {"from": ["rv", "Value"], "to": ["p", "Count"]}
      ],
      "output": ["p", "Geometry"]
    }
  }
]
```
