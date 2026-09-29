# Transform Geometry (`GeometryNodeTransform`)

Applies one affine transform to every component of the geometry, at the top level only.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Geometry` | geometry | | |
| in | `Mode` | menu | `Components` | `Components` or `Matrix`; a menu socket, not a node property |
| in | `Translation` | vector | (0, 0, 0) | Components mode only |
| in | `Rotation` | rotation (quaternion) | identity | Components mode only; a vector set/linked is XYZ Euler |
| in | `Scale` | vector | (1, 1, 1) | Components mode only |
| in | `Transform` | matrix 4x4 | identity | Matrix mode only |
| out | `Geometry` | geometry | | |

All inputs are single values (no fields). No node properties.

## Building the transform

- `Matrix` mode: `M = Transform`.
- `Components` mode: `M = T(Translation) * R(Rotation) * S(Scale)` (scale, then rotate, then
  translate).
  - **Translate-only shortcut**: if the squared length of the rotation quaternion's imaginary part
    `(x, y, z)` is `<= 1e-10` **and** each scale component is within `1e-9` of 1 (in float32 that
    means exactly 1), the rotation and scale are **ignored entirely** and only the translation is
    applied. A rotation of angle `theta` with `sin(theta/2) <= 1e-5`, i.e. `|theta| <= ~2e-5` rad, is
    therefore dropped. A quaternion with `w = -1` (a full turn) also counts as no rotation.
- If `M` is exactly the identity matrix (bit-exact comparison), nothing happens. In the
  translate-only path a zero translation does nothing.

## Effect per component

Only the top level of the geometry is touched; geometry referenced by instances is not modified
(instances are transformed as a whole).

| Component | Full transform `M` | Translate-only path |
|---|---|---|
| Mesh | vertex positions `p := M * p`; a `custom_normal` attribute of type float3 (free normals, any domain) is transformed by the inverse transpose of the 3x3 part and re-normalized (see below); corner-fan custom normals (int16 2D) are left as they are | positions `+= t`; nothing else |
| Point cloud | positions only; `radius` is **not** scaled | positions `+= t` |
| Curves | control point positions, `handle_left`, `handle_right`; `custom_normal` like the mesh; `radius`, `tilt`, `nurbs_weight` are **not** changed | positions and both handles `+= t` |
| Grease Pencil | each layer's local transform `L := M * L`; stroke point positions are **not** changed | each layer's translation `+= t` |
| Instances | each top-level instance transform `I := M * I` | each instance translation `+= t` |
| Volume | each grid's transform `G := M * G`. If the determinant of the result is invalid for the grid backend (too small), the grid's voxels are cleared, its scale is reset (axes normalized; axes reset to identity when the determinant is exactly 0) and the warning "Volume scale is lower than permitted by OpenVDB" is shown. A transform the backend rejects shows "Invalid transformation for volume grids" | handled like the full path with `M = T(t)` |
| Edit hints (curves / Grease Pencil / gizmos) | transformed alongside | translated alongside |

Generic vector attributes (UV maps, user "normal" attributes, velocities) are never transformed.

### Custom normal transform

With `N = transpose(inverse(M3x3))`: if `M3x3` is equal to identity within 1e-6 per entry, normals are
unchanged. If `N` is a similarity transform (uniform scale times rotation), each normal becomes
`normalize_columns(N) * n` (no per-normal renormalization needed). Otherwise each normal becomes
`normalize(N * n)` (zero vectors stay zero).

## Reference cases

```json
[
  {
    "id": "transform-tiny-rotation-dropped",
    "description": "Rotation of 1e-5 rad about Z with unit scale takes the translate-only path: rotation is ignored",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [1000, 0, 0] } },
        { "name": "move", "type": "GeometryNodeTransform", "inputs": { "Translation": [0, 0, 1], "Rotation": [0, 0, 0.00001] } }
      ],
      "links": [{ "from": ["line", "Mesh"], "to": ["move", "Geometry"] }],
      "output": ["move", "Geometry"]
    }
  },
  {
    "id": "transform-small-rotation-applied",
    "description": "Rotation of 1e-4 rad about Z is applied: vertex 1 moves to (1000*cos, 1000*sin, 1)",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [1000, 0, 0] } },
        { "name": "move", "type": "GeometryNodeTransform", "inputs": { "Translation": [0, 0, 1], "Rotation": [0, 0, 0.0001] } }
      ],
      "links": [{ "from": ["line", "Mesh"], "to": ["move", "Geometry"] }],
      "output": ["move", "Geometry"]
    }
  },
  {
    "id": "transform-instances-top-level",
    "description": "Scale 2 applied to instances: instance transforms become M*I, the referenced cube is untouched",
    "tree": {
      "nodes": [
        { "name": "line", "type": "GeometryNodeMeshLine", "inputs": { "Count": 2, "Offset": [1, 0, 0] } },
        { "name": "cube", "type": "GeometryNodeMeshCube" },
        { "name": "iop", "type": "GeometryNodeInstanceOnPoints" },
        { "name": "move", "type": "GeometryNodeTransform", "inputs": { "Translation": [0, 0, 5], "Scale": [2, 2, 2] } }
      ],
      "links": [
        { "from": ["line", "Mesh"], "to": ["iop", "Points"] },
        { "from": ["cube", "Mesh"], "to": ["iop", "Instance"] },
        { "from": ["iop", "Instances"], "to": ["move", "Geometry"] }
      ],
      "output": ["move", "Geometry"]
    }
  },
  {
    "id": "transform-pointcloud-radius",
    "description": "Point cloud scaled by 3: positions scale, radius stays 0.1",
    "tree": {
      "nodes": [
        { "name": "pts", "type": "GeometryNodePoints", "inputs": { "Count": 1, "Position": [1, 0, 0], "Radius": 0.1 } },
        { "name": "move", "type": "GeometryNodeTransform", "inputs": { "Scale": [3, 3, 3] } }
      ],
      "links": [{ "from": ["pts", "Geometry"], "to": ["move", "Geometry"] }],
      "output": ["move", "Geometry"]
    }
  },
  {
    "id": "transform-bezier-handles",
    "description": "Bezier segment rotated 90 degrees about Z: control points and handles rotate",
    "tree": {
      "nodes": [
        { "name": "bez", "type": "GeometryNodeCurvePrimitiveBezierSegment" },
        { "name": "move", "type": "GeometryNodeTransform", "inputs": { "Rotation": [0, 0, 1.5707964] } }
      ],
      "links": [{ "from": ["bez", "Curve"], "to": ["move", "Geometry"] }],
      "output": ["move", "Geometry"]
    }
  },
  {
    "id": "transform-matrix-mode",
    "description": "Matrix mode with a Combine Transform (translation (1,2,3), rotation (0,0,0.5), scale (1,2,3))",
    "tree": {
      "nodes": [
        { "name": "grid", "type": "GeometryNodeMeshGrid", "inputs": { "Vertices X": 2, "Vertices Y": 2 } },
        { "name": "m", "type": "FunctionNodeCombineTransform", "inputs": { "Translation": [1, 2, 3], "Rotation": [0, 0, 0.5], "Scale": [1, 2, 3] } },
        { "name": "move", "type": "GeometryNodeTransform", "inputs": { "Mode": "Matrix" } }
      ],
      "links": [
        { "from": ["grid", "Mesh"], "to": ["move", "Geometry"] },
        { "from": ["m", "Transform"], "to": ["move", "Transform"] }
      ],
      "output": ["move", "Geometry"]
    }
  }
]
```

Further proposed cases (need a way to create free custom normals, e.g. Set Mesh Normal in free mode):
`transform-custom-normal-nonuniform` — a quad with a float3 point-domain `custom_normal` of (1,1,0)
normalized, scaled by (2,1,1): expected normal `normalize((0.5, 1, 0))`.
`transform-grease-pencil` — expected: layer transform changes, stroke positions do not (needs
Grease Pencil export in `geometry_export.py`).
