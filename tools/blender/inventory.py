import json
import sys

import bpy


def socket_default(socket):
    if not hasattr(socket, "default_value"):
        return None
    value = socket.default_value
    if isinstance(value, (int, float, bool, str)):
        return value
    try:
        return list(value)
    except TypeError:
        return getattr(value, "name", str(value))


def describe_socket(socket):
    entry = {
        "identifier": socket.identifier,
        "name": socket.name,
        "type": socket.bl_idname,
        "default": socket_default(socket),
    }
    if getattr(socket, "is_multi_input", False):
        entry["multiInput"] = True
    if getattr(socket, "hide_value", False):
        entry["hideValue"] = True
    if not socket.enabled:
        entry["disabledByDefault"] = True
    return entry


def describe_properties(node):
    base = {prop.identifier for prop in bpy.types.GeometryNode.bl_rna.properties} | {prop.identifier for prop in bpy.types.Node.bl_rna.properties}
    properties = []
    for prop in node.bl_rna.properties:
        if prop.identifier in base or prop.identifier in {"rna_type"}:
            continue
        entry = {"identifier": prop.identifier, "type": prop.type}
        if prop.type == "ENUM":
            entry["items"] = [item.identifier for item in prop.enum_items]
            value = getattr(node, prop.identifier)
            entry["default"] = sorted(value) if isinstance(value, set) else value
        elif prop.type in {"BOOLEAN", "INT", "FLOAT", "STRING"} and getattr(prop, "array_length", 0) == 0:
            entry["default"] = getattr(node, prop.identifier)
        properties.append(entry)
    return properties


def node_classes():
    for name in dir(bpy.types):
        cls = getattr(bpy.types, name)
        if isinstance(cls, type) and issubclass(cls, bpy.types.Node) and cls is not bpy.types.Node:
            yield name


def main():
    output = sys.argv[sys.argv.index("--") + 1]
    tree = bpy.data.node_groups.new("inventory", "GeometryNodeTree")
    nodes = []
    for idname in node_classes():
        try:
            node = tree.nodes.new(idname)
        except RuntimeError:
            continue
        nodes.append({
            "idname": idname,
            "label": node.bl_label,
            "inputs": [describe_socket(socket) for socket in node.inputs],
            "outputs": [describe_socket(socket) for socket in node.outputs],
            "properties": describe_properties(node),
        })
        tree.nodes.remove(node)
    nodes.sort(key=lambda entry: entry["idname"])
    with open(output, "w", encoding="utf8") as handle:
        json.dump({"blender": bpy.app.version_string, "hash": bpy.app.build_hash.decode(), "nodes": nodes}, handle, indent=1)
    print(f"[geonodes] {len(nodes)} node types usable in a GeometryNodeTree, Blender {bpy.app.version_string}")


main()
