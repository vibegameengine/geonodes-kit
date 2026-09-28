import { nodeSignature } from './nodeCatalog'
import type { LinkDescription, NodeDescription, NodeTreeDescription, SocketAddress, SocketValue } from './nodeTree'

export type NodeInputs = {
  readonly input: (identifier: string) => unknown
  readonly property: (identifier: string) => SocketValue
}

export type NodeImplementation = (inputs: NodeInputs) => Readonly<Record<string, unknown>>

export type NodeRegistry = ReadonlyMap<string, NodeImplementation>

type Evaluation = {
  readonly done: Map<string, Readonly<Record<string, unknown>>>
  readonly inProgress: Set<string>
  readonly linksInto: ReadonlyMap<string, LinkDescription>
  readonly nodes: ReadonlyMap<string, NodeDescription>
  readonly registry: NodeRegistry
}

function socketKey(address: SocketAddress): string {
  return `${address[0]}\u0000${address[1]}`
}

function explicitValue(node: NodeDescription, identifier: string, kind: 'inputs' | 'properties'): SocketValue | undefined {
  const values = node[kind]
  return values && identifier in values ? values[identifier] : undefined
}

function inputsOf(evaluation: Evaluation, node: NodeDescription): NodeInputs {
  const signature = nodeSignature(node.type)
  return {
    input: (identifier) => {
      const link = evaluation.linksInto.get(socketKey([node.name, identifier]))
      if (link) return outputValue(evaluation, link.from)
      if (!signature.inputs.has(identifier)) throw new Error(`${node.type} has no input ${identifier}`)
      return explicitValue(node, identifier, 'inputs') ?? signature.inputs.get(identifier)?.default ?? null
    },
    property: (identifier) => {
      if (!signature.properties.has(identifier)) throw new Error(`${node.type} has no property ${identifier}`)
      return explicitValue(node, identifier, 'properties') ?? signature.properties.get(identifier)?.default ?? null
    },
  }
}

function evaluateNode(evaluation: Evaluation, name: string): Readonly<Record<string, unknown>> {
  const known = evaluation.done.get(name)
  if (known) return known
  if (evaluation.inProgress.has(name)) throw new Error(`node tree has a cycle through ${name}`)
  const node = evaluation.nodes.get(name)
  if (!node) throw new Error(`no node named ${name}`)
  const implementation = evaluation.registry.get(node.type)
  if (!implementation) throw new Error(`${node.type} is not implemented yet`)
  evaluation.inProgress.add(name)
  const outputs = implementation(inputsOf(evaluation, node))
  evaluation.inProgress.delete(name)
  evaluation.done.set(name, outputs)
  return outputs
}

function outputValue(evaluation: Evaluation, address: SocketAddress): unknown {
  const outputs = evaluateNode(evaluation, address[0])
  if (!(address[1] in outputs)) throw new Error(`${address[0]} produced no output ${address[1]}`)
  return outputs[address[1]]
}

export function evaluateTree(tree: NodeTreeDescription, registry: NodeRegistry): unknown {
  const evaluation: Evaluation = {
    done: new Map(),
    inProgress: new Set(),
    linksInto: new Map(tree.links.map((link) => [socketKey(link.to), link])),
    nodes: new Map(tree.nodes.map((node) => [node.name, node])),
    registry,
  }
  return outputValue(evaluation, tree.output)
}
