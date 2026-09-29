# Collection Info (`GeometryNodeCollectionInfo`)

Outputs instances of a collection: either one instance of the whole collection, or one instance per
direct child (child collection or object).

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Collection` | collection | none | single value |
| in | `Separate Children` | bool | false | single value |
| in | `Reset Children` | bool | false | single value; only read when Separate Children is true |
| out | `Instances` | geometry | | instances only |

## Properties

| Property | Values | Default |
|---|---|---|
| `transform_space` | `ORIGINAL`, `RELATIVE` | `ORIGINAL` |

Notation: `self` is the object that owns the evaluated modifier; `W(x)` is the world matrix of object
`x` (object-to-world); `W(self)^-1` its inverse; `off(c)` the collection's `instance_offset`;
`T(v)` a translation matrix.

## Errors and empty output

The output is empty geometry when:

- no collection is set;
- the collection contains `self`, directly or through nested collections or collection-instancing
  objects (error "Collection contains current object");
- the collection's geometry is not evaluated yet (dependency cycle; error message).

## Separate Children = false

One instance whose reference is the collection itself.

| transform_space | instance transform |
|---|---|
| `ORIGINAL` | identity |
| `RELATIVE` | `W(self)^-1 * T(off(C))` |

The output geometry is named after the collection.

## Separate Children = true

One instance per **direct** child: every child collection of C and every object directly in C.
Nested content is not flattened: a child collection is referenced as a collection.

Transforms, with Reset Children **false**:

| child | `ORIGINAL` | `RELATIVE` |
|---|---|---|
| child collection D | `T(off(D) - off(C))` | `W(self)^-1 * T(off(D))` |
| object O | `T(-off(C)) * W(O)` | `W(self)^-1 * W(O)` |

With Reset Children **true** every transform is identity (in both spaces).

**Order**: all children (collections and objects together) are sorted by name with Blender's
*natural, case-insensitive* comparison:

- characters are compared case-insensitively;
- a run of digits in both names is compared as a number (leading zeros skipped; a longer run of
  significant digits is larger; equal numbers are then compared character by character), so
  `Cube2 < Cube10`;
- where one name has `.` and the other a different character at the same position, the `.` sorts
  first (`foo.bar < foo 1.bar`);
- if one name is a prefix of the other, the shorter sorts first (`Cube < Cube.001`);
- if everything above ties, the name with **more** leading zeros in a tied number sorts after; if still
  tied (names differing only in case), plain byte comparison decides (upper case before lower
  case).

A child collection and an object with exactly the same name have an unspecified relative order.

## How a collection reference becomes geometry

When an instance references a collection (this node's single instance, a child collection, or a
collection instanced by an object), realizing it or reading it as geometry turns the collection C
into instances, **not recursively flattened**:

1. First, one instance per child collection D of C, in the collection's child order (not sorted),
   referencing D with transform `T(off(D) - off(C))`.
2. Then one instance per object O directly in C, in the collection's object order, referencing O with
   transform `T(-off(C)) * W(O)`.
3. An object reference becomes the object's evaluated geometry in its local space (mesh, curves,
   point cloud, volume, Grease Pencil, plus its own instances). An empty that instances a collection
   becomes one identity instance of that collection. Cameras, lights, speakers and armatures, and
   objects whose geometry the dependency graph has not evaluated, contribute no geometry (which
   objects fall in that group, e.g. viewport-disabled ones, is not pinned here).

Nested collections are handled by applying these steps again at each level. Objects appear once per
path: an object linked into two child collections appears twice.

Note: the order of the original collection's object list and child list is the order shown in the
Outliner (link order), not alphabetical. Only Separate Children sorts.

## Reference cases

The cases create their data through the `scene` array described in `../README.md`. The runner's
modifier object sits at the origin with identity transform, so `RELATIVE` equals `ORIGINAL` for
these scenes and no RELATIVE case is included. Child collections and instance offsets cannot be
declared yet; see the open cases below.

| id | expected |
|---|---|
| collection-info-whole | 1 instance, reference = collection `Parts`, identity transform |
| collection-info-whole-realized | one mesh: the `b_obj` cube's vertices first, then the `a_obj` plane's, each transformed by its object's world matrix |
| collection-info-separate-order | 4 instances referencing `b`, `Cube.001`, `cube2`, `Cube10` in that order (translations z = 0, 1, 2, 10) |
| collection-info-separate-transform | 1 instance referencing `A`, transform = world matrix of `A` (T(1,2,3) R_z(0.5) S(2,1,1)) |
| collection-info-reset | 1 instance referencing `A`, identity transform |
| collection-info-reset-ignored | 1 instance referencing the collection `Moved`, identity transform |
| collection-info-none | empty geometry |

```json
[
  {
    "id": "collection-info-whole",
    "description": "Whole collection, ORIGINAL: one identity instance referencing the collection",
    "scene": [{"collection": "Parts", "objects": [{"name": "b_obj", "mesh": "cube", "location": [1, 0, 0]}, {"name": "a_obj", "mesh": "plane", "location": [3, 0, 0], "rotation": [0, 0, 0.5]}]}],
    "tree": {
      "nodes": [
        {"name": "ci", "type": "GeometryNodeCollectionInfo", "inputs": {"Collection": "Parts"}}
      ],
      "links": [
      ],
      "output": ["ci", "Instances"]
    }
  },
  {
    "id": "collection-info-whole-realized",
    "description": "Whole collection realized: objects in collection link order (b_obj before a_obj), each at its world transform",
    "scene": [{"collection": "Parts", "objects": [{"name": "b_obj", "mesh": "cube", "location": [1, 0, 0]}, {"name": "a_obj", "mesh": "plane", "location": [3, 0, 0], "rotation": [0, 0, 0.5]}]}],
    "tree": {
      "nodes": [
        {"name": "ci", "type": "GeometryNodeCollectionInfo", "inputs": {"Collection": "Parts"}},
        {"name": "real", "type": "GeometryNodeRealizeInstances"}
      ],
      "links": [
        {"from": ["ci", "Instances"], "to": ["real", "Geometry"]}
      ],
      "output": ["real", "Geometry"]
    }
  },
  {
    "id": "collection-info-separate-order",
    "description": "Separate Children sorts by natural case-insensitive name: b, Cube.001, cube2, Cube10",
    "scene": [{"collection": "Named", "objects": [{"name": "Cube10", "mesh": "empty", "location": [0, 0, 10]}, {"name": "cube2", "mesh": "empty", "location": [0, 0, 2]}, {"name": "Cube.001", "mesh": "empty", "location": [0, 0, 1]}, {"name": "b", "mesh": "empty", "location": [0, 0, 0]}]}],
    "tree": {
      "nodes": [
        {"name": "ci", "type": "GeometryNodeCollectionInfo", "inputs": {"Collection": "Named", "Separate Children": true}}
      ],
      "links": [
      ],
      "output": ["ci", "Instances"]
    }
  },
  {
    "id": "collection-info-separate-transform",
    "description": "Separate Children, ORIGINAL: the object instance carries the object's world matrix",
    "scene": [{"collection": "Moved", "objects": [{"name": "A", "mesh": "cube", "location": [1, 2, 3], "rotation": [0, 0, 0.5], "scale": [2, 1, 1]}]}],
    "tree": {
      "nodes": [
        {"name": "ci", "type": "GeometryNodeCollectionInfo", "inputs": {"Collection": "Moved", "Separate Children": true}}
      ],
      "links": [
      ],
      "output": ["ci", "Instances"]
    }
  },
  {
    "id": "collection-info-reset",
    "description": "Separate Children with Reset Children: identity transform",
    "scene": [{"collection": "Moved", "objects": [{"name": "A", "mesh": "cube", "location": [1, 2, 3], "rotation": [0, 0, 0.5], "scale": [2, 1, 1]}]}],
    "tree": {
      "nodes": [
        {"name": "ci", "type": "GeometryNodeCollectionInfo", "inputs": {"Collection": "Moved", "Separate Children": true, "Reset Children": true}}
      ],
      "links": [
      ],
      "output": ["ci", "Instances"]
    }
  },
  {
    "id": "collection-info-reset-ignored",
    "description": "Reset Children without Separate Children is ignored: one identity instance of the collection",
    "scene": [{"collection": "Moved", "objects": [{"name": "A", "mesh": "cube", "location": [1, 2, 3], "rotation": [0, 0, 0.5], "scale": [2, 1, 1]}]}],
    "tree": {
      "nodes": [
        {"name": "ci", "type": "GeometryNodeCollectionInfo", "inputs": {"Collection": "Moved", "Reset Children": true}}
      ],
      "links": [
      ],
      "output": ["ci", "Instances"]
    }
  },
  {
    "id": "collection-info-none",
    "description": "No collection: empty output",
    "tree": {
      "nodes": [
        {"name": "ci", "type": "GeometryNodeCollectionInfo"}
      ],
      "links": [
      ],
      "output": ["ci", "Instances"]
    }
  }
]
```

Open cases that need child collections, instance offsets and a non-identity modifier object
(not expressible in the current `scene` shape):

| id | setup | expected |
|---|---|---|
| collection-info-child-first | collection C (offset (0,0,1)) with object `b_obj` and child collection D (offset (0,2,0)) holding `a_obj`; realize | `a_obj` (via D) realized before `b_obj`; both at world position minus off(C) |
| collection-info-separate-child-transform | same, Separate Children, ORIGINAL | D instance transform T((0,2,-1)); `b_obj` T((0,0,-1)) * W(b_obj) |
| collection-info-relative | modifier object at (10,0,0), RELATIVE, whole collection | transform W(self)^-1 * T(off(C)); realized x shifted by -10 |
| collection-info-self | collection containing the modifier object | empty output, error |
