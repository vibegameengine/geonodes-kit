import bpy

VALUE_KEY = {
    "FLOAT": ("value", 1),
    "INT": ("value", 1),
    "INT8": ("value", 1),
    "BOOLEAN": ("value", 1),
    "FLOAT2": ("vector", 2),
    "INT32_2D": ("value", 2),
    "FLOAT_VECTOR": ("vector", 3),
    "FLOAT_COLOR": ("color", 4),
    "BYTE_COLOR": ("color", 4),
    "QUATERNION": ("value", 4),
    "FLOAT4X4": ("value", 16),
}


def read_attribute(attribute):
    key, width = VALUE_KEY.get(attribute.data_type, (None, 0))
    entry = {"name": attribute.name, "domain": attribute.domain, "type": attribute.data_type}
    if key is None:
        entry["values"] = None
        return entry
    values = [0] * (len(attribute.data) * width)
    attribute.data.foreach_get(key, values)
    entry["values"] = finite([float(v) if attribute.data_type not in {"INT", "INT8", "BOOLEAN", "INT32_2D"} else int(v) for v in values])
    return entry


INSTANCE_POSITION_IS_NOT_STORED = "position"


def read_attributes(owner, skip=()):
    return [read_attribute(attribute) for attribute in owner.attributes if attribute.name not in skip]


def finite(values):
    return [None if isinstance(v, float) and v != v else v for v in values]


def read_mesh(mesh):
    edges = [0] * (len(mesh.edges) * 2)
    mesh.edges.foreach_get("vertices", edges)
    starts = [0] * len(mesh.polygons)
    mesh.polygons.foreach_get("loop_start", starts)
    sizes = [0] * len(mesh.polygons)
    mesh.polygons.foreach_get("loop_total", sizes)
    corners = [0] * len(mesh.loops)
    mesh.loops.foreach_get("vertex_index", corners)
    return {
        "vertices": len(mesh.vertices),
        "edges": edges,
        "faceStarts": starts,
        "faceSizes": sizes,
        "cornerVertices": corners,
        "attributes": read_attributes(mesh),
    }


def read_reference(reference, depth):
    if reference is None:
        return {"kind": "geometry", "geometry": {}}
    if isinstance(reference, bpy.types.Object):
        return {"kind": "object", "name": reference.name}
    if isinstance(reference, bpy.types.Collection):
        return {"kind": "collection", "name": reference.name}
    return {"kind": "geometry", "geometry": read_geometry(reference, depth + 1)}


def read_geometry(geometry, depth=0):
    result = {}
    if geometry.mesh:
        result["mesh"] = read_mesh(geometry.mesh)
    if geometry.pointcloud:
        result["pointcloud"] = {"points": len(geometry.pointcloud.points), "attributes": read_attributes(geometry.pointcloud)}
    if geometry.curves:
        result["curves"] = {"curves": len(geometry.curves.curves), "points": len(geometry.curves.points), "attributes": read_attributes(geometry.curves)}
    instances = geometry.instances_pointcloud()
    if instances:
        result["instances"] = {
            "count": len(instances.points),
            "attributes": read_attributes(instances, skip=(INSTANCE_POSITION_IS_NOT_STORED,)),
            "references": [read_reference(reference, depth) for reference in geometry.instance_references()],
        }
    return result
