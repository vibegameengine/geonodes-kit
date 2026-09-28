import type { Attribute, AttributeSet, AttributeValues } from '../geometry/attributes'
import type { GeometrySet, InstanceReference, Instances, Mesh, PointCloud } from '../geometry/geometrySet'

export type Tolerance = { readonly float: number }

export const DEFAULT_TOLERANCE: Tolerance = { float: 1e-5 }

const MAX_DIFFERENCES = 50

type Report = { readonly differences: string[]; readonly tolerance: Tolerance }

function note(report: Report, message: string): void {
  if (report.differences.length < MAX_DIFFERENCES) report.differences.push(message)
}

function sameNumber(actual: number, expected: number, tolerance: number): boolean {
  if (Number.isNaN(expected)) return Number.isNaN(actual)
  return Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected))
}

function compareValues(report: Report, path: string, actual: ArrayLike<number | string>, expected: ArrayLike<number | string>, exact: boolean): void {
  if (actual.length !== expected.length) {
    note(report, `${path}: length ${actual.length}, expected ${expected.length}`)
    return
  }
  for (let index = 0; index < expected.length; index += 1) {
    const [a, e] = [actual[index], expected[index]]
    const equal = typeof e === 'string' || exact ? a === e : sameNumber(a as number, e, report.tolerance.float)
    if (equal) continue
    note(report, `${path}[${index}]: ${a}, expected ${e}`)
    return
  }
}

function isExact(values: AttributeValues): boolean {
  return !(values instanceof Float32Array)
}

function compareAttribute(report: Report, path: string, actual: Attribute, expected: Attribute): void {
  if (actual.domain !== expected.domain || actual.type !== expected.type) {
    note(report, `${path}: ${actual.domain} ${actual.type}, expected ${expected.domain} ${expected.type}`)
    return
  }
  compareValues(report, path, actual.values, expected.values, isExact(expected.values))
}

function compareAttributes(report: Report, path: string, actual: AttributeSet, expected: AttributeSet): void {
  for (const [name, attribute] of expected) {
    const found = actual.get(name)
    if (found) compareAttribute(report, `${path}.${name}`, found, attribute)
    else note(report, `${path}.${name}: missing`)
  }
  for (const name of actual.keys()) if (!expected.has(name)) note(report, `${path}.${name}: not in reference`)
}

function compareMesh(report: Report, path: string, actual: Mesh, expected: Mesh): void {
  if (actual.vertexCount !== expected.vertexCount) note(report, `${path}.vertexCount: ${actual.vertexCount}, expected ${expected.vertexCount}`)
  compareValues(report, `${path}.positions`, actual.positions, expected.positions, false)
  compareValues(report, `${path}.edgeVertices`, actual.edgeVertices, expected.edgeVertices, true)
  compareValues(report, `${path}.faceOffsets`, actual.faceOffsets, expected.faceOffsets, true)
  compareValues(report, `${path}.cornerVertices`, actual.cornerVertices, expected.cornerVertices, true)
  compareAttributes(report, `${path}.attributes`, actual.attributes, expected.attributes)
}

function comparePointCloud(report: Report, path: string, actual: PointCloud, expected: PointCloud): void {
  if (actual.pointCount !== expected.pointCount) note(report, `${path}.pointCount: ${actual.pointCount}, expected ${expected.pointCount}`)
  compareValues(report, `${path}.positions`, actual.positions, expected.positions, false)
  compareAttributes(report, `${path}.attributes`, actual.attributes, expected.attributes)
}

function compareReference(report: Report, path: string, actual: InstanceReference, expected: InstanceReference): void {
  if (actual.kind !== expected.kind) {
    note(report, `${path}: ${actual.kind}, expected ${expected.kind}`)
    return
  }
  if (actual.kind === 'geometry' && expected.kind === 'geometry') compareInto(report, path, actual.geometry, expected.geometry)
  else if ('name' in actual && 'name' in expected && actual.name !== expected.name) note(report, `${path}: ${actual.name}, expected ${expected.name}`)
}

function compareInstances(report: Report, path: string, actual: Instances, expected: Instances): void {
  if (actual.count !== expected.count) note(report, `${path}.count: ${actual.count}, expected ${expected.count}`)
  compareValues(report, `${path}.referenceIndices`, actual.referenceIndices, expected.referenceIndices, true)
  compareValues(report, `${path}.transforms`, actual.transforms, expected.transforms, false)
  if (actual.references.length !== expected.references.length) note(report, `${path}.references: ${actual.references.length}, expected ${expected.references.length}`)
  expected.references.forEach((reference, index) => {
    const found = actual.references[index]
    if (found) compareReference(report, `${path}.references[${index}]`, found, reference)
  })
  compareAttributes(report, `${path}.attributes`, actual.attributes, expected.attributes)
}

function comparePresence(report: Report, path: string, actual: GeometrySet, expected: GeometrySet): void {
  for (const component of ['mesh', 'pointCloud', 'instances'] as const) {
    if (Boolean(actual[component]) !== Boolean(expected[component])) {
      note(report, `${path}.${component}: ${actual[component] ? 'present' : 'absent'}, expected ${expected[component] ? 'present' : 'absent'}`)
    }
  }
}

function compareInto(report: Report, path: string, actual: GeometrySet, expected: GeometrySet): void {
  comparePresence(report, path, actual, expected)
  if (actual.mesh && expected.mesh) compareMesh(report, `${path}.mesh`, actual.mesh, expected.mesh)
  if (actual.pointCloud && expected.pointCloud) comparePointCloud(report, `${path}.pointCloud`, actual.pointCloud, expected.pointCloud)
  if (actual.instances && expected.instances) compareInstances(report, `${path}.instances`, actual.instances, expected.instances)
}

export function compareGeometry(actual: GeometrySet, expected: GeometrySet, tolerance: Tolerance = DEFAULT_TOLERANCE): readonly string[] {
  const report: Report = { differences: [], tolerance }
  compareInto(report, 'geometry', actual, expected)
  return report.differences
}
