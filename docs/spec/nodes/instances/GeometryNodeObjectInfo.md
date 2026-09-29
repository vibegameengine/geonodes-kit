# Object Info (`GeometryNodeObjectInfo`)

Reads an object's transform and evaluated geometry.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Object` | object | none | single value |
| in | `As Instance` | bool | false | single value |
| out | `Transform` | matrix (4x4) | identity | |
| out | `Location` | vector | (0, 0, 0) | |
| out | `Rotation` | rotation (quaternion) | identity | |
| out | `Scale` | vector | **(0, 0, 0)** | note: the default when no object is set is zero, not one |
| out | `Geometry` | geometry | empty | |

## Properties

| Property | Values | Default |
|---|---|---|
| `transform_space` | `ORIGINAL`, `RELATIVE` | `ORIGINAL` |

Notation: `self` is the object that owns the evaluated modifier; `W(x)` its object-to-world matrix.

## No object

Every output takes its default: identity transform, location (0,0,0), identity rotation, **scale
(0,0,0)**, empty geometry.

## Transform outputs

`M = W(object)` for `ORIGINAL`, `M = W(self)^-1 * W(object)` for `RELATIVE`. If a needed transform is
not evaluated yet (dependency cycle) `M` is identity and an error is reported.

`Transform = M`. `Location`, `Rotation`, `Scale` are a decomposition of `M`:

- `Location` = translation column of `M`.
- Take the upper 3x3 part; `Scale` = the lengths of its three **columns** (x, y, z axes). Each column
  is normalized (a column with squared length `<= 1e-35` becomes zero).
- If the normalized 3x3 has a negative determinant, the whole normalized matrix is negated and **all
  three** scale components are negated. So an object with scale (-1, 1, 1) reports
  `Scale = (-1, -1, -1)` and `Rotation = 180 degrees about X`.
- The rotation is extracted from the normalized matrix as XYZ Euler angles (of the two possible Euler
  solutions, the one with the smaller sum of absolute angles), then converted to a quaternion. With
  shear, the result is whatever this procedure yields; it is not an exact decomposition.

The transform outputs are computed even when the geometry output fails (e.g. object == self).

## Geometry output

Only computed when used.

- If the object is `self` (compared as original data-blocks): error "Geometry cannot be retrieved from
  the modifier object", **all remaining outputs default** — but the transform outputs were already
  set and keep their values.
- If the object's geometry is not evaluated yet: error, geometry empty.
- `As Instance` false:
  - The object's evaluated geometry set (mesh, curves, point cloud, volume, Grease Pencil, instances),
    in the **object's local space**.
  - `RELATIVE`: the whole geometry set is then transformed by `W(self)^-1 * W(object)`, exactly as the
    Transform Geometry node in Matrix mode does (top-level only; see that spec).
  - An empty object that instances a collection yields one identity instance of that collection.
    Cameras, lights and other non-geometry objects yield empty geometry.
- `As Instance` true: one instance referencing the object itself (so any object type can be
  instanced), with transform identity (`ORIGINAL`) or `W(self)^-1 * W(object)` (`RELATIVE`).
- The geometry is named after the object.

## Reference cases

Data is created through the `scene` array described in `../README.md`. The runner's modifier
object is at the origin with identity transform and is named after the case id, which the two
`object-info-self-*` cases use to point the node at itself.

