# Evaluation of a node tree

How a Geometry Nodes tree turns its inputs into its outputs. Statements marked **verified** were
observed in Blender 5.2.2 (headless, factory startup) with the reference cases at the end; the rest is
read from the source.

## Model

A tree is a set of nodes with input and output sockets and a set of links from an output socket to an
input socket. Evaluation is a pure function: each node's outputs depend only on its input values and
its stored properties. A tree is evaluated for its **Group Output** values; only what those values
need is computed.

Evaluation is lazy (below), but apart from warnings and other side effects, the result is the same as
evaluating every node whose output is used, in any order that respects links.

## Which links count

A link contributes a value only when all of these hold:

- it is not muted;
- both of its sockets are available (sockets hidden by the node's current settings, e.g. the Integer
  inputs of a Compare node in Float mode, do not exist for evaluation);
- its source is not a reroute chain that has nothing connected at its start ("dangling reroute").

A link that fails these tests is ignored: the target input behaves as **unlinked** (verified for a
dangling reroute: the target used its own stored value 5).

A tree that contains a cycle of available links cannot be evaluated at all.

## Value of an input socket

For each input socket of an evaluated node:

1. **Linked** (one counted link, or several for a multi-input): the value of the source output,
   converted to the input's type if the types differ.
   - Conversion follows the table in `attributes.md` and works on single values and on fields alike
     (verified: Combine XYZ (1, 2, 4.5) into a Float input gave 2.5).
   - If the types are **not convertible** (e.g. a Geometry output into a Float input), the link is
     treated as absent and the input takes its **unlinked** value (verified: the input used its
     stored value 5, not 0).
   - A context-dependent field arriving at an input that only accepts single values yields the input
     type's default value (see `fields.md`, verified).
2. **Unlinked**:
   - if the socket declares an implicit field input (the value is hidden in the UI and the socket
     reads e.g. "Position" or "ID / Index"), the value is that field: Position, Normal, Index,
     ID-or-Index, Instance Transform, Handle Left, Handle Right; some sockets use the scene frame or the
     modifier's object instead;
   - otherwise the socket's **stored value** (the number, vector, colour, string, menu item or
     data-block shown on the node).

### Type default values

Used wherever a socket needs a value it cannot otherwise get (the missing Group Output node,
unconvertible outputs of muted nodes, out-of-range Index Switch, fields into single inputs):

| Socket | Default |
|---|---|
| Float | 0.0 |
| Integer | 0 |
| Boolean | false |
| Vector | (0, 0, 0) |
| Color | (0, 0, 0, 0) |
| Rotation | identity |
| Matrix | identity |
| String | empty |
| Menu | no item |
| Geometry | empty geometry set |
| Object, Collection, Material, Image, … | none |

Note the Matrix *socket* default (identity) differs from the float4x4 *attribute* default (all zeros,
see `attributes.md`).

## Multi-input sockets

A multi-input socket (Join Geometry's Geometry) receives a list of values, one per counted link, in
link order: the most recently connected link first; in a `.blend`, links sorted by their stored sort
number, highest first (verified). Links that are not counted (above) do not occupy a list position.

## Reroutes and frames

- A reroute forwards its input unchanged (verified). A reroute whose chain has nothing at its start
  forwards nothing: the inputs it feeds behave as unlinked.
- Frames have no effect on evaluation.

## Muted nodes

A muted node computes nothing. Each of its outputs is fed from at most one of its inputs — its
*internal link*:

1. For an output, consider the node's available inputs in order, skipping inputs whose type cannot be
   internally linked to the output's type (priorities below).
2. Walk the inputs in order and keep a current choice: an input replaces the current choice when its
   priority is **higher**, or when it is **linked and the current choice is not**. The first candidate
   is always taken.
3. The output then carries the chosen input's value (whatever that input would receive: its link or
   its unlinked value), converted to the output type. If no input qualifies, or the conversion is not
   possible, the output is the output type's default value.

Priorities (higher wins; types not listed for a target cannot feed it):

