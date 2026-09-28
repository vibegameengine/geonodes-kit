import inventory from '../../coverage/nodes-5.2.2.json'
import type { SocketValue } from './nodeTree'

type InventorySocket = { readonly default: SocketValue; readonly identifier: string; readonly name: string; readonly type: string }
type InventoryProperty = { readonly default?: SocketValue; readonly identifier: string; readonly items?: readonly string[]; readonly type: string }
type InventoryNode = {
  readonly idname: string
  readonly inputs: readonly InventorySocket[]
  readonly label: string
  readonly outputs: readonly InventorySocket[]
  readonly properties: readonly InventoryProperty[]
}

export type NodeSignature = {
  readonly inputs: ReadonlyMap<string, InventorySocket>
  readonly label: string
  readonly outputs: ReadonlyMap<string, InventorySocket>
  readonly properties: ReadonlyMap<string, InventoryProperty>
}

function byIdentifier<T extends { readonly identifier: string }>(entries: readonly T[]): ReadonlyMap<string, T> {
  return new Map(entries.map((entry) => [entry.identifier, entry]))
}

const SIGNATURES: ReadonlyMap<string, NodeSignature> = new Map(
  (inventory.nodes as readonly InventoryNode[]).map((node) => [
    node.idname,
    { inputs: byIdentifier(node.inputs), label: node.label, outputs: byIdentifier(node.outputs), properties: byIdentifier(node.properties) },
  ]),
)

export const PINNED_BLENDER_BUILD = inventory.blender

export function nodeSignature(type: string): NodeSignature {
  const signature = SIGNATURES.get(type)
  if (!signature) throw new Error(`${type} is not a Geometry Nodes node in Blender ${inventory.blender}`)
  return signature
}
