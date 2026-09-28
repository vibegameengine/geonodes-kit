export function asFloat(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  throw new Error(`expected a number, got ${JSON.stringify(value)}`)
}

export function asInt(value: unknown): number {
  return Math.trunc(asFloat(value))
}