| Output type | Input types, from highest to lowest priority |
|---|---|
| Color | Color, Float, Integer, Boolean |
| Vector | Vector, Float, Integer, Boolean |
| Float | Float, Integer, Boolean, Color, Vector |
| Integer | Integer, Float, Boolean, Color, Vector |
| Boolean | Boolean, Integer, Float, Color, Vector |
| Rotation | Rotation, Vector, Float |
| any other type | only the same type |

Some nodes override the choice: a muted **Switch** passes its False input. Some sockets are excluded
from muting by their node.

For a multi-input input, only the **first** value of the list passes through (verified: a muted Join
Geometry output only its first input).

Verified: a muted Math (Multiply) with only its second input linked to Index output the Index (the
linked input beat the earlier unlinked one); with nothing linked it output its first input's stored
value 10; a muted Set Position passed the geometry unchanged.

## Switch nodes and laziness

Inputs are requested only when needed:

- **Switch** with a single-value condition requests only the selected input (False when false, True
  when true); the other branch is not evaluated (verified result for a true condition).
- **Switch** with a context-dependent field condition, for types that can be fields (Float, Integer,
  Boolean, Vector, Color, Rotation, Matrix, String, Menu): both inputs are requested and the output is
  a field that picks, per element, the True value where the condition is true and the False value
  elsewhere (verified: `[1, 1, 2, 2]` for Index > 1).
- **Switch** with a context-dependent field condition for a type that cannot be a field (Geometry,
  Object, Collection, Material, Image, …): the node reports an error and the condition is taken as
  its type default, false — the False input is output (verified).
- **Index Switch** with a single index requests only that item; an index outside `0 … items − 1`
  gives the output type's default value (verified: an empty geometry for index 5 with two Geometry
  items). With a field index it builds a per-element choice; out-of-range elements get the type
  default.
- Menu Switch was not inspected; its own spec must state its laziness.

Laziness has no effect on results, only on which nodes run (warnings, viewer output, bake side
effects).

## Node groups

A group node evaluates another tree (the group) as a function:

- **Group inputs.** Each input of the group node gets a value by the socket rules above: its link, or
  when unlinked the group node's own stored socket value (initialised from the interface's default
  when the node was created, then editable per node), or the interface's implicit field input when the
  interface declares one (e.g. an Integer input defaulting to "ID / Index", a Vector input defaulting
  to "Position"). Inside the group, every **Group Input** node outputs these same values; a group may
  contain any number of Group Input nodes.
