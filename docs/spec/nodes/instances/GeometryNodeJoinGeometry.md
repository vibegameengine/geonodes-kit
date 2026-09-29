# Join Geometry (`GeometryNodeJoinGeometry`)

Merges any number of geometries into one by concatenating the elements of each component type.

## Sockets

| Direction | Identifier | Type | Notes |
|---|---|---|---|
| in | `Geometry` | geometry, **multi-input** | any number of links |
| out | `Geometry` | geometry | |

No properties.

## Input order (multi-input socket)

The inputs are joined in the order of the links on the socket as the editor draws them, **top to
bottom**, which is **newest link first**:

- Each link to a multi-input socket gets a sort index when it is created: the number of links already
  on the socket. Evaluation orders the links by that index **descending**.
- So links created in the order L0, L1, L2 (for example with `tree.links.new` in that order) are
  joined as **L2, L1, L0**.
- Removing a link closes the gap (the indices above it move down by one); the relative order of the
  remaining links is kept. Reordering by dragging in the editor changes the indices.
- Links that are muted, come from an unavailable socket, or come from a dangling reroute (a reroute
  with nothing connected to its input) are skipped.
- With no links the output is empty geometry.

## Result per component type

The output name is the name of the first input (in join order), or empty. Bundles of all inputs are
merged. For each component type separately, only **non-empty** components are considered, in join
order:

- **None**: the output has no component of that type.
- **Exactly one**: that component is passed through **unchanged** (same attributes, domains, types,
  `id` untouched, no defaults added).
- **Two or more**: joined as described below.

### Mesh, point cloud, curves, Grease Pencil

Joined exactly as Realize Instances joins realized sources (see that spec), treating the inputs as
identity-transformed sources in join order, with two differences:

- **ids are kept**: an `id` attribute is created if any source has one; each source's point-domain int
  `id` values are copied unchanged, sources without `id` get **0**. No hashing.
- There are no instance attributes.

So element order is input order; topology indices are offset; attributes are the union over sources
(strings dropped), with the domain of highest priority (Corner > Point > Edge > Face > Curve >
Layer) and the most complex type, missing values filled with the type default (point cloud `radius`
0.01, curves `radius` 1.0, handles (0,0,0), curve built-ins their defaults); materials are unioned in
order of first appearance and `material_index` remapped; mesh custom normals follow the Realize
Instances rules; mesh / curves / point cloud parameters and Grease Pencil settings come from the
first source. The same component passed twice (e.g. one geometry linked twice) is duplicated.

### Instances

- Instances are concatenated in join order; transforms kept.
- References: each input's references are appended in order, and **identical references are merged**:
  the same object, the same collection, or geometry sets that share the very same component data (for
  example one Cube node output instanced by two nodes). Separately generated geometry that merely
  looks the same is not merged. Handles are remapped.
- Instance attributes: union over inputs (strings dropped; `.reference_index` handled internally),
  domain Instance, most complex type; inputs lacking an attribute get the type default (for
  `instance_transform`, its own values always exist).
- No `id` special-casing: an `id` instance attribute is a normal attribute here.

### Volume

Joining two or more volumes is **not supported: the output has no volume at all** (not even the
first). A single volume passes through.

### Edit data

Edit hints (used for sculpt/edit on deformed geometry) are joined too; not observable in exported
geometry.

## Reference cases

| id | expected |
|---|---|
| join-multi-input-order | 3 points with x = 3, 2, 1 |
| join-mesh-order | 6 vertices: the 4 grid vertices first, then the 2 line vertices; grid edges/faces first, line edge index offset by 4 |
| join-attr-merge | `foo` is FLOAT on POINT: 0.5 on the 4 vertices of grid B (its face value interpolated), then 7.0 on grid A |
| join-attr-missing | `bar` = 2.5 (the stored cloud, joined first), then 0.0 |
| join-id-kept | `id` = 0 (cloud without id, joined first), then 41 |
| join-radius-kept | radius 0.05, 0.05 (mesh-to-points cloud, joined first), then 0.3 |
| join-instances | 3 instances: the one at y = 9 with `w` = 4, then the two at x = 0, 1 with `w` = 0; one cube reference (both Instance on Points nodes reference the same Cube output) |
| join-mixed-components | a mesh (the grid), a point cloud (1 point) and 1 instance, each passed through |
| join-single-passthrough | the grid with face attribute `f` = 3 on the Face domain, no `id` |
| join-no-links | empty geometry |
| join-two-volumes | no volume component (the exporter has to report volume presence to check this) |

