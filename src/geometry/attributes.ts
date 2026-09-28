export type AttributeDomain = 'corner' | 'curve' | 'edge' | 'face' | 'instance' | 'layer' | 'point'

export type AttributeType =
  | 'bool'
  | 'colorByte'
  | 'colorFloat'
  | 'float'
  | 'float2'
  | 'float3'
  | 'float4x4'
  | 'int'
  | 'int2'
  | 'int8'
  | 'quaternion'
  | 'string'

export type AttributeValues = Float32Array | Int32Array | Int8Array | Uint8Array | string[]

export type Attribute = {
  readonly domain: AttributeDomain
  readonly type: AttributeType
  readonly values: AttributeValues
}

export type AttributeSet = Map<string, Attribute>

export const COMPONENTS: Readonly<Record<AttributeType, number>> = {
  bool: 1,
  colorByte: 4,
  colorFloat: 4,
  float: 1,
  float2: 2,
  float3: 3,
  float4x4: 16,
  int: 1,
  int2: 2,
  int8: 1,
  quaternion: 4,
  string: 1,
}

export function allocateValues(type: AttributeType, elements: number): AttributeValues {
  const length = elements * COMPONENTS[type]
  switch (type) {
    case 'bool':
    case 'colorByte':
      return new Uint8Array(length)
    case 'int':
    case 'int2':
      return new Int32Array(length)
    case 'int8':
      return new Int8Array(length)
    case 'string':
      return Array.from({ length }, () => '')
    default:
      return new Float32Array(length)
  }
}

export function elementCount(attribute: Attribute): number {
  return attribute.values.length / COMPONENTS[attribute.type]
}
