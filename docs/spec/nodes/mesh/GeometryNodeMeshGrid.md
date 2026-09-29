# Grid (`GeometryNodeMeshGrid`)

Generates a planar quad grid on the XY plane, centred on the origin.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Size X` | float (distance) | 1.0 | UI minimum 0; a linked value is not clamped |
| in | `Size Y` | float (distance) | 1.0 | UI minimum 0; a linked value is not clamped |
| in | `Vertices X` | int | 3 | UI range 2..1000; a linked value is not clamped |
| in | `Vertices Y` | int | 3 | UI range 2..1000; a linked value is not clamped |
| out | `Mesh` | geometry | | one mesh component |
| out | `UV Map` | vector field | | corner-domain field, see below |

No properties. All inputs are single values, not fields.

Write `nx = Vertices X`, `ny = Vertices Y`, `ex = nx - 1`, `ey = ny - 1`.

## Validity

- If `nx < 1` or `ny < 1`, the node outputs an **empty geometry**: no mesh component at all, not an
  empty mesh.
- `nx = 1` or `ny = 1` is valid: see "Degenerate counts" below.
- There is no upper limit when the value comes from a link.

## Counts

| Domain | Count |
|---|---|
| vertices | `nx * ny` |
| edges | `nx * ey + ny * ex` |
| faces | `ex * ey` |
| corners | `4 * ex * ey` |

## Vertices

The vertex index runs **X-major**: vertex `(x, y)` with `0 <= x < nx`, `0 <= y < ny` has index
`x * ny + y`. Y varies fastest.

- Step sizes: `dx = Size X / ex` (0 when `ex = 0`), `dy = Size Y / ey` (0 when `ey = 0`).
- Position of `(x, y)`: `((x - ex / 2) * dx, (y - ey / 2) * dy, 0)`.

So with `Size X = 1, nx = 3` the X coordinates are -0.5, 0, 0.5. A negative size mirrors the grid
(vertex 0 then sits at positive X/Y); nothing else changes.

## Edges

Two blocks, in this order:

1. **Edges along Y** (`nx * ey` of them), starting at edge 0. For every column `x` (outer loop) and
   every `y < ey` (inner loop), edge `x * ey + y` = `(vertex(x, y), vertex(x, y + 1))`.
2. **Edges along X** (`ny * ex` of them), starting at `X0 = nx * ey`. For every row `y` (outer loop)
   and every `x < ex` (inner loop), edge `X0 + y * ex + x` = `(vertex(x, y), vertex(x + 1, y))`.

Each edge stores its lower vertex index first.

## Faces and corners

Face `(x, y)` with `0 <= x < ex`, `0 <= y < ey` has index `x * ey + y` (X-major, like vertices).
Every face is a quad; face `f` owns corners `4f .. 4f + 3`.

With `v = x * ny + y`, the four corners in order are:

| Corner | Vertex | Edge |
|---|---|---|
| `4f + 0` | `v` = `(x, y)` | along-X edge `X0 + y * ex + x` |
| `4f + 1` | `v + ny` = `(x+1, y)` | along-Y edge `(x + 1) * ey + y` |
| `4f + 2` | `v + ny + 1` = `(x+1, y+1)` | along-X edge `X0 + (y + 1) * ex + x` |
| `4f + 3` | `v + 1` = `(x, y+1)` | along-Y edge `x * ey + y` |

The corner edge is the edge from that corner's vertex to the next corner's vertex. The winding is
counter-clockwise seen from +Z, so every face normal is (0, 0, 1) for positive sizes.

## Attributes on the output mesh

- `sharp_face` (bool, face domain): **true on every face** (the grid is flat-shaded). The attribute
  is present even when there are no faces.
- No `sharp_edge`, no `material_index`, no named UV map.
- The mesh gets one material slot (empty) if it has none; this is not an attribute.
- The UV map exists only as the anonymous attribute behind the `UV Map` output (below).

## UV Map output

A float2 value per corner, exposed as a vector field with Z = 0. It is only produced when the mesh
has at least one face. For a corner whose vertex is at position `(px, py, 0)`:

- `u = (px + Size X / 2) / Size X`, or 0 when `Size X == 0`
- `v = (py + Size Y / 2) / Size Y`, or 0 when `Size Y == 0`

So the corner at vertex `(x, y)` has UV `(x / ex, y / ey)` for non-zero sizes: vertex 0 maps to
(0, 0) and the last vertex to (1, 1). A negative size still maps vertex 0 to (0, 0).

## Degenerate counts

- `nx = 1, ny > 1`: `ny` vertices on the Y axis at X = 0, `ey` edges along Y (block 1 only), no
  faces, no corners, no UV data.
- `nx > 1, ny = 1`: `nx` vertices on the X axis at Y = 0, `ex` edges along X (block 2 only; they
  start at index 0 because block 1 is empty), no faces.
- `nx = ny = 1`: one vertex at the origin, nothing else.
- `Size X = 0` (with `nx > 1`): all X coordinates are 0; faces are zero-area; U is 0 everywhere.

## Reference cases

Existing in `reference/cases/cases.json`: `grid-default`, `grid-3x2`.

```json
[
  {
    "id": "grid-line-x1",
    "description": "Grid with 1 by 4 vertices fed through links: a line of vertices along Y, edges only",
    "tree": {
      "nodes": [
        { "name": "nx", "type": "FunctionNodeInputInt", "properties": { "integer": 1 } },
        { "name": "ny", "type": "FunctionNodeInputInt", "properties": { "integer": 4 } },
        { "name": "grid", "type": "GeometryNodeMeshGrid" }
      ],
      "links": [
        { "from": ["nx", "Integer"], "to": ["grid", "Vertices X"] },
        { "from": ["ny", "Integer"], "to": ["grid", "Vertices Y"] }
      ],
      "output": ["grid", "Mesh"]
    }
  },
  {
    "id": "grid-line-y1",
    "description": "Grid with 4 by 1 vertices fed through links: edges along X starting at edge index 0",
    "tree": {
      "nodes": [
        { "name": "nx", "type": "FunctionNodeInputInt", "properties": { "integer": 4 } },
        { "name": "ny", "type": "FunctionNodeInputInt", "properties": { "integer": 1 } },
        { "name": "grid", "type": "GeometryNodeMeshGrid" }
      ],
      "links": [
        { "from": ["nx", "Integer"], "to": ["grid", "Vertices X"] },
        { "from": ["ny", "Integer"], "to": ["grid", "Vertices Y"] }
      ],
      "output": ["grid", "Mesh"]
    }
  },
  {
    "id": "grid-single-vertex",
    "description": "Grid with 1 by 1 vertices fed through links",
    "tree": {
      "nodes": [
        { "name": "nx", "type": "FunctionNodeInputInt", "properties": { "integer": 1 } },
        { "name": "ny", "type": "FunctionNodeInputInt", "properties": { "integer": 1 } },
        { "name": "grid", "type": "GeometryNodeMeshGrid" }
      ],
      "links": [
        { "from": ["nx", "Integer"], "to": ["grid", "Vertices X"] },
        { "from": ["ny", "Integer"], "to": ["grid", "Vertices Y"] }
      ],
      "output": ["grid", "Mesh"]
    }
  },
  {
    "id": "grid-zero-vertices",
    "description": "Grid with 0 by 3 vertices fed through links: empty geometry, no mesh component",
    "tree": {
      "nodes": [
        { "name": "nx", "type": "FunctionNodeInputInt", "properties": { "integer": 0 } },
        { "name": "ny", "type": "FunctionNodeInputInt", "properties": { "integer": 3 } },
        { "name": "grid", "type": "GeometryNodeMeshGrid" }
      ],
      "links": [
        { "from": ["nx", "Integer"], "to": ["grid", "Vertices X"] },
        { "from": ["ny", "Integer"], "to": ["grid", "Vertices Y"] }
      ],
      "output": ["grid", "Mesh"]
    }
  },
  {
    "id": "grid-large-count",
    "description": "Grid with 1200 by 2 vertices fed through links: the UI maximum of 1000 does not apply",
    "tree": {
      "nodes": [
        { "name": "nx", "type": "FunctionNodeInputInt", "properties": { "integer": 1200 } },
        { "name": "ny", "type": "FunctionNodeInputInt", "properties": { "integer": 2 } },
        { "name": "grid", "type": "GeometryNodeMeshGrid" }
      ],
      "links": [
        { "from": ["nx", "Integer"], "to": ["grid", "Vertices X"] },
        { "from": ["ny", "Integer"], "to": ["grid", "Vertices Y"] }
      ],
      "output": ["grid", "Mesh"]
    }
  },
  {
    "id": "grid-uv-stored",
    "description": "UV Map output of a 4 by 3 grid of size 2 by 1 stored as a named corner attribute",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Size X": 2, "Size Y": 1, "Vertices X": 4, "Vertices Y": 3 } },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT_VECTOR", "domain": "CORNER" }, "inputs": { "Name": "uv" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["store", "Geometry"] },
        { "from": ["grid", "UV Map"], "to": ["store", "Value"] }
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "grid-negative-size-uv",
    "description": "Grid of size -2 by 1 with its UV Map stored: mirrored positions, UVs still start at 0",
    "tree": {
      "nodes": [
        { "name": "size", "type": "ShaderNodeMath", "properties": { "operation": "MULTIPLY" }, "inputs": { "Value": -2, "Value_001": 1 } },
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Size Y": 1, "Vertices X": 3, "Vertices Y": 2 } },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT_VECTOR", "domain": "CORNER" }, "inputs": { "Name": "uv" } }
      ],
      "links": [
        { "from": ["size", "Value"], "to": ["grid", "Size X"] },
        { "from": ["grid", "Mesh"], "to": ["store", "Geometry"] },
        { "from": ["grid", "UV Map"], "to": ["store", "Value"] }
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "grid-zero-size",
    "description": "Grid of size 0 by 1 with 3 by 3 vertices and its UV Map stored",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Size X": 0, "Size Y": 1 } },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT_VECTOR", "domain": "CORNER" }, "inputs": { "Name": "uv" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["store", "Geometry"] },
        { "from": ["grid", "UV Map"], "to": ["store", "Value"] }
      ],
      "output": ["store", "Geometry"]
    }
  }
]
```

Counts below 2 or above 1000 and negative sizes are fed through links (Integer and Math nodes),
because a socket's own value is held inside its UI range.
