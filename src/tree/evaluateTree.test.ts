import { describe, expect, it } from 'vitest'

import { evaluateTree, type NodeImplementation } from './evaluateTree'
import type { NodeTreeDescription } from './nodeTree'

const echoMath: NodeImplementation = (inputs) => ({ Value: [inputs.input('Value'), inputs.input('Value_001'), inputs.property('operation')] })

describe('Tree evaluation', () => {
  it('fills unlinked inputs and properties from the Blender inventory', () => {
    const tree: NodeTreeDescription = { links: [], nodes: [{ name: 'math', type: 'ShaderNodeMath' }], output: ['math', 'Value'] }
    expect(evaluateTree(tree, new Map([['ShaderNodeMath', echoMath]]))).toEqual([0.5, 0.5, 'ADD'])
  })

  it('prefers values set on the node and follows links', () => {
    const tree: NodeTreeDescription = {
      links: [{ from: ['first', 'Value'], to: ['second', 'Value'] }],
      nodes: [
        { inputs: { Value: 2 }, name: 'first', type: 'ShaderNodeMath' },
        { name: 'second', properties: { operation: 'MULTIPLY' }, type: 'ShaderNodeMath' },
      ],
      output: ['second', 'Value'],
    }
    expect(evaluateTree(tree, new Map([['ShaderNodeMath', echoMath]]))).toEqual([[2, 0.5, 'ADD'], 0.5, 'MULTIPLY'])
  })

  it('evaluates a node once however many links read it', () => {
    let runs = 0
    const counted: NodeImplementation = () => {
      runs += 1
      return { Value: runs }
    }
    const sum: NodeImplementation = (inputs) => ({ Value: [inputs.input('Value'), inputs.input('Value_001')] })
    const tree: NodeTreeDescription = {
      links: [
        { from: ['source', 'Value'], to: ['sum', 'Value'] },
        { from: ['source', 'Value'], to: ['sum', 'Value_001'] },
      ],
      nodes: [
        { name: 'source', type: 'ShaderNodeValue' },
        { name: 'sum', type: 'ShaderNodeMath' },
      ],
      output: ['sum', 'Value'],
    }
    expect(evaluateTree(tree, new Map([['ShaderNodeValue', counted], ['ShaderNodeMath', sum]]))).toEqual([1, 1])
  })

  it('refuses a node type Blender does not have and a node not yet implemented', () => {
    const unknown: NodeTreeDescription = { links: [], nodes: [{ name: 'x', type: 'NotANode' }], output: ['x', 'Value'] }
    expect(() => evaluateTree(unknown, new Map([['NotANode', echoMath]]))).toThrow(/not a Geometry Nodes node/)
    const pending: NodeTreeDescription = { links: [], nodes: [{ name: 'grid', type: 'GeometryNodeMeshGrid' }], output: ['grid', 'Mesh'] }
    expect(() => evaluateTree(pending, new Map())).toThrow(/not implemented yet/)
  })
})
