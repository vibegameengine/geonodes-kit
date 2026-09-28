import json
import os
import sys

import bpy

sys.path.append(os.path.dirname(__file__))

from geometry_export import read_geometry


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    blend, object_name, output = args[0], args[1], args[2]
    bpy.ops.wm.open_mainfile(filepath=blend)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = bpy.data.objects[object_name].evaluated_get(depsgraph)
    geometry = read_geometry(evaluated.evaluated_geometry())
    with open(output, "w", encoding="utf8") as handle:
        json.dump({"blender": bpy.app.version_string, "blend": blend, "object": object_name, "geometry": geometry}, handle, allow_nan=False)
    instances = geometry.get("instances", {})
    print(f"[geonodes] {object_name}: components {sorted(geometry)}, {instances.get('count', 0)} instances, {len(instances.get('references', []))} references")


main()
