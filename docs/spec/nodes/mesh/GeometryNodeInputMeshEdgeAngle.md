# Edge Angle (`GeometryNodeInputMeshEdgeAngle`)

Field input: the angle between the two faces that meet at an edge.

## Sockets

| Direction | Identifier | Type |
|---|---|---|
| out | `Unsigned Angle` | float field, radians |
| out | `Signed Angle` | float field, radians |

No inputs, no properties. Both values are defined on the **edge** domain (their preferred
domain); on other domains they are adapted with the mesh float interpolation (below).

## The two faces of an edge

Walk faces in ascending index, and within each face its corners in order. The first face met
that uses the edge is **face 1**, the second is **face 2**.

- If fewer than two faces use the edge (boundary or loose edge): both angles are **0**.
- If three or more corners in total use the edge (non-manifold edge): both angles are **0**.
- If one face uses the edge twice (degenerate face), that face counts as both face 1 and face 2,
  and the angle is 0.

## Face normals used

Normals are computed from the current positions, not taken from any stored or custom normals:

- triangle `(p0, p1, p2)`: `normalize(cross(p0 - p1, p1 - p2))`;
- quad `(p0, p1, p2, p3)`: `normalize(cross(p0 - p2, p1 - p3))` (the diagonals);
- n-gon with 5 or more corners: Newell's method over the corner loop, normalized;
- if the result is the zero vector (degenerate face, or squared length at most about 1e-35): the
  normal is (0, 0, 1).

The normals follow the winding, so the result depends on face orientation: two coplanar faces with
opposite winding give an unsigned angle of π.

## Unsigned Angle

The angle between the two unit normals `n1`, `n2`, in `[0, π]`, computed in the numerically robust
form:

- if `dot(n1, n2) >= 0`: `2 * asin(|n1 - n2| / 2)`;
- otherwise: `π - 2 * asin(|n1 + n2| / 2)`;

with the asin argument clamped to `[-1, 1]`. Flat edges give 0; a 90° fold gives π/2.

## Signed Angle

Same magnitude as the unsigned angle, with a sign from a concavity test:

1. `m` = midpoint of the edge's two vertices.
2. Triangulate face 2 as the mesh triangulation does (a quad splits along corners 0–2 unless that
   diagonal is degenerate, then along 1–3; n-gons are ear-clipped in their plane). Find the
   triangle of face 2 that contains the edge, and its third vertex `q`.
3. `t = normalize(q - m)` (zero if too short).
4. `c = dot(n1, t)`, with `n1` the normal of face 1.
5. If the angle is 0, the result is 0. Otherwise the result is **`+angle` when `c < 0`** and
   **`-angle` when `c >= 0`**.

So when face 2 bends away from the side face 1's normal points to, the result is positive. On a
closed mesh with outward normals that is a **convex** edge: every edge of a cube reads +π/2. The
node's tooltip says the opposite ("concave angles are positive"); the computation above is what
Blender 5.2.2 returns, and case `edge-angle-cube` must confirm it.

## Other domains

The edge values are adapted as floats:

- Point: the mean of the values of all edges using the vertex; 0 for a vertex with no edges.
- Face: the mean over the face's edges.
- Corner: the mean of the corner's edge and the previous corner's edge in the same face.

## Edge cases

- Meshes without faces: all zeros.
- Positions with NaN: NaN normals; the result then follows the formulas (the `c < 0` test is false
  for NaN, so the signed result takes the negative branch).

## Reference cases

