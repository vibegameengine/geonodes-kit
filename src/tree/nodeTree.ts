export type SocketValue = boolean | number | readonly number[] | string | null

export type NodeDescription = {
  readonly inputs?: Readonly<Record<string, SocketValue>>
  readonly name: string
  readonly properties?: Readonly<Record<string, SocketValue>>
  readonly type: string
}

export type SocketAddress = readonly [node: string, socketIdentifier: string]

export type LinkDescription = {
  readonly from: SocketAddress
  readonly to: SocketAddress
}

export type NodeTreeDescription = {
  readonly links: readonly LinkDescription[]
  readonly nodes: readonly NodeDescription[]
  readonly output: SocketAddress
}

export type ReferenceCase = {
  readonly description: string
  readonly id: string
  readonly tree: NodeTreeDescription
}
