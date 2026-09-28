import type { AttributeSet } from '../../geometry/attributes'
import type { GeometrySet, Mesh } from '../../geometry/geometrySet'
import { EMPTY_GEOMETRY } from '../../geometry/geometrySet'
import type { NodeImplementation } from '../../tree/evaluateTree'
import { asFloat, asInt } from '../socketValues'

export type GridShape = {
  readonly columns: number
  readonly rows: number
  readonly sizeX: number
  readonly sizeY: number
}

const CORNERS_PER_QUAD = 4

function gridPositions(shape: GridShape): Float32Array {
  const { columns, rows } = shape
  const spansX = columns - 1
  const spansY = rows - 1
  const stepX = spansX === 0 ? 0 : shape.sizeX / spansX
  const stepY = spansY === 0 ? 0 : shape.sizeY / spansY
  const positions = new Float32Array(columns * rows * 3)
  for (let x = 0; x < columns; x += 1) {
    for (let y = 0; y < rows; y += 1) {
      const vertex = x * rows + y
      positions[vertex * 3] = (x - spansX / 2) * stepX
      positions[vertex * 3 + 1] = (y - spansY / 2) * stepY
    }
  }
  return positions
}

function gridEdges(shape: GridShape): Int32Array {
  const { columns, rows } = shape
  const spansX = columns - 1
  const spansY = rows - 1
  const edges = new Int32Array((columns * spansY + rows * spansX) * 2)
  let edge = 0
  for (let x = 0; x < columns; x += 1) {
    for (let y = 0; y < spansY; y += 1) {
      edges[edge * 2] = x * rows + y
      edges[edge * 2 + 1] = x * rows + y + 1
      edge += 1
    }
  }
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < spansX; x += 1) {
      edges[edge * 2] = x * rows + y
      edges[edge * 2 + 1] = (x + 1) * rows + y
      edge += 1
    }
  }
  return edges
}

type Corners = { readonly edges: Int32Array; readonly offsets: Int32Array; readonly vertices: Int32Array }

function gridCorners(shape: GridShape): Corners {
  const { columns, rows } = shape
  const spansX = columns - 1
  const spansY = rows - 1
  const faces = spansX * spansY
  const firstAlongX = columns * spansY
  const vertices = new Int32Array(faces * CORNERS_PER_QUAD)
  const edges = new Int32Array(faces * CORNERS_PER_QUAD)
  const offsets = Int32Array.from({ length: faces + 1 }, (_, face) => face * CORNERS_PER_QUAD)
  for (let x = 0; x < spansX; x += 1) {
    for (let y = 0; y < spansY; y += 1) {
      const corner = (x * spansY + y) * CORNERS_PER_QUAD
      const vertex = x * rows + y
      vertices.set([vertex, vertex + rows, vertex + rows + 1, vertex + 1], corner)
      edges.set([firstAlongX + y * spansX + x, (x + 1) * spansY + y, firstAlongX + (y + 1) * spansX + x, x * spansY + y], corner)
    }
  }
  return { edges, offsets, vertices }
}

function flatShadedFaces(faces: number): AttributeSet {
  return new Map([['sharp_face', { domain: 'face', type: 'bool', values: new Uint8Array(faces).fill(1) }]])
}

export function createGridMesh(shape: GridShape): Mesh {
  const corners = gridCorners(shape)
  return {
    attributes: flatShadedFaces(corners.offsets.length - 1),
    cornerEdges: corners.edges,
    cornerVertices: corners.vertices,
    edgeVertices: gridEdges(shape),
    faceOffsets: corners.offsets,
    positions: gridPositions(shape),
    vertexCount: shape.columns * shape.rows,
  }
}

export function gridGeometry(shape: GridShape): GeometrySet {
  if (shape.columns < 1 || shape.rows < 1) return EMPTY_GEOMETRY
  return { mesh: createGridMesh(shape) }
}

export const meshGridNode: NodeImplementation = (inputs) => ({
  Mesh: gridGeometry({
    columns: asInt(inputs.input('Vertices X')),
    rows: asInt(inputs.input('Vertices Y')),
    sizeX: asFloat(inputs.input('Size X')),
    sizeY: asFloat(inputs.input('Size Y')),
  }),
})