```json
[
  {
    "id": "edge-angle-cube",
    "description": "Default cube: unsigned and signed angle stored on edges (expect π/2 and +π/2 on every edge)",
    "tree": {
      "nodes": [
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "angle", "type": "GeometryNodeInputMeshEdgeAngle" },
        { "name": "unsigned", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "unsigned" } },
        { "name": "signed", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "signed" } }
      ],
      "links": [
        { "from": ["cube", "Mesh"], "to": ["unsigned", "Geometry"] },
        { "from": ["angle", "Unsigned Angle"], "to": ["unsigned", "Value"] },
        { "from": ["unsigned", "Geometry"], "to": ["signed", "Geometry"] },
        { "from": ["angle", "Signed Angle"], "to": ["signed", "Value"] }
      ],
      "output": ["signed", "Geometry"]
    }
  },
  {
    "id": "edge-angle-grid-flat-and-boundary",
    "description": "3 by 3 grid: inner edges flat (0), boundary edges 0; stored on edges and points",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid" },
        { "name": "angle", "type": "GeometryNodeInputMeshEdgeAngle" },
        { "name": "onedge", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "unsigned" } },
        { "name": "onpoint", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "POINT" }, "inputs": { "Name": "unsigned_point" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["onedge", "Geometry"] },
        { "from": ["angle", "Unsigned Angle"], "to": ["onedge", "Value"] },
        { "from": ["onedge", "Geometry"], "to": ["onpoint", "Geometry"] },
        { "from": ["angle", "Unsigned Angle"], "to": ["onpoint", "Value"] }
      ],
      "output": ["onpoint", "Geometry"]
    }
  },
  {
    "id": "edge-angle-grid-valleys",
    "description": "4 by 2 grid of width 3 with every vertex moved to z = |x|: two valley folds at x = ±0.5; signed and unsigned stored on edges, signed also on faces",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Size X": 3, "Vertices X": 4, "Vertices Y": 2 } },
        { "name": "position", "type": "GeometryNodeInputPosition" },
        { "name": "xyz", "type": "ShaderNodeSeparateXYZ" },
        { "name": "abs", "type": "ShaderNodeMath", "properties": { "operation": "ABSOLUTE" } },
        { "name": "combine", "type": "ShaderNodeCombineXYZ" },
        { "name": "lift", "type": "GeometryNodeSetPosition" },
        { "name": "angle", "type": "GeometryNodeInputMeshEdgeAngle" },
        { "name": "unsigned", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "unsigned" } },
        { "name": "signed", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "signed" } },
        { "name": "signedface", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "FACE" }, "inputs": { "Name": "signed_face" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["lift", "Geometry"] },
        { "from": ["position", "Position"], "to": ["xyz", "Vector"] },
        { "from": ["xyz", "X"], "to": ["abs", "Value"] },
        { "from": ["xyz", "X"], "to": ["combine", "X"] },
        { "from": ["xyz", "Y"], "to": ["combine", "Y"] },
        { "from": ["abs", "Value"], "to": ["combine", "Z"] },
        { "from": ["combine", "Vector"], "to": ["lift", "Position"] },
        { "from": ["lift", "Geometry"], "to": ["unsigned", "Geometry"] },
        { "from": ["angle", "Unsigned Angle"], "to": ["unsigned", "Value"] },
        { "from": ["unsigned", "Geometry"], "to": ["signed", "Geometry"] },
        { "from": ["angle", "Signed Angle"], "to": ["signed", "Value"] },
        { "from": ["signed", "Geometry"], "to": ["signedface", "Geometry"] },
        { "from": ["angle", "Signed Angle"], "to": ["signedface", "Value"] }
      ],
      "output": ["signedface", "Geometry"]
    }
  },
  {
    "id": "edge-angle-nonmanifold",
    "description": "3 by 2 grid joined with a vertical quad on its middle edge and merged: the 3-face edge reads 0",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 3, "Vertices Y": 2 } },
        { "name": "wall", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 2, "Vertices Y": 2 } },
        { "name": "stand", "type": "GeometryNodeTransform", "inputs": { "Translation": [0, 0, 0.5], "Rotation": [0, 1.5707963267948966, 0] } },
        { "name": "join", "type": "GeometryNodeJoinGeometry" },
        { "name": "merge", "type": "GeometryNodeMergeByDistance" },
        { "name": "angle", "type": "GeometryNodeInputMeshEdgeAngle" },
        { "name": "unsigned", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "unsigned" } }
      ],
      "links": [
        { "from": ["wall", "Mesh"], "to": ["stand", "Geometry"] },
        { "from": ["grid", "Mesh"], "to": ["join", "Geometry"] },
        { "from": ["stand", "Geometry"], "to": ["join", "Geometry"] },
        { "from": ["join", "Geometry"], "to": ["merge", "Geometry"] },
        { "from": ["merge", "Geometry"], "to": ["unsigned", "Geometry"] },
        { "from": ["angle", "Unsigned Angle"], "to": ["unsigned", "Value"] }
      ],
      "output": ["unsigned", "Geometry"]
    }
  },
  {
    "id": "edge-angle-icosphere",
    "description": "Ico Sphere subdivision 1 (triangles only): signed and unsigned on edges",
    "tree": {
      "nodes": [
        { "name": "ico", "type": "GeometryNodeMeshIcoSphere" },
        { "name": "angle", "type": "GeometryNodeInputMeshEdgeAngle" },
        { "name": "unsigned", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "unsigned" } },
        { "name": "signed", "type": "GeometryNodeStoreNamedAttribute", "properties": { "data_type": "FLOAT", "domain": "EDGE" }, "inputs": { "Name": "signed" } }
      ],
      "links": [
        { "from": ["ico", "Mesh"], "to": ["unsigned", "Geometry"] },
        { "from": ["angle", "Unsigned Angle"], "to": ["unsigned", "Value"] },
        { "from": ["unsigned", "Geometry"], "to": ["signed", "Geometry"] },
        { "from": ["angle", "Signed Angle"], "to": ["signed", "Value"] }
      ],
      "output": ["signed", "Geometry"]
    }
  }
]
```

`edge-angle-grid-valleys` moves every vertex to `z = |x|` on a grid whose X coordinates
are -1.5, -0.5, 0.5, 1.5. The middle face is flat at z = 0.5 and the two outer faces rise away from
it, so the edges at x = ±0.5 are valleys seen from +Z (concave, for faces whose normals point up).
Expected: unsigned angle π/4 on both fold edges and 0 elsewhere; signed angle -π/4 on both folds.
