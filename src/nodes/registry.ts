import type { NodeRegistry } from '../tree/evaluateTree'
import { inputIntegerNode } from './input/inputInteger'
import { meshGridNode } from './mesh/meshGrid'

export const NODE_REGISTRY: NodeRegistry = new Map([
  ['FunctionNodeInputInt', inputIntegerNode],
  ['GeometryNodeMeshGrid', meshGridNode],
])
