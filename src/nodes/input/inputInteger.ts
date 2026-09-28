import type { NodeImplementation } from '../../tree/evaluateTree'
import { asInt } from '../socketValues'

export const inputIntegerNode: NodeImplementation = (inputs) => ({ Integer: asInt(inputs.property('integer')) })
