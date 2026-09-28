# Acceptance assets

Whole Geometry Nodes assets that the kit must evaluate like Blender does. The `.blend` files are not
committed. `npm run assets` downloads them into the git-ignored `reference/cache/`.

## Procedural Hong Kong building

- **Author:** uday udayjeet
- **Source:** https://sketchfab.com/3d-models/procedural-hong-kong-building-528a732e84c44fd49c4726f341014a23
- **Licence:** CC Attribution 4.0. Credit the author; commercial use is allowed.
- **File used:** the copy re-saved in Blender 5.0 (header `BLENDER17-01`) from
  https://github.com/achrefelouafi/BuildingGeneratorThreeJS. The other files in that repository are
  somebody else's port and are not used here.

**What Blender 5.2.2 reports** (`npm run usage -- reference/cache/hong-kong-building.blend <out.json>`):
- 666 Geometry Nodes modifiers. One is the generator, `build system` on object `Cube.001`; the rest
  are the `Auto Smooth` group on the kit's part objects.
- 23 node types besides frames and group input/output, 602 nodes in total.

| Family | Node types |
|---|---|
| Function | Boolean Math, Compare, Random Value |
| Geometry | Collection Info, Extrude Mesh, Edge Smooth, Edge Angle, Position, Shade Smooth, Instance on Points, Join Geometry, Grid, Mesh to Points, Object Info, Realize Instances, Separate Geometry, Set Shade Smooth, Switch, Transform, Translate Instances |
| Shader | Combine XYZ, Math, Separate XYZ |

**Reference output of `Cube.001`** (`npm run reference -- reference/cache/hong-kong-building.blend Cube.001 <out.json>`):
- 1 453 instances over 125 references: 45 objects, 79 collections, 1 nested geometry.
- The mesh component is present but empty.

## Notes on reading Blender's output

- **The instances component exposes a `position` attribute through Python, but it holds garbage:**
  denormals, NaN and values near 1e30 in 5.2.2. An instance's position is the translation of its
  `instance_transform`. The reference exporter skips that attribute.
