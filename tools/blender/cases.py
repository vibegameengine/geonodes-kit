import json
import os
import sys

import bpy

sys.path.append(os.path.dirname(__file__))

from geometry_export import read_geometry


def socket_by_identifier(sockets, identifier):
    for socket in sockets:
        if socket.identifier == identifier:
            return socket
    raise KeyError(f"no socket {identifier} among {[socket.identifier for socket in sockets]}")


ID_SOCKETS = {
    "NodeSocketObject": "objects",
    "NodeSocketCollection": "collections",
    "NodeSocketMaterial": "materials",
    "NodeSocketImage": "images",
}

PRIMITIVES = {
    "cube": lambda: bpy.ops.mesh.primitive_cube_add(),
    "plane": lambda: bpy.ops.mesh.primitive_plane_add(),
}


def assign(target, value):
    return value if not isinstance(value, list) else tuple(value)


def socket_value(socket, value):
    library = ID_SOCKETS.get(socket.bl_idname)
    if library and isinstance(value, str):
        found = getattr(bpy.data, library).get(value)
        if found is None:
            raise KeyError(f"case refers to {library} '{value}' that the case scene does not create")
        return found
    return assign(socket, value)


def make_object(description):
    kind = description.get("mesh", "empty")
    if kind == "empty":
        obj = bpy.data.objects.new(description["name"], None)
    else:
        PRIMITIVES[kind]()
        obj = bpy.context.active_object
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        obj.name = description["name"]
    obj.location = description.get("location", (0, 0, 0))
    obj.rotation_euler = description.get("rotation", (0, 0, 0))
    obj.scale = description.get("scale", (1, 1, 1))
    return obj


def build_scene(case):
    for entry in case.get("scene", []):
        collection = bpy.data.collections.new(entry["collection"])
        bpy.context.scene.collection.children.link(collection)
        for description in entry.get("objects", []):
            collection.objects.link(make_object(description))


def build_tree(case):
    tree = bpy.data.node_groups.new(case["id"], "GeometryNodeTree")
    tree.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nodes = {}
    for description in case["tree"]["nodes"]:
        node = tree.nodes.new(description["type"])
        for key, value in description.get("properties", {}).items():
            setattr(node, key, assign(node, value))
        nodes[description["name"]] = node
    for description in case["tree"]["nodes"]:
        node = nodes[description["name"]]
        for identifier, value in description.get("inputs", {}).items():
            socket = socket_by_identifier(node.inputs, identifier)
            socket.default_value = socket_value(socket, value)
    for link in case["tree"]["links"]:
        source = socket_by_identifier(nodes[link["from"][0]].outputs, link["from"][1])
        target = socket_by_identifier(nodes[link["to"][0]].inputs, link["to"][1])
        tree.links.new(source, target)
    output = tree.nodes.new("NodeGroupOutput")
    source_node, source_socket = case["tree"]["output"]
    tree.links.new(socket_by_identifier(nodes[source_node].outputs, source_socket), output.inputs[0])
    return tree


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def evaluate(case):
    reset_scene()
    build_scene(case)
    mesh = bpy.data.meshes.new(case["id"])
    obj = bpy.data.objects.new(case["id"], mesh)
    bpy.context.scene.collection.objects.link(obj)
    modifier = obj.modifiers.new("case", "NODES")
    modifier.node_group = build_tree(case)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    return read_geometry(obj.evaluated_get(depsgraph).evaluated_geometry())


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    cases_file = args[0]
    output_dir = os.path.dirname(cases_file)
    with open(cases_file, encoding="utf8") as handle:
        cases = json.load(handle)
    os.makedirs(output_dir, exist_ok=True)
    failures = 0
    for case in cases:
        try:
            geometry = evaluate(case)
        except Exception as error:
            failures += 1
            print(f"[geonodes] FAILED {case['id']}: {type(error).__name__}: {error}")
            continue
        with open(os.path.join(output_dir, f"{case['id']}.json"), "w", encoding="utf8") as handle:
            json.dump({"blender": bpy.app.version_string, "case": case, "geometry": geometry}, handle, indent=1, allow_nan=False)
    print(f"[geonodes] {len(cases) - failures} captured, {failures} failed")


main()