- **Group outputs.** The group's outputs are the inputs of its active **Group Output** node, each
  valued by the socket rules (an unlinked output takes the Group Output node's stored socket value).
  When the group has one Group Output node it is active; with several, the one flagged active is
  used; with none, or several with none flagged, every group output is the type default.
- **Fields cross group boundaries unchanged.** A field passed into or out of a group is not bound to
  any geometry by the boundary (see `fields.md`).
- A group node whose group is missing or cannot be evaluated (cycle, missing zone nodes, an interface
  socket of an unsupported type) produces nothing: sockets it feeds behave as unlinked.
- Nodes of an unknown type are ignored in the same way.
- When nesting of group evaluations exceeds Blender's evaluation stack limit, the group node outputs
  type defaults and reports an error.

The root tree (the one on the modifier) gets its Group Input values from the caller: in a `.blend`,
the values stored on the modifier for each interface input. How the modifier fills unset values was
not inspected (the modifier sources are not part of the checked-out tree).

## Output of the root tree

The root tree's geometry output has every anonymous attribute removed (see `fields.md`). No other
post-processing happens in the tree evaluation itself.

## Order independence

Nodes are pure and may run in parallel; Blender runs independent branches on several threads. No
result depends on scheduling. The only order that influences results is data order that the spec of
each node states (element order, multi-input link order, the order of contributions in
interpolation).

## Reference cases

Cases are in the format of `reference/cases/cases.json` and run with `tools/blender/cases.py`;
socket identifiers are those of `coverage/nodes-5.2.2.json`. Links are created in the listed order,
so for a multi-input socket (Join Geometry) **the last listed link ends up first**. Every case below
was captured with Blender 5.2.2 while writing this spec; the "Blender result" column is what the
capture contained (attributes not mentioned are the node's usual output). The exporter reports an
empty `mesh` entry for results that have no mesh; ignore it.

| Case | Blender result |
|---|---|
| `eval-unlinked-defaults` | 3×3 grid, size 1 (stored socket values) |
| `eval-link-conversion` | `f` `[2.5]` |
| `eval-invalid-link` | `f` `[5]` — the unconvertible Geometry→Float link is ignored and the stored value is used |
| `eval-muted-math` | `f` `[0,1,2,3]` — the linked second input passes |
| `eval-muted-math-unlinked` | `f` `[10,10]` — the first input's stored value |
| `eval-muted-set-position` | the grid unchanged |
| `eval-switch-single` | the True input (2×2 grid) |
| `eval-switch-field` | `f` `[1,1,2,2]` |
| `eval-switch-geometry-field-condition` | the False input (3×2 grid) |
| `eval-index-switch-out-of-range` | empty geometry |
| `eval-reroute` | `f` `[5]` |
| `eval-dangling-reroute` | `f` `[5]` — the stored value |

```json
[
  {
    "id": "eval-unlinked-defaults",
    "description": "Grid with every input unlinked uses the sockets' stored values (3x3 vertices, size 1)",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid"}
      ],
      "links": [
      ],
      "output": ["g", "Mesh"]
    }
  },
  {
    "id": "eval-link-conversion",
    "description": "Combine XYZ (1,2,4.5) into a Float Value: converted to the mean 2.5",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints"},
        {"name": "xyz", "type": "ShaderNodeCombineXYZ", "inputs": {"X": 1, "Y": 2, "Z": 4.5}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "f"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["xyz", "Vector"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "eval-invalid-link",
    "description": "A Geometry output linked to a Float Value whose stored value is 5: the input gets the Float type default 0",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints"},
        {"name": "g", "type": "GeometryNodeMeshGrid"},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "f", "Value": 5.0}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["g", "Mesh"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "eval-muted-math",
    "description": "Muted Math with only its second input linked (to Index): the linked input passes through",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 4}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "MULTIPLY", "mute": true}, "inputs": {"Value": 10.0}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "f"}}
      ],
      "links": [
        {"from": ["idx", "Index"], "to": ["m", "Value_001"]},
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["m", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "eval-muted-math-unlinked",
    "description": "Muted Math with no inputs linked: the first input's stored value (10) passes through",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 2}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "MULTIPLY", "mute": true}, "inputs": {"Value": 10.0, "Value_001": 3.0}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "f"}}
      ],
      "links": [
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["m", "Value"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "eval-muted-set-position",
    "description": "Muted Set Position passes the geometry unchanged",
    "tree": {
      "nodes": [
        {"name": "g", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "set", "type": "GeometryNodeSetPosition", "properties": {"mute": true}, "inputs": {"Offset": [0, 0, 1]}}
      ],
      "links": [
        {"from": ["g", "Mesh"], "to": ["set", "Geometry"]}
      ],
      "output": ["set", "Geometry"]
    }
  },
  {
    "id": "eval-switch-single",
    "description": "Switch (Geometry) with Switch = true outputs the True input",
    "tree": {
      "nodes": [
        {"name": "a", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 3, "Vertices Y": 2}},
        {"name": "b", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "GEOMETRY"}, "inputs": {"Switch": true}}
      ],
      "links": [
        {"from": ["a", "Mesh"], "to": ["sw", "False"]},
        {"from": ["b", "Mesh"], "to": ["sw", "True"]}
      ],
      "output": ["sw", "Output"]
    }
  },
  {
    "id": "eval-switch-field",
    "description": "Float Switch with a field condition Index > 1 picks per element",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 4}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "cmp", "type": "FunctionNodeCompare", "properties": {"data_type": "FLOAT", "operation": "GREATER_THAN"}, "inputs": {"B": 1.0}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "FLOAT"}, "inputs": {"False": 1.0, "True": 2.0}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "f"}}
      ],
      "links": [
        {"from": ["idx", "Index"], "to": ["cmp", "A"]},
        {"from": ["cmp", "Result"], "to": ["sw", "Switch"]},
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["sw", "Output"], "to": ["s", "Value"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "eval-switch-geometry-field-condition",
    "description": "Geometry Switch with a context-dependent condition: the condition becomes false, the False input is output",
    "tree": {
      "nodes": [
        {"name": "a", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 3, "Vertices Y": 2}},
        {"name": "b", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "idx", "type": "GeometryNodeInputIndex"},
        {"name": "cmp", "type": "FunctionNodeCompare", "properties": {"data_type": "FLOAT", "operation": "GREATER_THAN"}, "inputs": {"B": -1.0}},
        {"name": "sw", "type": "GeometryNodeSwitch", "properties": {"input_type": "GEOMETRY"}}
      ],
      "links": [
        {"from": ["idx", "Index"], "to": ["cmp", "A"]},
        {"from": ["cmp", "Result"], "to": ["sw", "Switch"]},
        {"from": ["a", "Mesh"], "to": ["sw", "False"]},
        {"from": ["b", "Mesh"], "to": ["sw", "True"]}
      ],
      "output": ["sw", "Output"]
    }
  },
  {
    "id": "eval-index-switch-out-of-range",
    "description": "Index Switch (Geometry) with Index 5 and two items: the output is the type default, an empty geometry",
    "tree": {
      "nodes": [
        {"name": "a", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "b", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "isw", "type": "GeometryNodeIndexSwitch", "properties": {"data_type": "GEOMETRY"}, "inputs": {"Index": 5}}
      ],
      "links": [
        {"from": ["a", "Mesh"], "to": ["isw", "Item_0"]},
        {"from": ["b", "Mesh"], "to": ["isw", "Item_1"]}
      ],
      "output": ["isw", "Output"]
    }
  },
  {
    "id": "eval-reroute",
    "description": "A Float reroute forwards the value unchanged",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints"},
        {"name": "v", "type": "ShaderNodeMath", "properties": {"operation": "ADD"}, "inputs": {"Value": 2.0, "Value_001": 3.0}},
        {"name": "r", "type": "NodeReroute", "properties": {"socket_idname": "NodeSocketFloat"}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "f"}}
      ],
      "links": [
        {"from": ["v", "Value"], "to": ["r", "Input"]},
        {"from": ["r", "Output"], "to": ["s", "Value"]},
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]}
      ],
      "output": ["s", "Geometry"]
    }
  },
  {
    "id": "eval-dangling-reroute",
    "description": "A link from a reroute with nothing connected to it is ignored: the Value input uses its stored value 5",
    "tree": {
      "nodes": [
        {"name": "p", "type": "GeometryNodePoints"},
        {"name": "r", "type": "NodeReroute", "properties": {"socket_idname": "NodeSocketFloat"}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "f", "Value": 5.0}}
      ],
      "links": [
        {"from": ["r", "Output"], "to": ["s", "Value"]},
        {"from": ["p", "Geometry"], "to": ["s", "Geometry"]}
      ],
      "output": ["s", "Geometry"]
    }
  }
]
```

Proposed cases that need a runner able to build node groups and several Group Output nodes:

- **eval-group-defaults** — a group with a Float input (interface default 2) and an Integer input
  whose default input is "ID / Index"; the group stores both on the points it receives. Call it with
  both inputs unlinked and the group node's Float socket set to 7. Expect Float 7 and Integer = index.
- **eval-group-inactive-output** — a group with two Group Output nodes, the second flagged active.
  Expect the active one's values.
- **eval-group-missing** — a group node whose tree is missing, feeding Store Named Attribute Value
  (stored value 3). Expect 3.
