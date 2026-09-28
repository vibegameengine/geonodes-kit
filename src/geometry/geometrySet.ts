import type { AttributeSet } from './attributes'

export type Mesh = {
  readonly attributes: AttributeSet
  readonly cornerVertices: Int32Array
  readonly edgeVertices: Int32Array
  readonly faceOffsets: Int32Array
  readonly vertexCount: number
  readonly positions: Float32Array
}

export type PointCloud = {
  readonly attributes: AttributeSet
  readonly positions: Float32Array
  readonly pointCount: number
}

export type InstanceReference =
  | { readonly kind: 'collection'; readonly name: string }
  | { readonly kind: 'geometry'; readonly geometry: GeometrySet }
  | { readonly kind: 'object'; readonly name: string }

export type Instances = {
  readonly attributes: AttributeSet
  readonly count: number
  readonly referenceIndices: Int32Array
  readonly references: readonly InstanceReference[]
  readonly transforms: Float32Array
}

export type GeometrySet = {
  readonly instances?: Instances
  readonly mesh?: Mesh
  readonly pointCloud?: PointCloud
}

export const EMPTY_GEOMETRY: GeometrySet = {}

export function faceCount(mesh: Mesh): number {
  return mesh.faceOffsets.length - 1
}

export function edgeCount(mesh: Mesh): number {
  return mesh.edgeVertices.length / 2
}

export function cornerCount(mesh: Mesh): number {
  return mesh.cornerVertices.length
}
