import json
import sys

import bpy


def reachable_trees(tree, seen):
    if tree is None or tree.name in seen:
        return
    seen[tree.name] = tree
    for node in tree.nodes:
        if node.bl_idname == "GeometryNodeGroup":
            reachable_trees(node.node_tree, seen)


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    blend, output = args[0], args[1]
    bpy.ops.wm.open_mainfile(filepath=blend)
    roots = []
    trees = {}
    for obj in bpy.data.objects:
        for modifier in obj.modifiers:
            if modifier.type == "NODES" and modifier.node_group:
                roots.append({"object": obj.name, "modifier": modifier.name, "tree": modifier.node_group.name})
                reachable_trees(modifier.node_group, trees)
    usage = {}
    for tree in trees.values():
        for node in tree.nodes:
            usage[node.bl_idname] = usage.get(node.bl_idname, 0) + 1
    evaluated = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for root in roots:
        obj = bpy.data.objects[root["object"]].evaluated_get(depsgraph)
        entry = {"object": root["object"], "api": [name for name in dir(obj) if "geometry" in name.lower()]}
        if hasattr(obj, "evaluated_geometry"):
            geometry = obj.evaluated_geometry()
            entry["geometry_set"] = [name for name in dir(geometry) if not name.startswith("_")]
            entry["mesh_vertices"] = len(geometry.mesh.vertices) if geometry.mesh else 0
            entry["instance_references"] = len(geometry.instance_references())
        evaluated.append(entry)
    with open(output, "w", encoding="utf8") as handle:
        json.dump({"blend": blend, "roots": roots, "trees": sorted(trees), "usage": dict(sorted(usage.items())), "evaluated": evaluated}, handle, indent=1)
    print(f"[geonodes] {len(roots)} modifier roots, {len(trees)} trees, {len(usage)} node types, {sum(usage.values())} nodes")


main()
