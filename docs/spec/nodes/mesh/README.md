# Mesh node specifications

Behaviour specifications for mesh nodes of Blender 5.2.2 Geometry Nodes, written by an analyst
under [`docs/process.md`](../../../process.md). They describe behaviour only. Each file ends with
reference cases in the JSON format of `reference/cases/cases.json` (socket keys are socket
identifiers).

## Files

| File | Node | Label |
|---|---|---|
| [GeometryNodeMeshGrid.md](GeometryNodeMeshGrid.md) | `GeometryNodeMeshGrid` | Grid |
| [GeometryNodeExtrudeMesh.md](GeometryNodeExtrudeMesh.md) | `GeometryNodeExtrudeMesh` | Extrude Mesh |
| [GeometryNodeMeshToPoints.md](GeometryNodeMeshToPoints.md) | `GeometryNodeMeshToPoints` | Mesh to Points |
| [GeometryNodeSeparateGeometry.md](GeometryNodeSeparateGeometry.md) | `GeometryNodeSeparateGeometry` | Separate Geometry |
| [GeometryNodeSetShadeSmooth.md](GeometryNodeSetShadeSmooth.md) | `GeometryNodeSetShadeSmooth` | Set Shade Smooth |
| [GeometryNodeInputShadeSmooth.md](GeometryNodeInputShadeSmooth.md) | `GeometryNodeInputShadeSmooth` | Is Face Smooth |
| [GeometryNodeInputEdgeSmooth.md](GeometryNodeInputEdgeSmooth.md) | `GeometryNodeInputEdgeSmooth` | Is Edge Smooth |
| [GeometryNodeInputMeshEdgeAngle.md](GeometryNodeInputMeshEdgeAngle.md) | `GeometryNodeInputMeshEdgeAngle` | Edge Angle |

## Conventions used in these files

- A mesh has four domains: Point (vertices), Edge, Face, Corner. Each face owns a contiguous range
  of corners; corner `i` of a face has a vertex and an edge, and that edge runs from corner `i`'s
  vertex to corner `i+1`'s vertex (wrapping).
- An edge stores two vertex indices in a fixed order; "first vertex" means index 0 of that pair.
- Built-in mesh attributes that matter here: `position` (point, float3), `sharp_face` (face, bool),
  `sharp_edge` (edge, bool), `material_index` (face, int).
- "Loose" vertex: used by no edge. "Loose" edge: used by no face. A vertex can be non-loose and
  still have no faces (it is used only by loose edges).
- Inputs that the inventory lists with a plain default but that read a field when unlinked
  (Extrude `Offset` = Normal, Mesh to Points `Position` = Position) are called out in each file.
- Integer and float sockets with a UI range hold their own value inside it; values arriving
  through links are not clamped. Reference cases feed out-of-range values through links.

## Mesh domain interpolation

Several nodes read an attribute stored on one domain while evaluating on another. The adapted value
is defined as follows. "Mean" is the arithmetic mean using the type's mixing: ints are averaged in
double precision and rounded to nearest; float colours default to (0,0,0,1) and 4x4 matrices to
identity when there is nothing to average; everything else defaults to zero.

| From -> To | Non-bool | Bool |
|---|---|---|
| Point -> Edge | mean of the two vertices (50/50 mix) | both vertices true |
| Point -> Face | mean over the face's corners' vertices | every vertex true |
| Point -> Corner | value of the corner's vertex | same |
| Edge -> Point | mean over the edges using the vertex; 0 if none | any edge true |
| Edge -> Face | mean over the face's edges | every edge true |
| Edge -> Corner | mean of the corner's edge and the previous corner's edge | both true |
| Face -> Point | mean over the faces using the vertex; 0 if none | any face true |
| Face -> Edge | mean over the faces using the edge (a face using it twice counts twice); 0 if none | any face true |
| Face -> Corner | value of the corner's face | same |
| Corner -> Point | mean over the faces using the vertex of that face's (first) corner at the vertex; 0 if none | every corner at the vertex true; a loose vertex is false; a vertex used only by loose edges is true |
| Corner -> Face | mean over the face's corners | every corner true |
| Corner -> Edge | mean of, for every face corner whose edge it is, that corner and the next corner | every such pair true; loose edges false |

A single constant value is carried unchanged to every element of the other domain when every
target element has something to take it from. When some target elements have nothing (loose
vertices for an Edge source; vertices without faces or loose edges for a Face or Corner source),
the full rules of the table apply instead, so those elements get the default or bool result above.

## Source areas consulted

In the Blender 5.2.2 source (tag `v5.2.2`), read by the analyst only:

- `source/blender/nodes/geometry/nodes/`: `node_geo_mesh_primitive_grid.cc`,
  `node_geo_extrude_mesh.cc`, `node_geo_mesh_to_points.cc`, `node_geo_separate_geometry.cc`,
  `node_geo_set_shade_smooth.cc`, `node_geo_input_face_smooth.cc`,
  `node_geo_input_edge_smooth.cc`, `node_geo_input_mesh_edge_angle.cc`
- `source/blender/geometry/intern/`: `mesh_primitive_grid.cc`, `separate_geometry.cc`,
  `mesh_copy_selection.cc`, `mesh_selection.cc`, `foreach_geometry.cc`
- `source/blender/blenkernel/`: `BKE_attribute_math.hh`, `intern/attribute_math.cc`,
  `intern/mesh_attributes.cc` (domain interpolation, built-in attributes),
  `intern/pointcloud_attributes.cc`, `intern/geometry_component_mesh.cc` (normal field per domain),
  `intern/geometry_fields.cc` (attribute field input, field capture), `intern/mesh.cc`
  (smooth/sharp helpers), `intern/mesh_normals.cc`, `intern/mesh_tessellate.cc`,
  `intern/instances.cc`
- `source/blender/blenlib/`: `intern/math_vector.cc`, `intern/math_geom.cc`,
  `BLI_math_vector.hh` (normalization threshold, angle and normal formulas)
- `source/blender/functions/intern/multi_function_common.cc` (the `max(float, float)` used for the
  radius clamp)

Enum identifiers and socket identifiers were taken from this kit's own inventory,
`coverage/nodes-5.2.2.json`, because `source/blender/makesrna` is not in the checkout.

## Open points to settle with reference captures

- **Signed edge angle sign.** The computation makes convex edges positive (a cube reads +π/2); the
  socket tooltip says concave is positive. `edge-angle-cube` decides it.
- **Single-value attribute storage in Extrude Mesh.** An attribute stored as one constant keeps that
  constant on new elements, including where the mixing rules would give zero (for example the face
  attribute of a side face made from a loose edge). Whether a constant Store Named Attribute on the
  face domain of a mesh with zero faces produces such storage is not certain;
  `extrude-edges-loose-single-value` shows it.
- **Grid with zero faces.** Whether the empty `sharp_face` attribute shows up in an attribute
  listing of a 1-by-N grid.
- **Default quaternion and colour values in Extrude Mesh** when nothing is mixed in (edge-mode
  corners of a loose edge use the type's zero; the mixers' defaults are listed in
  GeometryNodeExtrudeMesh.md) have no reference case yet.
- **Store Named Attribute socket identifier** after changing `data_type`: the cases assume it stays
  `Value`.
- **Merge by Distance face order** in the non-manifold cases: the cases assume the grid's faces stay
  first.