```json
[
  {
    "id": "join-multi-input-order",
    "description": "Three one-point clouds linked p1, p2, p3 in that order: the joined order is p3, p2, p1 (last linked first)",
    "tree": {
      "nodes": [
        {"name": "p1", "type": "GeometryNodePoints", "inputs": {"Count": 1, "Position": [1, 0, 0]}},
        {"name": "p2", "type": "GeometryNodePoints", "inputs": {"Count": 1, "Position": [2, 0, 0]}},
        {"name": "p3", "type": "GeometryNodePoints", "inputs": {"Count": 1, "Position": [3, 0, 0]}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["p1", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["p2", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["p3", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "join-mesh-order",
    "description": "Mesh line (2 vertices) linked first, grid 2x2 linked second: grid elements come first",
    "tree": {
      "nodes": [
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 2, "Offset": [0, 0, 5]}},
        {"name": "grid", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["join", "Geometry"]},
        {"from": ["grid", "Mesh"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "join-attr-merge",
    "description": "foo INT on the points of grid A and FLOAT on the face of grid B: result FLOAT on the Point domain",
    "tree": {
      "nodes": [
        {"name": "ga", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "sa", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "foo", "Value": 7}},
        {"name": "gb", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "sb", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "FACE"}, "inputs": {"Name": "foo", "Value": 0.5}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["ga", "Mesh"], "to": ["sa", "Geometry"]},
        {"from": ["gb", "Mesh"], "to": ["sb", "Geometry"]},
        {"from": ["sa", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["sb", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "join-attr-missing",
    "description": "bar exists only on the second-linked cloud: the other point gets 0",
    "tree": {
      "nodes": [
        {"name": "p1", "type": "GeometryNodePoints", "inputs": {"Count": 1, "Position": [1, 0, 0]}},
        {"name": "p2", "type": "GeometryNodePoints", "inputs": {"Count": 1, "Position": [2, 0, 0]}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "bar", "Value": 2.5}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["p2", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["p1", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["s", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "join-id-kept",
    "description": "id 41 on one cloud, none on the other: ids are kept unchanged and the missing ones are 0",
    "tree": {
      "nodes": [
        {"name": "p1", "type": "GeometryNodePoints", "inputs": {"Count": 1, "Position": [1, 0, 0]}},
        {"name": "p2", "type": "GeometryNodePoints", "inputs": {"Count": 1, "Position": [2, 0, 0]}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "INT", "domain": "POINT"}, "inputs": {"Name": "id", "Value": 41}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["p1", "Geometry"], "to": ["s", "Geometry"]},
        {"from": ["s", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["p2", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "join-radius-kept",
    "description": "A cloud with radius 0.3 joined with a mesh-to-points cloud of radius 0.05: radii kept per source",
    "tree": {
      "nodes": [
        {"name": "p1", "type": "GeometryNodePoints", "inputs": {"Count": 1, "Radius": 0.3}},
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 2}},
        {"name": "m2p", "type": "GeometryNodeMeshToPoints"},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["m2p", "Mesh"]},
        {"from": ["p1", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["m2p", "Points"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "join-instances",
    "description": "Two instance sets joined: instances concatenated in join order with their attributes",
    "tree": {
      "nodes": [
        {"name": "la", "type": "GeometryNodeMeshLine", "inputs": {"Count": 2, "Offset": [1, 0, 0]}},
        {"name": "lb", "type": "GeometryNodeMeshLine", "inputs": {"Count": 1, "Start Location": [0, 9, 0]}},
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "ia", "type": "GeometryNodeInstanceOnPoints"},
        {"name": "ib", "type": "GeometryNodeInstanceOnPoints"},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "INSTANCE"}, "inputs": {"Name": "w", "Value": 4}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["la", "Mesh"], "to": ["ia", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["ia", "Instance"]},
        {"from": ["lb", "Mesh"], "to": ["ib", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["ib", "Instance"]},
        {"from": ["ib", "Instances"], "to": ["s", "Geometry"]},
        {"from": ["ia", "Instances"], "to": ["join", "Geometry"]},
        {"from": ["s", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "join-mixed-components",
    "description": "Mesh, point cloud and instances joined: each component type is joined separately and all three are present",
    "tree": {
      "nodes": [
        {"name": "grid", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "p", "type": "GeometryNodePoints", "inputs": {"Count": 1, "Position": [1, 0, 0]}},
        {"name": "line", "type": "GeometryNodeMeshLine", "inputs": {"Count": 1}},
        {"name": "cube", "type": "GeometryNodeMeshCube"},
        {"name": "iop", "type": "GeometryNodeInstanceOnPoints"},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["line", "Mesh"], "to": ["iop", "Points"]},
        {"from": ["cube", "Mesh"], "to": ["iop", "Instance"]},
        {"from": ["grid", "Mesh"], "to": ["join", "Geometry"]},
        {"from": ["p", "Geometry"], "to": ["join", "Geometry"]},
        {"from": ["iop", "Instances"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "join-single-passthrough",
    "description": "A single input passes through untouched (id not created, attributes unchanged)",
    "tree": {
      "nodes": [
        {"name": "grid", "type": "GeometryNodeMeshGrid", "inputs": {"Vertices X": 2, "Vertices Y": 2}},
        {"name": "s", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "FACE"}, "inputs": {"Name": "f", "Value": 3}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["grid", "Mesh"], "to": ["s", "Geometry"]},
        {"from": ["s", "Geometry"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "join-no-links",
    "description": "No links: empty geometry",
    "tree": {
      "nodes": [
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
      ],
      "output": ["join", "Geometry"]
    }
  },
  {
    "id": "join-two-volumes",
    "description": "Two volumes joined: the output has no volume at all (volume joining is not supported)",
    "tree": {
      "nodes": [
        {"name": "v1", "type": "GeometryNodeVolumeCube"},
        {"name": "v2", "type": "GeometryNodeVolumeCube", "inputs": {"Min": [2, 2, 2], "Max": [3, 3, 3]}},
        {"name": "join", "type": "GeometryNodeJoinGeometry"}
      ],
      "links": [
        {"from": ["v1", "Volume"], "to": ["join", "Geometry"]},
        {"from": ["v2", "Volume"], "to": ["join", "Geometry"]}
      ],
      "output": ["join", "Geometry"]
    }
  }
]
```
