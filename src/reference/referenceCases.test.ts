import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { compareGeometry } from './compareGeometry'
import { fromEvaluatedObject, type ReferenceGeometry } from './referenceGeometry'

const CASES_DIRECTORY = path.resolve('reference/cases')
const caseFiles = readdirSync(CASES_DIRECTORY).filter((file) => file.endsWith('.json') && file !== 'cases.json')

function loadCase(file: string): ReferenceGeometry {
  return (JSON.parse(readFileSync(path.join(CASES_DIRECTORY, file), 'utf8')) as { geometry: ReferenceGeometry }).geometry
}

describe('Blender reference cases', () => {
  it('has a captured reference for every case', () => {
    const ids = (JSON.parse(readFileSync(path.join(CASES_DIRECTORY, 'cases.json'), 'utf8')) as { id: string }[]).map((entry) => `${entry.id}.json`)
    expect(caseFiles.sort()).toEqual(ids.sort())
  })

  it.each(caseFiles)('%s loads and matches itself', (file) => {
    const geometry = fromEvaluatedObject(loadCase(file))
    expect(compareGeometry(geometry, geometry)).toEqual([])
  })

  it('treats the empty mesh of an evaluated mesh object as no mesh', () => {
    const points = fromEvaluatedObject(loadCase('grid-to-points-faces.json'))
    expect(points.mesh).toBeUndefined()
    expect(points.pointCloud?.pointCount).toBe(4)
  })

  it('reports a moved vertex', () => {
    const grid = fromEvaluatedObject(loadCase('grid-3x2.json'))
    const mesh = grid.mesh
    if (!mesh) throw new Error('grid has no mesh')
    const positions = mesh.positions.slice()
    positions[4] += 0.01
    const differences = compareGeometry({ mesh: { ...mesh, positions } }, grid)
    expect(differences).toEqual(['geometry.mesh.positions[4]: ' + positions[4] + ', expected ' + mesh.positions[4]])
  })
})
