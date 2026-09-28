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


def assign(target, value):
    return value if not isinstance(value, list) else tuple(value)


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
            socket_by_identifier(node.inputs, identifier).default_value = assign(node, value)
    for link in case["tree"]["links"]:
        source = socket_by_identifier(nodes[link["from"][0]].outputs, link["from"][1])
        target = socket_by_identifier(nodes[link["to"][0]].inputs, link["to"][1])
        tree.links.new(source, target)
    output = tree.nodes.new("NodeGroupOutput")
    source_node, source_socket = case["tree"]["output"]
    tree.links.new(socket_by_identifier(nodes[source_node].outputs, source_socket), output.inputs[0])
    return tree


def evaluate(case):
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
    for case in cases:
        geometry = evaluate(case)
        with open(os.path.join(output_dir, f"{case['id']}.json"), "w", encoding="utf8") as handle:
            json.dump({"blender": bpy.app.version_string, "case": case, "geometry": geometry}, handle, indent=1, allow_nan=False)
        print(f"[geonodes] {case['id']}: {sorted(geometry)}")


main()