| id | expected |
|---|---|
| object-info-original | the cube's mesh in local space (not moved); `loc` = (1,2,3), `scl` = (2,2,2), `rot` = quaternion of Euler (0,0,0.5) = (cos 0.25, 0, 0, sin 0.25) on every vertex |
| object-info-relative | the cube's vertices transformed by T(1,2,3) R_z(0.5) S(2); `loc` (1,2,3) |
| object-info-as-instance | 1 instance, reference object `A`, identity transform |
| object-info-as-instance-relative | 1 instance, reference object `A`, transform = world matrix of `A` |
| object-info-negative-scale | `scl` = (-1,-1,-1); `rot` = 180 degrees about X, i.e. (w,x,y,z) = (0,1,0,0) up to sign |
| object-info-none-scale | `scl` = (0,0,0) |
| object-info-none-transform | `m` = identity |
| object-info-empty-geometry | empty geometry |
| object-info-empty-as-instance | 1 instance referencing object `E`, identity transform |
| object-info-self-location | `loc` = (0,0,0) (the case object's location) |
| object-info-self-geometry | empty geometry (error on the node) |

```json
[
  {
    "id": "object-info-original",
    "description": "ORIGINAL: geometry in the object's local space; Location/Scale/Rotation of the world matrix stored on its vertices",
    "scene": [{"collection": "Things", "objects": [{"name": "A", "mesh": "cube", "location": [1, 2, 3], "rotation": [0, 0, 0.5], "scale": [2, 2, 2]}]}],
    "tree": {
      "nodes": [
        {"name": "oi", "type": "GeometryNodeObjectInfo", "properties": {}, "inputs": {"Object": "A"}},
        {"name": "sl", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "loc"}},
        {"name": "ss", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "scl"}},
        {"name": "sr", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "QUATERNION", "domain": "POINT"}, "inputs": {"Name": "rot"}}
      ],
      "links": [
        {"from": ["oi", "Geometry"], "to": ["sl", "Geometry"]},
        {"from": ["oi", "Location"], "to": ["sl", "Value"]},
        {"from": ["sl", "Geometry"], "to": ["ss", "Geometry"]},
        {"from": ["oi", "Scale"], "to": ["ss", "Value"]},
        {"from": ["ss", "Geometry"], "to": ["sr", "Geometry"]},
        {"from": ["oi", "Rotation"], "to": ["sr", "Value"]}
      ],
      "output": ["sr", "Geometry"]
    }
  },
  {
    "id": "object-info-relative",
    "description": "RELATIVE with the modifier object at identity: geometry transformed by the object's world matrix",
    "scene": [{"collection": "Things", "objects": [{"name": "A", "mesh": "cube", "location": [1, 2, 3], "rotation": [0, 0, 0.5], "scale": [2, 2, 2]}]}],
    "tree": {
      "nodes": [
        {"name": "oi", "type": "GeometryNodeObjectInfo", "properties": {"transform_space": "RELATIVE"}, "inputs": {"Object": "A"}},
        {"name": "sl", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "loc"}},
        {"name": "ss", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "scl"}},
        {"name": "sr", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "QUATERNION", "domain": "POINT"}, "inputs": {"Name": "rot"}}
      ],
      "links": [
        {"from": ["oi", "Geometry"], "to": ["sl", "Geometry"]},
        {"from": ["oi", "Location"], "to": ["sl", "Value"]},
        {"from": ["sl", "Geometry"], "to": ["ss", "Geometry"]},
        {"from": ["oi", "Scale"], "to": ["ss", "Value"]},
        {"from": ["ss", "Geometry"], "to": ["sr", "Geometry"]},
        {"from": ["oi", "Rotation"], "to": ["sr", "Value"]}
      ],
      "output": ["sr", "Geometry"]
    }
  },
  {
    "id": "object-info-as-instance",
    "description": "As Instance, ORIGINAL: one identity instance referencing the object",
    "scene": [{"collection": "Things", "objects": [{"name": "A", "mesh": "cube", "location": [1, 2, 3], "rotation": [0, 0, 0.5], "scale": [2, 2, 2]}]}],
    "tree": {
      "nodes": [
        {"name": "oi", "type": "GeometryNodeObjectInfo", "inputs": {"Object": "A", "As Instance": true}}
      ],
      "links": [
      ],
      "output": ["oi", "Geometry"]
    }
  },
  {
    "id": "object-info-as-instance-relative",
    "description": "As Instance, RELATIVE: the instance carries the object's world matrix (modifier object at identity)",
    "scene": [{"collection": "Things", "objects": [{"name": "A", "mesh": "cube", "location": [1, 2, 3], "rotation": [0, 0, 0.5], "scale": [2, 2, 2]}]}],
    "tree": {
      "nodes": [
        {"name": "oi", "type": "GeometryNodeObjectInfo", "properties": {"transform_space": "RELATIVE"}, "inputs": {"Object": "A", "As Instance": true}}
      ],
      "links": [
      ],
      "output": ["oi", "Geometry"]
    }
  },
  {
    "id": "object-info-negative-scale",
    "description": "Object scale (-1,1,1) decomposes to Scale (-1,-1,-1) and a 180 degree rotation about X",
    "scene": [{"collection": "Things", "objects": [{"name": "N", "mesh": "cube", "scale": [-1, 1, 1]}]}],
    "tree": {
      "nodes": [
        {"name": "oi", "type": "GeometryNodeObjectInfo", "properties": {}, "inputs": {"Object": "N"}},
        {"name": "sl", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "loc"}},
        {"name": "ss", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "scl"}},
        {"name": "sr", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "QUATERNION", "domain": "POINT"}, "inputs": {"Name": "rot"}}
      ],
      "links": [
        {"from": ["oi", "Geometry"], "to": ["sl", "Geometry"]},
        {"from": ["oi", "Location"], "to": ["sl", "Value"]},
        {"from": ["sl", "Geometry"], "to": ["ss", "Geometry"]},
        {"from": ["oi", "Scale"], "to": ["ss", "Value"]},
        {"from": ["ss", "Geometry"], "to": ["sr", "Geometry"]},
        {"from": ["oi", "Rotation"], "to": ["sr", "Value"]}
      ],
      "output": ["sr", "Geometry"]
    }
  },
  {
    "id": "object-info-none-scale",
    "description": "No object: Scale output is (0,0,0)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "oi", "type": "GeometryNodeObjectInfo"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "scl"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["oi", "Scale"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "object-info-none-transform",
    "description": "No object: Transform output is identity",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "oi", "type": "GeometryNodeObjectInfo"},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT4X4", "domain": "POINT"}, "inputs": {"Name": "m"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["oi", "Transform"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "object-info-empty-geometry",
    "description": "An empty object has no geometry",
    "scene": [{"collection": "Things", "objects": [{"name": "E", "mesh": "empty", "location": [0, 5, 0]}]}],
    "tree": {
      "nodes": [
        {"name": "oi", "type": "GeometryNodeObjectInfo", "inputs": {"Object": "E"}}
      ],
      "links": [
      ],
      "output": ["oi", "Geometry"]
    }
  },
  {
    "id": "object-info-empty-as-instance",
    "description": "An empty object can still be instanced with As Instance",
    "scene": [{"collection": "Things", "objects": [{"name": "E", "mesh": "empty", "location": [0, 5, 0]}]}],
    "tree": {
      "nodes": [
        {"name": "oi", "type": "GeometryNodeObjectInfo", "inputs": {"Object": "E", "As Instance": true}}
      ],
      "links": [
      ],
      "output": ["oi", "Geometry"]
    }
  },
  {
    "id": "object-info-self-location",
    "description": "The modifier object itself (the case object, named after the case id): Location still works",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "oi", "type": "GeometryNodeObjectInfo", "inputs": {"Object": "object-info-self-location"}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT_VECTOR", "domain": "POINT"}, "inputs": {"Name": "loc"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["oi", "Location"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "object-info-self-geometry",
    "description": "The modifier object itself: geometry output is empty with an error",
    "tree": {
      "nodes": [
        {"name": "oi", "type": "GeometryNodeObjectInfo", "inputs": {"Object": "object-info-self-geometry"}}
      ],
      "links": [
      ],
      "output": ["oi", "Geometry"]
    }
  }
]
```
