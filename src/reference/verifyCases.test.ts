import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import type { GeometrySet } from '../geometry/geometrySet'
import { NODE_REGISTRY } from '../nodes/registry'
import { evaluateTree } from '../tree/evaluateTree'
import type { ReferenceCase } from '../tree/nodeTree'
import { compareGeometry } from './compareGeometry'
import { fromEvaluatedObject, type ReferenceGeometry } from './referenceGeometry'

const CASES_DIRECTORY = path.resolve('reference/cases')
const cases = JSON.parse(readFileSync(path.join(CASES_DIRECTORY, 'cases.json'), 'utf8')) as ReferenceCase[]

function referenceOf(id: string): GeometrySet {
  const captured = JSON.parse(readFileSync(path.join(CASES_DIRECTORY, `${id}.json`), 'utf8')) as { geometry: ReferenceGeometry }
  return fromEvaluatedObject(captured.geometry)
}

function isImplemented(entry: ReferenceCase): boolean {
  return entry.tree.nodes.every((node) => NODE_REGISTRY.has(node.type))
}

describe('Matches Blender 5.2.2', () => {
  for (const entry of cases) {
    const check = isImplemented(entry) ? it : it.skip
    check(`${entry.id} — ${entry.description}`, () => {
      const actual = evaluateTree(entry.tree, NODE_REGISTRY) as GeometrySet
      expect(compareGeometry(actual, referenceOf(entry.id))).toEqual([])
    })
  }
})
