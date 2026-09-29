# Fields

A field is a function that produces one value per element of some geometry domain. It is not a
value yet: it becomes values only when a geometry node evaluates it on a concrete geometry, domain and
element range. Statements marked **verified** were observed in Blender 5.2.2; the rest is read from
the source and pinned by the reference cases.

## What flows along a data socket

A data socket (Float, Integer, Boolean, Vector, Color, Rotation, Matrix, String, Menu) carries one of:

- a **single value** — a constant;
- a **field** — an expression tree whose leaves are *field inputs* and constants and whose inner
  nodes are *operations* (pure functions of their inputs);
- (outside this spec: volume grids and lists.)

A single value used where a field is expected is a **constant field**: it evaluates to the same value
for every element. Evaluating an operation on single values gives exactly the same bits as evaluating
the same operation element by element inside a field; an implementation may therefore fold constant
sub-expressions at any time.

### Field inputs

A field input produces values from the evaluation context (geometry + domain), not from sockets:

| Field input | Value per element |
|---|---|
| Index | the element's index within the evaluated domain, 0 … size − 1 |
| ID | the `id` attribute (int) when the domain is Point or Instance and the component has `id`; otherwise Index (see `random-value.md`) |
| Position | the `position` attribute read on the evaluated domain (interpolated when the domain is not Point); on the Instance domain, the instance translation |
| Named Attribute | the named attribute read on the evaluated domain with the requested type |
| Normal, Radius, Handle Positions, Instance Transform, … | node-specific readers of geometry data |
| anonymous attribute readers | outputs of nodes that create attributes (see below) |

A field **depends on its context** when any leaf is a field input. A field without field inputs is a
constant.

### Operations

Function nodes (Math, Vector Math, Compare, Random Value, Combine XYZ, …) are operations. A function
node:

- when all its inputs are single values, produces single values;
- when any input is a context-dependent field, produces fields (its outputs are new operation nodes
  over the input fields; each output of a multi-output node is one output of the same operation).

Implicit type conversions on links are operations too (see `attributes.md`).

## Evaluating a field

A geometry node that has field inputs evaluates them **on its own input geometry**, per component, on
a domain chosen by the node:

1. For each component the node supports, build a context: that component, one domain, and for
   grease pencil also one layer.
2. The element range is `0 … domain size − 1`.
3. Every field input leaf reads from that context. Every operation is applied element by element.
4. Different components are evaluated separately: Index restarts at 0 in every component (and in
   every grease pencil layer).

Rules that follow:

- **The geometry is the one entering the node that evaluates the field, not the one near the field
  input node.** A Position node placed next to a Grid does not read that grid; it reads whatever
  geometry reaches the node where the field ends up. The same field wired into two nodes that receive
  different geometries yields different values.
- **All fields of one node are evaluated on the input state of the geometry**, before the node writes
  anything. E.g. Set Position's Offset reads the old positions even though Position is being written.
- A field connected through a node group is evaluated where it finally meets a geometry node; group
  boundaries do not bind fields to geometry.
- Nodes that take their own source geometry (Sample Index, Sample Nearest, Raycast, Attribute
  Statistic, Evaluate at Index, Evaluate on Domain, …) evaluate the fields connected to their own
  value inputs on *their* geometry and domain; their outputs are new fields for the outer context.
- When a Sample-style node has to pick one component of its source geometry for a domain, it takes the
  first component, in the order Mesh, Point cloud, Curves, Instances, Grease pencil, that has a
  non-zero size on that domain.

### Field input with no matching data

If a field input cannot produce values in the context (attribute missing, wrong component kind,
unsupported domain, no geometry at all), it produces the **default value of its type** for every
element: 0, false, zero vector, (0, 0, 0, 0) colour, identity rotation, all-zero matrix, empty string.
The same holds for a whole field that reaches a context of the wrong kind.

### Domain of evaluation

The domain is chosen by the node (a Domain property, or fixed: Set Position works on Point, Set Shade
Smooth on Face or Edge, Instance on Points on Point, instance operations on Instance). A field input
whose data lives on another domain is read through domain interpolation (`attributes.md`).

Some nodes offer "Auto" domain choice; they pick the domain from the field's attribute inputs. That
rule belongs to those nodes' specs.

### Selection

Many geometry nodes have a Boolean **Selection** field input.

- The selection is evaluated first, on the same context, and converted to the set of element indices
  where it is true (a Float or other linked type is converted to Boolean first: `> 0` rule, see
  `attributes.md`).
- The other fields of the node are evaluated **only for selected elements**; unselected elements keep
  their previous data (Set nodes) or are left out (nodes that create or delete elements) — node
  specific.
