import type { Attribute, AttributeDomain, AttributeSet, AttributeType } from '../geometry/attributes'
import { allocateValues } from '../geometry/attributes'
import type { GeometrySet, InstanceReference, Instances, Mesh, PointCloud } from '../geometry/geometrySet'

export type ReferenceAttribute = {
  readonly domain: string
  readonly name: string
  readonly type: string
  readonly values: readonly (number | null)[] | null
}

export type ReferenceReference =
  | { readonly kind: 'collection'; readonly name: string }
  | { readonly kind: 'geometry'; readonly geometry: ReferenceGeometry }
  | { readonly kind: 'object'; readonly name: string }

export type ReferenceGeometry = {
  readonly instances?: { readonly attributes: readonly ReferenceAttribute[]; readonly count: number; readonly references: readonly ReferenceReference[] }
  readonly mesh?: {
    readonly attributes: readonly ReferenceAttribute[]
    readonly cornerVertices: readonly number[]
    readonly edges: readonly number[]
    readonly faceSizes: readonly number[]
    readonly faceStarts: readonly number[]
    readonly vertices: number
  }
  readonly pointcloud?: { readonly attributes: readonly ReferenceAttribute[]; readonly points: number }
}

const DOMAINS: Readonly<Record<string, AttributeDomain>> = {
  CORNER: 'corner',
  CURVE: 'curve',
  EDGE: 'edge',
  FACE: 'face',
  INSTANCE: 'instance',
  LAYER: 'layer',
  POINT: 'point',
}

const TYPES: Readonly<Record<string, AttributeType>> = {
  BOOLEAN: 'bool',
  BYTE_COLOR: 'colorByte',
  FLOAT: 'float',
  FLOAT2: 'float2',
  FLOAT4X4: 'float4x4',
  FLOAT_COLOR: 'colorFloat',
  FLOAT_VECTOR: 'float3',
  INT: 'int',
  INT32_2D: 'int2',
  INT8: 'int8',
  QUATERNION: 'quaternion',
  STRING: 'string',
}

const MESH_TOPOLOGY = new Set(['position', '.edge_verts', '.corner_vert', '.corner_edge'])
const INSTANCE_BUILT_INS = new Set(['.reference_index', 'instance_transform'])

function toAttribute(reference: ReferenceAttribute): Attribute {
  const type = TYPES[reference.type]
  const domain = DOMAINS[reference.domain]
  if (!type || !domain) throw new Error(`unknown attribute ${reference.name}: ${reference.domain} ${reference.type}`)
  const source = reference.values ?? []
  const values = allocateValues(type, 0)
  if (Array.isArray(values)) return { domain, type, values: source.map((value) => String(value)) }
  const typed = new (values.constructor as new (length: number) => Float32Array)(source.length)
  source.forEach((value, index) => {
    typed[index] = value ?? Number.NaN
  })
  return { domain, type, values: typed }
}

function toAttributeSet(references: readonly ReferenceAttribute[], builtIns: ReadonlySet<string>): AttributeSet {
  const set: AttributeSet = new Map()
  for (const reference of references) if (!builtIns.has(reference.name)) set.set(reference.name, toAttribute(reference))
  return set
}

function builtIn(references: readonly ReferenceAttribute[], name: string): readonly number[] {
  return (references.find((reference) => reference.name === name)?.values ?? []).map((value) => value ?? Number.NaN)
}

function toMesh(reference: NonNullable<ReferenceGeometry['mesh']>): Mesh {
  const faceOffsets = new Int32Array(reference.faceStarts.length + 1)
  reference.faceStarts.forEach((start, face) => {
    faceOffsets[face] = start
    faceOffsets[face + 1] = start + reference.faceSizes[face]
  })
  return {
    attributes: toAttributeSet(reference.attributes, MESH_TOPOLOGY),
    cornerVertices: Int32Array.from(reference.cornerVertices),
    edgeVertices: Int32Array.from(reference.edges),
    faceOffsets,
    positions: Float32Array.from(builtIn(reference.attributes, 'position')),
    vertexCount: reference.vertices,
  }
}

function toPointCloud(reference: NonNullable<ReferenceGeometry['pointcloud']>): PointCloud {
  return {
    attributes: toAttributeSet(reference.attributes, new Set(['position'])),
    pointCount: reference.points,
    positions: Float32Array.from(builtIn(reference.attributes, 'position')),
  }
}

function toReference(reference: ReferenceReference): InstanceReference {
  return reference.kind === 'geometry' ? { geometry: fromReferenceGeometry(reference.geometry), kind: 'geometry' } : reference
}

function toInstances(reference: NonNullable<ReferenceGeometry['instances']>): Instances {
  return {
    attributes: toAttributeSet(reference.attributes, INSTANCE_BUILT_INS),
    count: reference.count,
    referenceIndices: Int32Array.from(builtIn(reference.attributes, '.reference_index')),
    references: reference.references.map(toReference),
    transforms: Float32Array.from(builtIn(reference.attributes, 'instance_transform')),
  }
}

function isEmptyMesh(mesh: NonNullable<ReferenceGeometry['mesh']>): boolean {
  return mesh.vertices === 0 && mesh.edges.length === 0 && mesh.faceSizes.length === 0
}

export function fromEvaluatedObject(reference: ReferenceGeometry): GeometrySet {
  const hasRealMesh = reference.mesh !== undefined && !isEmptyMesh(reference.mesh)
  return fromReferenceGeometry(hasRealMesh ? reference : { ...reference, mesh: undefined })
}

export function fromReferenceGeometry(reference: ReferenceGeometry): GeometrySet {
  return {
    ...(reference.instances ? { instances: toInstances(reference.instances) } : {}),
    ...(reference.mesh ? { mesh: toMesh(reference.mesh) } : {}),
    ...(reference.pointcloud ? { pointCloud: toPointCloud(reference.pointcloud) } : {}),
  }
}
