# Extrude Mesh (`GeometryNodeExtrudeMesh`)

Duplicates selected vertices, edges or faces, moves the duplicates by an offset and connects them
to the originals with new edges and faces. Existing elements keep their indices; every new element
is **appended** after the existing ones in its domain.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Mesh` | geometry | | only mesh components are changed |
| in | `Selection` | bool field | true | evaluated on the mode's domain |
| in | `Offset` | vector field | implicit **Normal** field | the inventory lists (0,0,0), but an unlinked socket reads the normal |
| in | `Offset Scale` | float field | 1.0 | |
| in | `Individual` | bool | true | only available in Faces mode; ignored in the other modes |
| out | `Mesh` | geometry | | |
| out | `Top` | bool field | | anonymous attribute, see per mode |
| out | `Side` | bool field | | anonymous attribute, see per mode |

Property `mode`: `VERTICES`, `EDGES`, `FACES` (default `FACES`).

## Common rules

- The effective offset is `Offset * Offset Scale`, both evaluated per element on the mode's domain
  (Point for Vertices, Edge for Edges, Face for Faces), **on the input mesh**.
- The unlinked `Offset` is the mesh normal on that domain:
  - Point: the vertex normal. A vertex with no faces has the normal `normalize(position)`, which is
    (0,0,0) for a loose vertex at the origin (a vector whose squared length is at most 1e-35
    normalizes to zero).
  - Edge: `normalize((n_a + n_b) / 2)` of the two vertex normals.
  - Face: the face normal.
- If the evaluated selection is empty, the mesh is returned unchanged and `Top`/`Side` are not
  created (they read as false everywhere).
- The node recurses into instances: every mesh inside instance references is extruded too. Other
  component types pass through untouched.
- Every point-domain attribute of a new vertex is copied from its source vertex, including `id`
  (duplicates are not given new ids) and vertex-group weights. `position` is then overwritten.
- "Mixing" below means the propagation mix:
  - bool: logical OR of the contributors; false when there are none;
  - int, int8: arithmetic mean rounded to nearest (halves away from zero); 0 when none;
  - float, float2, float3, float4: arithmetic mean; zero when none;
  - float colour: component-wise mean; (0,0,0,1) when none;
  - byte colour: mean; (0,0,0,255) when none;
  - quaternion: mean in exponential-map space, converted back;
  - 4x4 matrix: mean of location, rotation (exponential map) and scale; identity when none.
- String attributes are never propagated to new elements.
- Attributes whose value is stored as a single constant (for example written by Store Named
  Attribute with a constant value on the whole domain) keep that constant on every new element,
  including where the rules below would give "none -> zero". Pin with case
  `extrude-edges-loose-single-value`.

---

## Mode VERTICES

Selection and offset are evaluated on the point domain. Let `S` be the selected vertex indices in
ascending order, `k = |S|`, `V` and `E` the original vertex and edge counts.

New elements:

| New element | Index | Definition |
|---|---|---|
| vertex `i` | `V + i` | copy of vertex `S[i]`, position `pos[S[i]] + offset[S[i]]` |
| edge `i` | `E + i` | `(S[i], V + i)` (original vertex first) |

No faces or corners are added. Original elements are unchanged.

Attributes:
- Point: copied from the source vertex.
- Edge: new edge `i` gets the mix of all original edges connected to `S[i]` (all of them, selected
  or not). A loose vertex has none, so the new edge gets the "none" value.
- Face and corner: untouched.

Outputs:
- `Top` (point domain): true on the new vertices, false elsewhere.
- `Side` (edge domain): true on the new edges, false elsewhere.

---

## Mode EDGES

Selection and offset are evaluated on the edge domain. Let `SE` be the selected edges in ascending
order (`m = |SE|`), and `SV` every vertex used by a selected edge, ascending (`k = |SV|`). `V`, `E`,
`F`, `C` are the original vertex, edge, face and corner counts.

New elements, in this order within each domain:

| New element | Index range | Definition |
|---|---|---|
| vertices | `V .. V+k-1` | vertex `V+j` duplicates `SV[j]` |
| connecting edges | `E .. E+k-1` | edge `E+j` = `(SV[j], V+j)` |
| duplicate edges | `E+k .. E+k+m-1` | edge `E+k+i` = `(dup(a), dup(b))` for `SE[i] = (a, b)` |
| side faces | `F .. F+m-1` | one quad per selected edge, face `F+i` for `SE[i]` |
| corners | `C .. C+4m-1` | face `F+i` owns corners `C+4i .. C+4i+3` |

`dup(v)` is the new vertex duplicating `v`.

### Positions

- If the offset is one constant value for all edges, each new vertex is `pos[v] + offset`.
- Otherwise each new vertex is `pos[v] +` the **mean** of the offsets of the selected edges that
  use `v` (each such edge counts once). The mean is not renormalized.

### Side-face corner order

For selected edge `(a, b)` with new edges `ca = (a, dup(a))`, `cb = (b, dup(b))`, duplicate edge
`d = (dup(a), dup(b))` and the original edge `e`:

- Look at the faces that use `e` in the input. If there is exactly one, find the corner of that
  face whose edge is `e`. If that corner's vertex is `a` (the face runs a -> b), or if the edge has
  zero faces or two or more, the quad is **layout A**. If the corner's vertex is `b`, it is
  **layout B**.
- Layout A: vertices `[a, dup(a), dup(b), b]`, corner edges `[ca, d, cb, e]`.
- Layout B: vertices `[a, b, dup(b), dup(a)]`, corner edges `[e, cb, d, ca]`.

With exactly one adjacent face, this makes the new quad run along `e` opposite to that face, so
the winding is consistent. With 0 or 2+ adjacent faces it is always layout A.

### Attributes

- Point: copied from the source vertex.
- Edge:
  - duplicate edge `i`: copy of `SE[i]`;
  - connecting edge for `v`: mix of the **selected** edges that use `v`.
- Face: side face `i` gets the mix of all faces (selected or not; the selection is on edges) that
  use `SE[i]` in the input. A loose edge has none.
- Corner: for side face `i` with edge `(a, b)`:
  - value A = mean over every face that uses the edge of that face's corner at vertex `a`;
    value B likewise for `b`;
  - the two corners of the quad at `a` and `dup(a)` both get value A; the two at `b` and
    `dup(b)` both get value B;
  - if the edge has no faces, all four corners get the zero value of the type (false for bool).
  - Bool corner attributes use OR mixing here, like everything else.

### Outputs

- `Top` (edge domain): true on the duplicate edges.
- `Side` (face domain): true on the new faces.

---

## Mode FACES, Individual = false (regions)

Selection and offset are evaluated on the face domain. Faces are grouped implicitly into regions of
selected faces that share edges.

### Classifying original edges

For every original edge (ascending index), count its adjacent faces that are selected (`s`) and not
selected (`u`):

| Class | Condition | What happens |
|---|---|---|
| boundary | `s == 1` | the edge stays with the unselected side; a new top edge and a side face are made |
| split inner | `s >= 2` and `u >= 1` | the edge stays with the unselected faces; a duplicate is made for the selected ones |
| inner | `s >= 2` and `u == 0` | the edge moves with the region; no copy is made |
| untouched | `s == 0` | nothing |

Let `B` be the boundary edges in ascending order, each with its one selected face `face(B[i])`, and
`N` the split inner edges, ascending.

### New vertices

An ordered set `NV` of original vertices is built:
1. for each boundary edge in order, add its first vertex then its second vertex, skipping any
   already present;
2. then for each split inner edge in order, the same.

Let `kb` be the size of `NV` after step 1. New vertex `V+j` duplicates `NV[j]`.

### New elements, in order

| New element | Index range | Definition |
|---|---|---|
| vertices | `V .. V+|NV|-1` | duplicates of `NV` |
| connecting edges | `E .. E+kb-1` | `(NV[j], V+j)`; only for vertices from boundary edges |
| top edges | next `|B|` | for `B[i] = (a, b)`: `(dup(a), dup(b))` |
| split copies | next `|N|` | for `N[i] = (a, b)`: `(dup(a), dup(b))` |
| side faces | `F .. F+|B|-1` | one quad per boundary edge, in the order of `B` |
| corners | `C .. C+4|B|-1` | 4 per side face |

### Rewiring existing elements

- Inner edges keep their index; each endpoint that has a duplicate is replaced by the duplicate.
- Every selected face keeps its index and corner order. Each corner's vertex is replaced by its
  duplicate when it has one; each corner's edge is replaced by the top edge if it was a boundary
  edge, or by the split copy if it was a split inner edge.
- Boundary edges and split inner edges keep their original vertices and stay attached to the
  unselected faces.
- A vertex of the region that has no duplicate (it touches only inner edges) is **moved in place**,
  together with any loose edge or unselected face that shares only that vertex.

### Side-face corner order

For boundary edge `B[i]` with top edge `t = (dup(a), dup(b))`, original edge `e = (a, b)`,
connecting edges `ca`, `cb`: look at the rewired selected face `face(B[i])`, find its corner whose
edge is `t`.

- If that corner's vertex is `dup(a)`: vertices `[dup(a), a, b, dup(b)]`, edges `[ca, e, cb, t]`.
- Otherwise: vertices `[dup(a), dup(b), b, a]`, edges `[t, cb, e, ca]`.

Either way the side face runs along `t` opposite to the selected face.

### Positions

- Every vertex used by a selected face gets an offset. If it has a duplicate, the **duplicate**
  moves and the original stays; otherwise the original moves.
- With a constant offset every such vertex moves by it.
- Otherwise the vertex offset is the mean of the offsets of the selected faces around it, counted
  once per corner of those faces that uses the vertex. It is not renormalized. Example: extruding
  every face of a cube by its normal moves each corner vertex by (±1/3, ±1/3, ±1/3).

### Attributes

- Point: duplicates copy their source vertex.
- Face: each side face copies all face attributes from `face(B[i])` (for example `material_index`,
  `sharp_face`).
- Edge:
  - top edge copies its boundary edge;
  - split copy copies its split inner edge;
  - connecting edge for `NV[j]` gets the mix of the boundary edges that use `NV[j]`.
- Corner: in side face `i`, the corners at `a` and `dup(a)` copy the rewired selected face's
  corner at `dup(a)`; the corners at `b` and `dup(b)` copy its corner at `dup(b)`. (Copied, not
  averaged.)

### Outputs

- `Top` (face domain): true on every selected face (their indices are unchanged).
- `Side` (face domain): true on the side faces.

### Special cases

- All faces of a closed manifold selected: every edge is inner, nothing is duplicated, and the
  whole mesh is only moved.
- An edge used by one selected face and any number of unselected faces is a boundary edge.
- Split inner edges only occur on non-manifold meshes (an edge with three or more faces, at least
  two selected and one not). Their duplicated vertices get no connecting edge unless they are also
  on a boundary edge.

---

## Mode FACES, Individual = true

Selection and offset are evaluated on the face domain. Let `SF` be the selected faces ascending.
Walk the selected faces in order and their corners in order; the `n`-th corner visited overall
(0-based, across all selected faces) is "extrude slot `n`". `K` is the total number of slots.

For a selected face with corners `c_0 .. c_{s-1}` at vertices `v_0 .. v_{s-1}` and corner edges
`e_0 .. e_{s-1}` (edge `e_i` runs from `v_i` to `v_{i+1}`, wrapping), taking slots
`n_0 .. n_{s-1}`:

| New element | Index | Definition |
|---|---|---|
| vertex | `V + n_i` | duplicate of `v_i`, position `pos[v_i] + offset(face)` |
| connecting edge | `E + n_i` | `(v_i, V + n_i)` |
| top edge | `E + K + n_i` | `(V + n_i, V + n_{i+1})` |
| side face | `F + n_i` | quad, corners `C + 4 n_i .. C + 4 n_i + 3` |

The selected face keeps its index and corner order; corner `c_i` now uses vertex `V + n_i` and edge
`E + K + n_i`.

Side face `F + n_i` (the side under edge `e_i`):

| Corner | Vertex | Edge |
|---|---|---|
| 0 | `V + n_{i+1}` | top edge `E + K + n_i` |
| 1 | `V + n_i` | connecting edge `E + n_i` |
| 2 | `v_i` | original edge `e_i` |
| 3 | `v_{i+1}` | connecting edge `E + n_{i+1}` |

Vertices shared by neighbouring selected faces are duplicated once per face corner, so the result
is disconnected per face. Original edges and vertices never move.

### Attributes

- Point: duplicate copies its source vertex.
- Edge:
  - top edge `E + K + n_i` copies `e_i`;
  - connecting edge `E + n_i` gets the two edges meeting at `v_i` in this face, `e_i` and
    `e_{i-1}`: bool is `e_i OR e_{i-1}`; every other type is their 50/50 mix (for int:
    `round(0.5*a + 0.5*b)`).
- Face: side face `F + n_i` copies the selected face.
- Corner: side-face corners copy the selected face's corners: corners 0 and 3 copy `c_{i+1}`,
  corners 1 and 2 copy `c_i`.

### Outputs

- `Top` (face domain): true on the selected faces.
- `Side` (face domain): true on the side faces.

---

## Edge cases

- Empty mesh, or a mesh with no elements on the mode's domain: unchanged.
- Mesh without edges in Vertices mode: the new edges are the first edges of the mesh.
- `Offset Scale = 0`: topology is built exactly as usual; the new vertices sit on the originals.
- NaN offsets propagate into positions.
- Faces mode on a mesh with no faces: unchanged, `Top`/`Side` absent.

## Reference cases

Math `LESS_THAN` with `Index` as the first input and a threshold as the second is used as a
selection (non-zero converts to true).

```json
[
  {
    "id": "extrude-vertices-grid-first",
    "description": "Vertices mode on a 2 by 2 grid, only vertex 0, default normal offset; edge attribute mixing from the store",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 2, "Vertices Y": 2 } },
        { "name": "eindex", "type": "GeometryNodeInputIndex" },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "w" } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "first", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 0.5 } },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "properties": { "mode": "VERTICES" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["store", "Geometry"] },
        { "from": ["eindex", "Index"], "to": ["store", "Value"] },
        { "from": ["store", "Geometry"], "to": ["extrude", "Mesh"] },
        { "from": ["index", "Index"], "to": ["first", "Value"] },
        { "from": ["first", "Value"], "to": ["extrude", "Selection"] }
      ],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-vertices-loose-origin",
    "description": "Vertices mode on one loose point at the origin: default normal offset is zero",
    "tree": {
      "nodes": [
        { "name": "points", "type": "GeometryNodePoints" },
        { "name": "verts", "type": "GeometryNodePointsToVertices" },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "properties": { "mode": "VERTICES" } }
      ],
      "links": [
        { "from": ["points", "Geometry"], "to": ["verts", "Points"] },
        { "from": ["verts", "Mesh"], "to": ["extrude", "Mesh"] }
      ],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-edges-one-boundary",
    "description": "Edges mode on a 2 by 2 grid, only edge 0 (one adjacent face, layout B), offset (0,0,1), UV stored on corners",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 2, "Vertices Y": 2 } },
        { "name": "uv", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT_VECTOR", "domain": "CORNER" }, "inputs": { "Name": "uv" } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "first", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 0.5 } },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "properties": { "mode": "EDGES" }, "inputs": { "Offset": [0, 0, 1] } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["uv", "Geometry"] },
        { "from": ["grid", "UV Map"], "to": ["uv", "Value"] },
        { "from": ["uv", "Geometry"], "to": ["extrude", "Mesh"] },
        { "from": ["index", "Index"], "to": ["first", "Value"] },
        { "from": ["first", "Value"], "to": ["extrude", "Selection"] }
      ],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-edges-all-grid-normal",
    "description": "Edges mode on a 3 by 3 grid, every edge, default edge-normal offset scaled by 0.5; inner edges have two faces (layout A)",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "properties": { "mode": "EDGES" }, "inputs": { "Offset Scale": 0.5 } }
      ],
      "links": [{ "from": ["grid", "Mesh"], "to": ["extrude", "Mesh"] }],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-edges-loose-line",
    "description": "Edges mode on a 3-vertex Mesh Line (no faces): layout A, face and corner attributes from none",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 3 } },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "properties": { "mode": "EDGES" }, "inputs": { "Offset": [0, 1, 0] } }
      ],
      "links": [{ "from": ["line", "Mesh"], "to": ["extrude", "Mesh"] }],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-edges-loose-single-value",
    "description": "Edges mode on a Mesh Line after storing a constant int face attribute (zero faces) and a varying edge attribute",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 3 } },
        { "name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "INT", "domain": "FACE" }, "inputs": { "Name": "tag", "Value": 7 } },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "properties": { "mode": "EDGES" }, "inputs": { "Offset": [0, 1, 0] } }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["store", "Geometry"] },
        { "from": ["store", "Geometry"], "to": ["extrude", "Mesh"] }
      ],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-edges-varying-offset",
    "description": "Edges mode on a Mesh Line with Offset = Position: each new vertex moves by the mean of its selected edges' offsets",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 4, "Offset": [1, 0, 0] } },
        { "name": "position", "type": "GeometryNodeInputPosition" },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "properties": { "mode": "EDGES" } }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["extrude", "Mesh"] },
        { "from": ["position", "Position"], "to": ["extrude", "Offset"] }
      ],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-faces-region-single-quad",
    "description": "Faces mode, Individual off, a single quad (2 by 2 grid), default normal offset: 4 boundary edges, 4 side faces",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 2, "Vertices Y": 2 } },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "inputs": { "Individual": false } }
      ],
      "links": [{ "from": ["grid", "Mesh"], "to": ["extrude", "Mesh"] }],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-faces-region-grid-all",
    "description": "Faces mode, Individual off, every face of a 3 by 3 grid: centre vertex moved in place, inner edges rewired",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "inputs": { "Individual": false } }
      ],
      "links": [{ "from": ["grid", "Mesh"], "to": ["extrude", "Mesh"] }],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-faces-region-grid-partial",
    "description": "Faces mode, Individual off, faces 0 and 1 of a 4 by 3 grid (they share one inner edge) with material_index stored as the face index; side faces copy it",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 4, "Vertices Y": 3 } },
        { "name": "findex", "type": "GeometryNodeInputIndex" },
        { "name": "mat", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "INT", "domain": "FACE" }, "inputs": { "Name": "material_index" } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "first2", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 1.5 } },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "inputs": { "Individual": false, "Offset": [0, 0, 1] } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["mat", "Geometry"] },
        { "from": ["findex", "Index"], "to": ["mat", "Value"] },
        { "from": ["mat", "Geometry"], "to": ["extrude", "Mesh"] },
        { "from": ["index", "Index"], "to": ["first2", "Value"] },
        { "from": ["first2", "Value"], "to": ["extrude", "Selection"] }
      ],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-faces-region-nonmanifold",
    "description": "Faces mode, Individual off, on a 3 by 2 grid joined with a vertical quad along its middle edge and merged, so that edge has 3 faces; faces 0 and 1 selected: the middle edge is a split inner edge",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 3, "Vertices Y": 2 } },
        { "name": "wall", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 2, "Vertices Y": 2 } },
        { "name": "stand", "type": "GeometryNodeTransform", "inputs": { "Translation": [0, 0, 0.5], "Rotation": [0, 1.5707963267948966, 0] } },
        { "name": "join", "type": "GeometryNodeJoinGeometry" },
        { "name": "merge", "type": "GeometryNodeMergeByDistance" },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "first2", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 1.5 } },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "inputs": { "Individual": false, "Offset": [0, 0, -1] } }
      ],
      "links": [
        { "from": ["wall", "Mesh"], "to": ["stand", "Geometry"] },
        { "from": ["grid", "Mesh"], "to": ["join", "Geometry"] },
        { "from": ["stand", "Geometry"], "to": ["join", "Geometry"] },
        { "from": ["join", "Geometry"], "to": ["merge", "Geometry"] },
        { "from": ["merge", "Geometry"], "to": ["extrude", "Mesh"] },
        { "from": ["index", "Index"], "to": ["first2", "Value"] },
        { "from": ["first2", "Value"], "to": ["extrude", "Selection"] }
      ],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-faces-region-cube-all",
    "description": "Faces mode, Individual off, every face of the default cube: nothing duplicated, vertices move by the corner-weighted mean normal",
    "tree": {
      "nodes": [
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "inputs": { "Individual": false } }
      ],
      "links": [{ "from": ["cube", "Mesh"], "to": ["extrude", "Mesh"] }],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-faces-individual-grid",
    "description": "Faces mode, Individual on, faces 0 and 1 of a 3 by 3 grid with an edge float attribute (edge index) and UV stored",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "eindex", "type": "GeometryNodeInputIndex" },
        { "name": "w", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "w" } },
        { "name": "uv", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT_VECTOR", "domain": "CORNER" }, "inputs": { "Name": "uv" } },
        { "name": "index", "type": "GeometryNodeInputIndex" },
        { "name": "first2", "type": "ShaderNodeMath", "properties": { "operation": "LESS_THAN" }, "inputs": { "Value_001": 1.5 } },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "inputs": { "Individual": true } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["w", "Geometry"] },
        { "from": ["eindex", "Index"], "to": ["w", "Value"] },
        { "from": ["w", "Geometry"], "to": ["uv", "Geometry"] },
        { "from": ["grid", "UV Map"], "to": ["uv", "Value"] },
        { "from": ["uv", "Geometry"], "to": ["extrude", "Mesh"] },
        { "from": ["index", "Index"], "to": ["first2", "Value"] },
        { "from": ["first2", "Value"], "to": ["extrude", "Selection"] }
      ],
      "output": ["extrude", "Mesh"]
    }
  },
  {
    "id": "extrude-faces-top-side-stored",
    "description": "Faces mode, Individual off, single quad; Top and Side stored as named face attributes",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 2, "Vertices Y": 2 } },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "inputs": { "Individual": false } },
        { "name": "top", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "FACE" }, "inputs": { "Name": "top" } },
        { "name": "side", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "FACE" }, "inputs": { "Name": "side" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["extrude", "Mesh"] },
        { "from": ["extrude", "Mesh"], "to": ["top", "Geometry"] },
        { "from": ["extrude", "Top"], "to": ["top", "Value"] },
        { "from": ["top", "Geometry"], "to": ["side", "Geometry"] },
        { "from": ["extrude", "Side"], "to": ["side", "Value"] }
      ],
      "output": ["side", "Geometry"]
    }
  },
  {
    "id": "extrude-edges-top-side-stored",
    "description": "Edges mode on a 2 by 2 grid, all edges; Top stored on edges and Side stored on faces",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 2, "Vertices Y": 2 } },
        { "name": "extrude", "type": "GeometryNodeExtrudeMesh", "properties": { "mode": "EDGES" }, "inputs": { "Offset": [0, 0, 1] } },
        { "name": "top", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "EDGE" }, "inputs": { "Name": "top" } },
        { "name": "side", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "BOOLEAN", "domain": "FACE" }, "inputs": { "Name": "side" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["extrude", "Mesh"] },
        { "from": ["extrude", "Mesh"], "to": ["top", "Geometry"] },
        { "from": ["extrude", "Top"], "to": ["top", "Value"] },
        { "from": ["top", "Geometry"], "to": ["side", "Geometry"] },
        { "from": ["extrude", "Side"], "to": ["side", "Value"] }
      ],
      "output": ["side", "Geometry"]
    }
  }
]
```

### Worked expectation: `extrude-faces-region-single-quad`

Input quad (2 by 2 grid): vertices 0 (-.5,-.5), 1 (-.5,.5), 2 (.5,-.5), 3 (.5,.5); edges
e0 (0,1), e1 (2,3), e2 (0,2), e3 (1,3); face 0 = [0,2,3,1] with edges [e2,e1,e3,e0].

- New vertices 4..7 duplicate 0, 1, 2, 3 and sit at z = 1.
- Connecting edges e4 (0,4), e5 (1,5), e6 (2,6), e7 (3,7); top edges e8 (4,5), e9 (6,7),
  e10 (4,6), e11 (5,7).
- Face 0 becomes [4,6,7,5] with edges [e10,e9,e11,e8].
- Side faces: 1 = [4,5,1,0], 2 = [6,2,3,7], 3 = [4,0,2,6], 4 = [5,7,3,1].

### Worked expectation: `extrude-edges-one-boundary`

Edge e0 (0,1); its only face runs 1 -> 0 along it, so layout B: new vertices 4 (from 0) and 5 (from
1) at z = 1; edges e4 (0,4), e5 (1,5), e6 (4,5); face 1 = [0,1,5,4] with edges [e0,e5,e6,e4]; its
UVs are [(0,0),(0,1),(0,1),(0,0)].