- An unlinked Selection defaults to `true` (a constant): every element is selected.

## Single values meeting single-only inputs

Some inputs accept only single values (e.g. Grid's Vertices X, Points' Count, Switch's condition for
non-field types, Mesh Line's Count). When a field arrives there:

- if the field does **not** depend on context, it is evaluated once and its value is used;
- if it **does** depend on context, the input receives the **default value of its type** — not the
  socket's stored value and not the value at element 0. Verified: `Index + 3` linked to a Grid's
  Vertices X gave an empty mesh (Vertices X = 0), although the socket's own value is 3.

The editor draws such links red; evaluation still happens as described.

## Anonymous attributes

Nodes that create data per element and expose it as a field output (Capture Attribute; Extrude Mesh
Top / Side; Distribute Points on Faces Normal / Rotation; Duplicate Elements Duplicate Index; Curve to
Points Tangent / Normal / Rotation; and others) store that data on the geometry they output as a
hidden **anonymous attribute** and output a field that reads it.

- The output field reads the anonymous attribute from whatever geometry it is later evaluated on. If
  that geometry does not carry the attribute (a different geometry, or one whose operations dropped
  it), the read yields the type default for every element.
- Anonymous attributes propagate through geometry operations exactly like named attributes (Join,
  Realize, Transform, element duplication …), following the same domain and type rules.
- Blender propagates an anonymous attribute only while a downstream field still reads it; a JS
  implementation may propagate more, since unreferenced anonymous attributes are unobservable.
- They cannot be read or written by name. Their internal names start with `.a_`.
- They are removed from the final output of the root tree, so they never appear in reference
  geometry.

Capture Attribute makes the value of a field at one point of the tree available later: the field is
evaluated on the Capture Attribute node's geometry and domain, stored, and read back wherever the
output is used — even after the geometry changes, as long as the attribute is carried along.

## Broadcasting summary

| Upstream | Downstream socket | Result |
|---|---|---|
| single | single-only | the value |
| single | field-capable | constant field, same value for all elements |
| constant field | single-only | evaluated once |
| context-dependent field | single-only | type default |
| context-dependent field | field-capable | evaluated per element where a geometry node consumes it |

## Reference cases

Cases are in the format of `reference/cases/cases.json` and run with `tools/blender/cases.py`;
socket identifiers are those of `coverage/nodes-5.2.2.json`. Links are created in the listed order,
so for a multi-input socket (Join Geometry) **the last listed link ends up first**. Every case below
was captured with Blender 5.2.2 while writing this spec; the "Blender result" column is what the
capture contained (attributes not mentioned are the node's usual output). The exporter reports an
empty `mesh` entry for results that have no mesh; ignore it.

| Case | Blender result |
|---|---|
| `fields-geometry-binding` | grid positions × 1.5 (the Cube is not read) |
| `fields-read-before-write` | every position = 2 × old + (0,0,1) |
| `fields-two-consumers` | mesh `i2` `[0,2,…,16]`; point cloud `i2` `[0,2,4,6,8]` |
| `fields-context-field-into-single` | empty mesh (Vertices X received 0, not the stored 3) |
| `fields-constant-field-into-single` | 5 × 3 grid (15 vertices) |
| `fields-selection` | vertices 4..8 moved by (0,0,1), 0..3 unchanged |
| `fields-anonymous-lost` | `d` `[0,0,0,0]` |
| `fields-anonymous-through-join` | duplicated vertices `d` `[0,1,0,1,0,1,0,1]`; joined points `d` `[0,0,0]` |
| `fields-multi-component` | mesh `i` `[0,1,2,3]`; point cloud `i` `[0,1,2]` |

```json
[
  {
    "id": "fields-geometry-binding",
    "description": "Position is read from the geometry entering Set Position, not from a nearby unconnected Cube",
    "tree": {
      "nodes": [
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 3, "Vertices Y": 3}},
        {"name": "pos", "type": "GeometryNodeInputPosition"},
        {"name": "scale", "type": "ShaderNodeVectorMath", "properties": {"operation": "SCALE"}, "inputs": {"Scale": 0.5}},
        {"name": "set", "type": "GeometryNodeSetPosition"}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["set", "Geometry"]},
        {"from": ["pos", "Position"], "to": ["scale", "Vector"]},
        {"from": ["scale", "Vector"], "to": ["set", "Offset"]}
      ],
      "output": ["set", "Geometry"]
    }
  },
  {
    "id": "fields-read-before-write",
    "description": "Set Position: Position = old + (0,0,1), Offset = old position; all fields see the old positions",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 3, "Vertices Y": 3}},
        {"name": "pos", "type": "GeometryNodeInputPosition"},
        {"name": "add", "type": "ShaderNodeVectorMath", "properties": {"operation": "ADD"}, "inputs": {"Vector_001": [0, 0, 1]}},
        {"name": "set", "type": "GeometryNodeSetPosition"}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["set", "Geometry"]},
        {"from": ["pos", "Position"], "to": ["add", "Vector"]},
        {"from": ["add", "Vector"], "to": ["set", "Position"]},
        {"from": ["pos", "Position"], "to": ["set", "Offset"]}
      ],
      "output": ["set", "Geometry"]
    }
  },
  {
    "id": "fields-two-consumers",
    "description": "One Index * 2 field stored on a Grid 3x3 and on Points (Count 5); each gets its own indices",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 3, "Vertices Y": 3}},
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 5}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "mul", "type": "FunctionNodeIntegerMath", "properties": {"operation": "MULTIPLY"}, "inputs": {"Value_001": 2}},
        {"name": "s1", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "i2"}},
        {"name": "s2", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "i2"}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["idx", "Index"], "to": ["mul", "Value"]},
        {"from": ["g", "Mesh"], "to": ["s1", "Geometry"]},
        {"from": ["mul", "Value"], "to": ["s1", "Value"]},
        {"from": ["p", "Geometry"], "to": ["s2", "Geometry"]},
        {"from": ["mul", "Value"], "to": ["s2", "Value"]},
        {"from": ["s2", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["s1", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "fields-context-field-into-single",
    "description": "Index + 3 linked to Grid Vertices X: the input gets the type default 0 and the mesh is empty",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid"},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "add", "type": "FunctionNodeIntegerMath", "properties": {"operation": "ADD"}, "inputs": {"Value_001": 3}}
      ],
      "links": [
        {"from": ["idx", "Index"], "to": ["add", "Value"]},
        {"from": ["add", "Value"], "to": ["g", "Vertices X"]}
      ],
      "output": ["g", "Mesh"]
    }
  },
  {
    "id": "fields-constant-field-into-single",
    "description": "Integer 2 + 3 linked to Grid Vertices X: a constant, evaluated once, Vertices X = 5",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid"},
        {"name": "int", "type": "FunctionNodeInputInt", "properties": {"integer": 2}},
        {"name": "add", "type": "FunctionNodeIntegerMath", "properties": {"operation": "ADD"}, "inputs": {"Value_001": 3}}
      ],
      "links": [
        {"from": ["int", "Integer"], "to": ["add", "Value"]},
        {"from": ["add", "Value"], "to": ["g", "Vertices X"]}
      ],
      "output": ["g", "Mesh"]
    }
  },
  {
    "id": "fields-selection",
    "description": "Set Position with Selection = Index > 3 (Float Compare fed by Index) moves only vertices 4..8",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 3, "Vertices Y": 3}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "cmp", "type": "FunctionNodeCompare", "properties": {"data_type": "FLOAT", "operation": "GREATER_THAN"}, "inputs": {"B": 3.0}},
        {"name": "set", "type": "GeometryNodeSetPosition", "inputs": {"Offset": [0, 0, 1]}}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["set", "Geometry"]},
        {"from": ["idx", "Index"], "to": ["cmp", "A"]},
        {"from": ["cmp", "Result"], "to": ["set", "Selection"]}
      ],
      "output": ["set", "Geometry"]
    }
  },
  {
    "id": "fields-anonymous-lost",
    "description": "Duplicate Index read on unrelated Points: the anonymous attribute is absent, all 0",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "dup", "type": "GeometryNodeDuplicateElements", "properties": {"domain": "POINT"}, "inputs": {"Amount": 2}},
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 4}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "d"}}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["dup", "Geometry"]},
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["dup", "Duplicate Index"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "fields-anonymous-through-join",
    "description": "Duplicate Index survives a Join; the joined Points without it read 0",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "dup", "type": "GeometryNodeDuplicateElements", "properties": {"domain": "POINT"}, "inputs": {"Amount": 2}},
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 3}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "d"}}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["dup", "Geometry"]},
        {"from": ["p", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["dup", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["join", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["dup", "Duplicate Index"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "fields-multi-component",
    "description": "Index stored on a geometry holding a mesh and a point cloud restarts at 0 in each component",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 3}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "i"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["g", "Mesh"], "to": ["join", "Geometry"]},
        {"from": ["join", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["idx", "Index"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  }
]
```
